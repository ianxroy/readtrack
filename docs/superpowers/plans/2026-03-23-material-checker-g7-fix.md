# MaterialChecker G7 Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken `MaterialChecker.tsx` by removing dead student-diagnosis code, fixing 4 TypeScript errors, and adding a DepEd-anchored G7 Suitability Panel.

**Architecture:** Single-file surgery on `components/MaterialChecker.tsx` (~1350 lines). Remove ~600 lines of dead code (two unused local components + dead state/logic), replace `InteractiveEditor` with a plain `<textarea>`, then add a new `G7SuitabilityPanel` derived purely from the existing `complexityResult`. No new files, no backend changes.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, `ComplexityLevel` enum (LITERAL/INFERENTIAL/EVALUATIVE), `TextComplexityResult` type.

---

## Chunk 1: Dead Code Removal

### Task 1: Remove dead imports and local components

**Files:**
- Modify: `components/MaterialChecker.tsx` (lines 9–32, 221–812)

**Background:** The file has three bad import groups and two large local components that must go. `VerdictCard` (lines 221–324) caused TS error at line 1266 by receiving `TextComplexityResult` where it expected `StudentDiagnosisResult`. `InteractiveEditor` (lines 326–812) is a grammar-highlighting editor being replaced by a plain `<textarea>`.

> **Note on import cleanup:** When removing the `grammarService` import block, also check if `getDefinition` and `DefinitionResponse` are used anywhere outside `InteractiveEditor`. After removing `InteractiveEditor`, they won't be — remove them all.

- [ ] **Step 1: Remove unused type imports (lines 9–19)**

Replace the type import block with only what's still needed after dead code removal:

```typescript
import {
  TextComplexityResult,
  ComplexityLevel,
} from "../types";
```

Remove these type imports entirely: `StudentDiagnosisResult`, `Language`, `GrammarIssue`, `IssueCategory`, `ProficiencyLevel`, `LearningBand`, `PhilIriLevel`.

- [ ] **Step 2: Remove unused service imports (lines 20–32)**

Replace the three service import blocks with only what's needed:

```typescript
import {
  classifyTextComplexityAPI,
  extractTextFromImageAPI,
} from "../services/pythonService";
```

Remove entirely:
- `analyzeStudentWorkAPI` from `../services/pythonService`
- The entire `import { validateContentWithGemini } from "../services/geminiService"` line
- The entire `import { checkGrammar, GrammarCheckResponse, GrammarIssue as GrammarServiceIssue, getDefinition, DefinitionResponse } from "../services/grammarService"` block

- [ ] **Step 3: Delete the `VerdictCard` component (lines 221–324)**

Delete from `const VerdictCard = ({` through the closing `};` of VerdictCard. Keep `ComplexityMetricsCard` (starts at line 147) — it stays.

- [ ] **Step 4: Delete the `InteractiveEditor` component (lines 326–812)**

Delete from `const InteractiveEditor = ({` through its closing `};`. This is a large block (~487 lines) ending just before `interface MaterialProps`.

- [ ] **Step 5: Check TypeScript (expect errors — state still references removed types)**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | grep MaterialChecker
```

Expected: errors about `diagnosisResult`, `currentIssues`, `grammarResult`, etc. — these will be fixed in Task 2. Confirm `VerdictCard` and `InteractiveEditor` errors are gone.

- [ ] **Step 6: Commit**

```bash
git add components/MaterialChecker.tsx
git commit -m "refactor(material-checker): remove dead VerdictCard, InteractiveEditor, and unused imports"
```

---

### Task 2: Remove dead state, simplify handleAnalyze, fix MaterialProps

**Files:**
- Modify: `components/MaterialChecker.tsx` (component body, ~lines 815–980)

**Background:** After Task 1, the component body still has ~10 dead state variables, 3 dead functions, 2 dead useEffects, and a bloated `handleAnalyze`. This task cleans all of that up so TypeScript compiles cleanly.

- [ ] **Step 1: Fix `MaterialProps` interface and component destructuring**

Change the interface (currently ~line 815) from:
```typescript
interface MaterialProps {
  onSaveAnalysis?: (analysis: CachedAnalysis) => void;
  selectedAnalysis?: CachedAnalysis | null;
  onMenuClick: () => void;
}
```
(No changes needed to the interface itself — `referenceFileName` and `onSaveReference` were never in the interface, they were in the destructuring only.)

Fix the component destructuring (currently ~line 821) — remove `referenceFileName` and `onSaveReference`:
```typescript
export const MaterialChecker: React.FC<MaterialProps> = ({
  onSaveAnalysis,
  selectedAnalysis,
  onMenuClick,
}) => {
```

- [ ] **Step 2: Remove dead state variables**

Remove these `useState` declarations from the component body:
- `const [referenceText, setReferenceText] = useState("")`
- `const [currentReferenceName, setCurrentReferenceName] = useState(referenceFileName || "")`
- `const [referenceFiles, setReferenceFiles] = useState<...>([])`
- `const [showReferenceInput, setShowReferenceInput] = useState(false)`
- `const [useReferenceValidation, setUseReferenceValidation] = useState(false)`
- `const [diagnosisResult, setDiagnosisResult] = useState<StudentDiagnosisResult | null>(null)`
- `const [currentIssues, setCurrentIssues] = useState<GrammarIssue[]>([])`
- `const [grammarResult, setGrammarResult] = useState<GrammarCheckResponse | null>(null)`
- `const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""`
- `const [activeIssue, setActiveIssue] = useState<ActiveIssueState | null>(null)`
- `const [isSaveReferenceModalOpen, setIsSaveReferenceModalOpen] = useState(false)`
- `const [referenceWorkspaceName, setReferenceWorkspaceName] = useState("")`

Also remove the `ActiveIssueState` interface (it was defined above the component, around line 102 — find it and delete it).

Also remove: `const referenceFileInputRef = useRef<HTMLInputElement>(null)`

- [ ] **Step 3: Fix `hasResults`**

Change:
```typescript
const hasResults = !!diagnosisResult && !!complexityResult;
```
To:
```typescript
const hasResults = !!complexityResult;
```

- [ ] **Step 4: Remove the `referenceFileName` useEffect**

Delete this entire useEffect block:
```typescript
useEffect(() => {
  if (referenceFileName) {
    setCurrentReferenceName(referenceFileName);
  }
}, [referenceFileName]);
```

- [ ] **Step 5: Clean up the `selectedAnalysis` useEffect**

Replace the current `selectedAnalysis` useEffect with the simplified version:
```typescript
useEffect(() => {
  if (!selectedAnalysis) return;
  setCurrentText(selectedAnalysis.studentText || "");
  setInputText("");
  setComplexityResult(selectedAnalysis.complexityResult || null);
}, [selectedAnalysis]);
```

- [ ] **Step 6: Replace `handleAnalyze` with the simplified version**

Replace the entire `handleAnalyze` async function with:
```typescript
const handleAnalyze = async () => {
  setErrorMessage(null);

  const textToAnalyze = inputText || currentText;

  if (!textToAnalyze.trim() && !selectedFile) {
    setErrorMessage("Please enter text or upload a document to analyze.");
    return;
  }
  if (!selectedFile && textToAnalyze.trim().length < 15) {
    setErrorMessage("Text is too short. Please provide at least 15 characters.");
    return;
  }

  if (isLoading) return;
  setIsLoading(true);

  setCurrentText(textToAnalyze);
  setInputText("");

  try {
    const comp = await classifyTextComplexityAPI(
      textToAnalyze,
      selectedFile?.base64,
      selectedFile?.mimeType,
    );
    setComplexityResult(comp);

    if (onSaveAnalysis) {
      const firstLine =
        textToAnalyze.split("\n").find((line) => line.trim().length > 0) ||
        "Untitled Analysis";
      const title =
        firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine;

      onSaveAnalysis({
        id: Date.now().toString(),
        timestamp: new Date(),
        title,
        studentText: textToAnalyze,
        complexityResult: comp,
      });
    }
  } catch {
    setErrorMessage("Analysis failed. Please try again.");
  } finally {
    setIsLoading(false);
  }
};
```

- [ ] **Step 7: Remove dead functions**

Delete these functions entirely:
- `handleSaveClick` (opens save-reference modal — reference feature removed)
- `handleIssueClick` (sets `activeIssue` — state removed)
- `handleAcceptSuggestion` (applies grammar suggestion — state removed)

- [ ] **Step 8: Verify TypeScript is clean**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | grep MaterialChecker
```

Expected: **zero errors** from `MaterialChecker.tsx`. If errors remain, fix them before proceeding.

- [ ] **Step 9: Commit**

```bash
git add components/MaterialChecker.tsx
git commit -m "refactor(material-checker): remove dead state/logic, simplify handleAnalyze, fix MaterialProps"
```

---

## Chunk 2: UI Fixes + G7 Suitability Panel

### Task 3: Replace InteractiveEditor with plain textarea in JSX

**Files:**
- Modify: `components/MaterialChecker.tsx` (JSX, ~lines 1100–1260 after prior removals)

**Background:** Now that `InteractiveEditor` is removed, the JSX still references it. Find the left-panel section where `<InteractiveEditor ... />` was rendered and replace it with a plain `<textarea>`. Also remove any reference validation UI (toggle checkbox, file upload section) from the left panel.

- [ ] **Step 1: Find where `InteractiveEditor` was used in JSX**

Search for `InteractiveEditor` in the file — there should be one remaining reference in the JSX (the component definition is gone, the usage remains). Also search for `referenceFileInputRef`, `showReferenceInput`, `useReferenceValidation`, `referenceFiles` in the JSX — these must all be removed.

```bash
grep -n "InteractiveEditor\|referenceFileInputRef\|showReferenceInput\|useReferenceValidation\|handleSaveClick\|isSaveReferenceModalOpen\|referenceWorkspaceName\|activeIssue\|handleIssueClick\|handleAcceptSuggestion\|VerdictCard\|currentIssues\|grammarResult" /Volumes/Hanteck/Projects/readtrack/components/MaterialChecker.tsx
```

Remove every JSX block that references these. The areas to clean:
- The `<InteractiveEditor ... />` block in the left panel → replace with the textarea below
- The reference validation toggle checkbox and file upload UI → delete
- Any modal JSX for `isSaveReferenceModalOpen` → delete
- The `<input ref={referenceFileInputRef} ...>` → delete
- The `VerdictCard` usage in the right panel → delete entirely
- Any `activeIssue` tooltip/popover JSX → delete

- [ ] **Step 2: Replace InteractiveEditor with plain textarea**

Where `<InteractiveEditor ... />` was in the left panel, insert:
```tsx
<textarea
  className="w-full h-full min-h-[300px] resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none leading-relaxed"
  placeholder="Paste reading material here to check if it's suitable for Grade 7 students..."
  value={inputText || currentText}
  onChange={(e) => setInputText(e.target.value)}
/>
```

- [ ] **Step 3: Verify TypeScript is still clean**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | grep MaterialChecker
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/MaterialChecker.tsx
git commit -m "refactor(material-checker): replace InteractiveEditor with plain textarea, remove reference UI"
```

---

### Task 4: Add G7 Suitability Panel

**Files:**
- Modify: `components/MaterialChecker.tsx`

**Background:** Add a G7 Suitability Panel as the first card in the right results column. Verdict is derived purely from `complexityResult.level` (the SVM model's DepEd MELCs classification). FK grade level from `complexityResult.readability?.flesch_kincaid` is shown as a display-only Phil-IRI level indicator but does NOT affect the verdict.

- [ ] **Step 1: Add the `deriveG7Verdict` and `derivePhilIriLevel` functions**

Add these two functions near the top of the file, just after the imports and before the first local component (`ResultCard`). Place them after the `parseMarkdown` utility function:

```typescript
type G7Verdict = 'ready' | 'support' | 'above';
type PhilIriReadingLevel = 'independent' | 'instructional' | 'frustration';

function deriveG7Verdict(level: ComplexityLevel): G7Verdict {
  if (level === ComplexityLevel.EVALUATIVE) return 'above';
  if (level === ComplexityLevel.INFERENTIAL) return 'support';
  return 'ready'; // LITERAL
}

function derivePhilIriLevel(fkGradeLevel: number | undefined): PhilIriReadingLevel {
  if (fkGradeLevel === undefined) return 'instructional'; // fallback if not provided
  if (fkGradeLevel <= 5) return 'independent';
  if (fkGradeLevel <= 8) return 'instructional';
  return 'frustration';
}
```

- [ ] **Step 2: Add the `G7SuitabilityPanel` local component**

Add this component immediately after `derivePhilIriLevel`, before `ResultCard`:

```typescript
const VERDICT_CONFIG = {
  ready: {
    badge: '✅ Ready for Grade 7',
    sentence: 'Students can read this material independently at Grade 7 level.',
    badgeClass: 'bg-green-100 text-green-700',
  },
  support: {
    badge: '⚠️ Use with Teacher Support',
    sentence: 'This material may challenge some Grade 7 students — teacher guidance is recommended.',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  above: {
    badge: '❌ Above Grade 7 Level',
    sentence: 'This material is above Grade 7 readability — scaffolding or simplification is recommended before use.',
    badgeClass: 'bg-red-100 text-red-700',
  },
} as const;

const PHIL_IRI_LABELS: Record<PhilIriReadingLevel, string> = {
  independent: 'Independent (below G7 — may be too easy)',
  instructional: 'Instructional (on G7 level — ideal)',
  frustration: 'Frustration (above G7 — too difficult)',
};

const G7SuitabilityPanel = ({ result }: { result: TextComplexityResult }) => {
  const verdict = deriveG7Verdict(result.level);
  const philIriLevel = derivePhilIriLevel(result.readability?.flesch_kincaid);
  const config = VERDICT_CONFIG[verdict];

  // Vocabulary breakdown — only shown if CEFR data is available
  const cefr = (result as any).metrics?.cefrWordGroups as
    | { basic: string[]; independent: string[]; proficient: string[] }
    | undefined;
  const totalCefrWords =
    (cefr?.basic.length ?? 0) +
    (cefr?.independent.length ?? 0) +
    (cefr?.proficient.length ?? 0);
  const basicPct =
    totalCefrWords > 0 ? Math.round(((cefr?.basic.length ?? 0) / totalCefrWords) * 100) : null;
  const midPct =
    totalCefrWords > 0 ? Math.round(((cefr?.independent.length ?? 0) / totalCefrWords) * 100) : null;
  const advPct =
    totalCefrWords > 0 ? Math.round(((cefr?.proficient.length ?? 0) / totalCefrWords) * 100) : null;

  return (
    <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600 mb-3">
        Grade 7 Suitability (DepEd / Phil-IRI)
      </p>

      <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full mb-2 ${config.badgeClass}`}>
        {config.badge}
      </span>

      <p className="text-xs text-gray-600 leading-relaxed mb-3">{config.sentence}</p>

      <div className="space-y-1">
        <div className="flex gap-2 text-xs">
          <span className="text-gray-500 min-w-[130px]">Phil-IRI Reading Level:</span>
          <span className="text-gray-700">{PHIL_IRI_LABELS[philIriLevel]}</span>
        </div>

        {basicPct !== null && (
          <div className="flex gap-2 text-xs">
            <span className="text-gray-500 min-w-[130px]">Vocabulary Mix:</span>
            <span className="text-gray-700">
              {basicPct}% basic · {midPct}% intermediate · {advPct}% advanced
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Insert `G7SuitabilityPanel` into the results JSX**

In the right results column, find where `complexityResult` results are rendered. The right panel renders (in order): `VerdictCard` (now removed in Task 3), `ResultCard` for "Readability", `ComplexityMetricsCard`.

Insert `<G7SuitabilityPanel result={complexityResult} />` as the **first card** in the right results column, before the readability `ResultCard`. The JSX should look like:

```tsx
{hasResults && complexityResult && (
  <div className="space-y-4">
    <G7SuitabilityPanel result={complexityResult} />
    {/* existing ResultCard for Readability */}
    {/* existing ComplexityMetricsCard */}
  </div>
)}
```

Find the exact location in the JSX where the right-column results are rendered and insert accordingly. The `complexityResult` non-null check is already guaranteed by `hasResults` but TypeScript needs the explicit check for the `G7SuitabilityPanel` prop.

- [ ] **Step 4: Verify TypeScript is clean**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | grep MaterialChecker
```

Expected: **zero errors**.

- [ ] **Step 5: Verify the dev server runs**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npm run dev 2>&1 | head -20
```

Expected: server starts without errors. Navigate to `/material` route and confirm:
- Plain textarea renders in left panel (no grammar highlighting)
- File upload still works
- After analyzing a passage, G7 Suitability Panel appears first in right column
- Existing readability scores and complexity metrics still appear below

- [ ] **Step 6: Commit**

```bash
git add components/MaterialChecker.tsx
git commit -m "feat(material-checker): add G7 Suitability Panel with DepEd-anchored verdict logic"
```

---

## Post-Implementation Verification

After all 4 tasks are complete, run a final TypeScript check:

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit
```

Expected: **zero errors across the entire codebase** (not just MaterialChecker).

The 4 pre-existing TS errors that should now be gone:
- Line ~291: `Property 'score' does not exist on type 'StudentDiagnosisResult'` → `VerdictCard` removed
- Line ~822: `Property 'referenceFileName' does not exist on type 'MaterialProps'` → removed from destructuring
- Line ~823: `Property 'onSaveReference' does not exist on type 'MaterialProps'` → removed from destructuring
- Line ~1266: `Type 'TextComplexityResult' is missing properties from type 'StudentDiagnosisResult'` → `VerdictCard` usage removed
