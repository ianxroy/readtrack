# Material Library & Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add language categorization (English/Filipino) to the Material Library, improve model reasoning display, make side-by-side comparison the default, and polish the Dashboard with consistent bilingual labels and quick-action cards.

**Architecture:** One new backend endpoint reusing the existing `detect_language()` function from `grammar_service.py`. All other changes are frontend-only within two existing component files. No DB migration. Language is re-detected on load via `Promise.all`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, FastAPI (Python), langdetect (already installed)

**Spec:** `docs/superpowers/specs/2026-03-22-material-library-dashboard-redesign.md`

---

## Chunk 1: Foundation — Backend Endpoint, Frontend Service, Types

### Task 1: Add `POST /detect-language` backend endpoint

**Files:**
- Modify: `backend/main.py` (add after existing routes, around line 795+)

> **Context:** `detect_language()` already exists in `grammar_service.py` at line 130. It handles short text, `LangDetectException`, and returns `'en'` or `'tl'`. Reuse it — don't duplicate it.

- [ ] **Step 1: Add the endpoint to `main.py`**

Find the `@app.post("/analyze/complexity")` route (around line 795). Insert the new endpoint just before it:

```python
class DetectLanguageRequest(BaseModel):
    text: str

@app.post("/detect-language")
async def detect_language_endpoint(request: DetectLanguageRequest):
    try:
        from grammar_service import detect_language
        lang = detect_language(request.text)
        # Map grammar_service codes ('en'/'tl') to material library codes
        return {"language": "eng" if lang == "en" else "fil"}
    except Exception:
        return {"language": "fil"}
```

- [ ] **Step 2: Verify the endpoint works**

Start the backend if not already running:
```bash
cd /Volumes/Hanteck/Projects/readtrack/backend
uvicorn main:app --reload --port 8000
```

Test with curl:
```bash
curl -s -X POST http://localhost:8000/detect-language \
  -H "Content-Type: application/json" \
  -d '{"text": "The water cycle is a natural process that moves water through the environment."}' | python3 -m json.tool
```
Expected: `{"language": "eng"}`

```bash
curl -s -X POST http://localhost:8000/detect-language \
  -H "Content-Type: application/json" \
  -d '{"text": "Ang tubig ay isang mahalagang likas na yaman ng ating kalikasan at kapaligiran."}' | python3 -m json.tool
```
Expected: `{"language": "fil"}`

```bash
curl -s -X POST http://localhost:8000/detect-language \
  -H "Content-Type: application/json" \
  -d '{"text": "hi"}' | python3 -m json.tool
```
Expected: `{"language": "fil"}` (short text fallback)

- [ ] **Step 3: Commit**

```bash
cd /Volumes/Hanteck/Projects/readtrack
git add backend/main.py
git commit -m "feat(backend): add POST /detect-language endpoint"
```

---

### Task 2: Add `detectLanguageAPI` to frontend service

**Files:**
- Modify: `services/pythonService.ts`

- [ ] **Step 1: Add the function at the end of `services/pythonService.ts`**

```typescript
export const detectLanguageAPI = async (text: string): Promise<'eng' | 'fil'> => {
    try {
        const response = await fetch('http://localhost:8000/detect-language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) return 'fil';
        const data = await response.json();
        return data.language === 'eng' ? 'eng' : 'fil';
    } catch {
        return 'fil';
    }
};
```

- [ ] **Step 2: Verify the function is exported correctly**

Check: `grep -n "detectLanguageAPI" services/pythonService.ts`
Expected: two hits — the `export const` declaration and nothing else broken.

- [ ] **Step 3: Commit**

```bash
git add services/pythonService.ts
git commit -m "feat(service): add detectLanguageAPI for material language detection"
```

---

### Task 3: Add `language` field to `LibraryMaterial` type

**Files:**
- Modify: `types.ts` (line 130–137, the `LibraryMaterial` interface)

- [ ] **Step 1: Update the `LibraryMaterial` interface**

Current (lines 130–137):
```typescript
export interface LibraryMaterial {
  id: string;
  name: string;
  text: string;
  uploadedAt: Date;
  complexityResult: TextComplexityResult;
  originalFile?: OriginalFile;
}
```

Replace with:
```typescript
export interface LibraryMaterial {
  id: string;
  name: string;
  text: string;
  uploadedAt: Date;
  complexityResult: TextComplexityResult;
  originalFile?: OriginalFile;
  // ISO-style language code detected from material text.
  // Distinct from the Language enum ('English'/'Filipino') used elsewhere.
  // 'eng' = English, 'fil' = Filipino (default/fallback).
  language?: 'eng' | 'fil';
}
```

Note: `language` is optional (`?`) because materials loaded from Supabase won't have it until re-detection completes.

- [ ] **Step 2: Check for TypeScript errors**

```bash
cd /Volumes/Hanteck/Projects/readtrack
npx tsc --noEmit 2>&1 | head -30
```
Expected: no new errors related to `LibraryMaterial`.

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat(types): add optional language field to LibraryMaterial"
```

---

## Chunk 2: Material Library Changes

> **Context:** All changes are in `components/MaterialLibrary.tsx`. The file is ~718 lines. Key locations:
> - `levelMeta` object: lines 58–74
> - `DetailModal` component: lines 97–283 (viewMode state at line 101, reasoning at lines 206–212, side-by-side at lines 238–277)
> - `MaterialLibrary` component: lines 289–717 (filter tabs at lines 558–587, upload info banner at lines 516–520, processFile at lines 336–428)

### Task 4: Add `parseReasoning` utility function

**Files:**
- Modify: `components/MaterialLibrary.tsx` (add after `sortMaterials` function, around line 88)

- [ ] **Step 1: Add `parseReasoning` after the `sortMaterials` function (after line 88)**

```typescript
interface ReasoningResult {
  summary: string;
  tags: string[];
}

const REASONING_SUMMARIES: Record<ComplexityLevel, string> = {
  [ComplexityLevel.LITERAL]: 'This material uses simple words and short sentences that Grade 7 students can read on their own.',
  [ComplexityLevel.INFERENTIAL]: 'This material requires students to read between the lines — some teacher support may be needed.',
  [ComplexityLevel.EVALUATIVE]: 'This material uses complex ideas and language that are above Grade 7 level — scaffolding is recommended.',
};

const REASONING_KEYWORDS: Record<ComplexityLevel, Array<{ pattern: RegExp; tag: string }>> = {
  [ComplexityLevel.LITERAL]: [
    { pattern: /short.{0,10}sentence/i, tag: 'Short sentences' },
    { pattern: /common.{0,10}word|simple.{0,10}word|basic.{0,10}word/i, tag: 'Common words' },
    { pattern: /direct|explicit/i, tag: 'Direct ideas' },
    { pattern: /low.{0,10}readab|easy.{0,10}read/i, tag: 'Easy to read' },
  ],
  // Spec-defined keywords + two intentional extras per level for better coverage:
  // 'May need support' and 'Needs scaffolding' extend the spec's list deliberately.
  [ComplexityLevel.INFERENTIAL]: [
    { pattern: /impl[yi]|infer/i, tag: 'Implied meaning' },
    { pattern: /moderate/i, tag: 'Moderate vocabulary' },
    { pattern: /context.{0,10}clue/i, tag: 'Context clues needed' },
    { pattern: /some.{0,10}support|teacher.{0,10}support/i, tag: 'May need support' }, // extra
  ],
  [ComplexityLevel.EVALUATIVE]: [
    { pattern: /abstract/i, tag: 'Abstract concepts' },
    { pattern: /complex/i, tag: 'Complex structure' },
    { pattern: /advanced|difficult/i, tag: 'Advanced vocabulary' },
    { pattern: /scaffold/i, tag: 'Needs scaffolding' }, // extra
  ],
};

function parseReasoning(reasoning: string | undefined, level: ComplexityLevel): ReasoningResult {
  const summary = REASONING_SUMMARIES[level] ?? REASONING_SUMMARIES[ComplexityLevel.LITERAL];
  if (!reasoning || reasoning.trim().length === 0) {
    return { summary, tags: [] };
  }
  const keywords = REASONING_KEYWORDS[level] ?? [];
  const tags = keywords
    .filter(({ pattern }) => pattern.test(reasoning))
    .map(({ tag }) => tag)
    .slice(0, 4);
  return { summary, tags };
}
```

- [ ] **Step 2: Manually verify the function logic**

Open the browser console when the app is running and paste:
```javascript
// Quick smoke test in browser console — not a real test runner
const text = "The material uses short sentences and common words.";
console.log(text.match(/short.{0,10}sentence/i)); // expect non-null
console.log(text.match(/common.{0,10}word/i));     // expect non-null
```
Expected: both return a match array, not null.

- [ ] **Step 3: Commit**

```bash
git add components/MaterialLibrary.tsx
git commit -m "feat(material-library): add parseReasoning utility with level summaries and keyword tags"
```

---

### Task 5: Replace the reasoning box in `DetailModal`

**Files:**
- Modify: `components/MaterialLibrary.tsx` (lines 206–212, inside `DetailModal`)

- [ ] **Step 1: Replace the reasoning section**

Current (lines 206–212):
```tsx
{cr.reasoning && (
  <div className="mx-5 mt-3 bg-teal-50 border border-teal-100 rounded-xl p-4">
    <div className="text-[10px] font-bold uppercase tracking-widest text-teal-500 mb-1.5">Model Reasoning</div>
    <p className="text-xs text-teal-800 leading-relaxed">{cr.reasoning}</p>
  </div>
)}
```

Replace with:
```tsx
{(() => {
  const { summary, tags } = parseReasoning(cr.reasoning, material.complexityResult.level);
  return (
    <div className={`mx-5 mt-3 rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
      <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${meta.text}`}>
        Why is this {meta.label}?
      </div>
      <p className={`text-xs leading-relaxed mb-2 ${meta.text}`}>{summary}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <span
              key={tag}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/60 ${meta.text}`}
            >
              ✓ {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
})()}
```

- [ ] **Step 2: Verify visually**

Start the dev server (`npm run dev`), upload a material, open its detail modal. Confirm:
- A colored box appears with "Why is this Literal/Inferential/Evaluative?"
- A plain-language summary sentence is shown
- Tag pills appear below (or nothing if no keywords matched — that's fine)
- The old raw text block is gone

- [ ] **Step 3: Commit**

```bash
git add components/MaterialLibrary.tsx
git commit -m "feat(material-library): replace raw reasoning with plain language summary and tags"
```

---

### Task 6: Default side-by-side view in `DetailModal`

**Files:**
- Modify: `components/MaterialLibrary.tsx` (line 101 in `DetailModal`)

- [ ] **Step 1: Change the `viewMode` initial state**

Current (line 101):
```typescript
const [viewMode, setViewMode] = useState<'text' | 'sideBySide'>('text');
```

Replace with:
```typescript
const [viewMode, setViewMode] = useState<'text' | 'sideBySide'>(
  material.originalFile ? 'sideBySide' : 'text'
);
```

- [ ] **Step 2: Locate then update panel labels**

First, find the exact lines:
```bash
grep -n "Original File\|Scanned Text" components/MaterialLibrary.tsx
```

Then in the `viewMode === 'sideBySide'` block, change `Original File` → `Uploaded Material` and `Scanned Text` → `Extracted Text`. The surrounding div structure stays identical — only the text changes:

```tsx
// Change this text node only (keep all classNames and icons):
<IoImageOutline /> Original File
// →
<IoImageOutline /> Uploaded Material

<IoDocumentTextOutline /> Scanned Text
// →
<IoDocumentTextOutline /> Extracted Text
```

- [ ] **Step 3: Verify visually**

Upload an image or PDF. Open its detail modal. Confirm:
- Side-by-side view is shown immediately (not the text-only view)
- Left panel says "Uploaded Material", right panel says "Extracted Text"
- The "Text Only" / "Compare Original" toggle still works

- [ ] **Step 4: Commit**

```bash
git add components/MaterialLibrary.tsx
git commit -m "feat(material-library): default side-by-side view for image/PDF materials"
```

---

### Task 7: Upgrade the G7 info banner

**Files:**
- Modify: `components/MaterialLibrary.tsx` (lines 516–520, the blue info banner)

- [ ] **Step 1: Replace the banner**

Current (lines 516–520):
```tsx
<div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
  <span className="font-semibold">Complexity</span> measures if a material is readable by Grade 7 students (Literal → easy, Inferential → moderate, Evaluative → difficult).
  This is separate from student essay <span className="font-semibold">Proficiency</span> scoring.
</div>
```

Replace with:
```tsx
<div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">
    Grade 7 Readability Check (Philippines DepEd)
  </div>
  <p className="text-xs text-blue-700 leading-relaxed">
    <span className="font-semibold">Literal</span> = Easy, students can read independently.{' '}
    <span className="font-semibold">Inferential</span> = Borderline, may need teacher support.{' '}
    <span className="font-semibold">Evaluative</span> = Above G7, not recommended without scaffolding.
  </p>
</div>
```

- [ ] **Step 2: Verify visually**

Check the Material Library page. The blue banner should now have a bold uppercase heading above the description text.

- [ ] **Step 3: Commit**

```bash
git add components/MaterialLibrary.tsx
git commit -m "feat(material-library): upgrade G7 info banner with DepEd heading"
```

---

### Task 8: Language detection — upload + load + filter tabs

**Files:**
- Modify: `components/MaterialLibrary.tsx`

> This is the largest single task. Read through the full `MaterialLibrary` component before editing (lines 289–717).

- [ ] **Step 1: Add the import for `detectLanguageAPI`**

At the top of `MaterialLibrary.tsx`, in the existing import from `'../services/pythonService'` (line 17):

Current:
```typescript
import { classifyTextComplexityAPI, extractTextFromImageAPI } from '../services/pythonService';
```

Replace with:
```typescript
import { classifyTextComplexityAPI, extractTextFromImageAPI, detectLanguageAPI } from '../services/pythonService';
```

- [ ] **Step 2: Add language filter state**

Inside `MaterialLibrary`, after the existing `const [showSortMenu, setShowSortMenu] = useState(false);` line (~line 299), add:

```typescript
const [langFilter, setLangFilter] = useState<'all' | 'eng' | 'fil'>('all');
```

- [ ] **Step 3: Detect language on upload — inside `processFile`**

Inside `processFile`, after the material object is built (after line 406 `const material: LibraryMaterial = { ... }`), add language detection before `persist`:

```typescript
// Detect language for the new material
const detectedLang = await detectLanguageAPI(extractedText);
const materialWithLang: LibraryMaterial = { ...material, language: detectedLang };

persist([materialWithLang, ...materials]);
```

Replace the existing `persist([material, ...materials]);` with this block. Make sure the rest of the function uses `material` (not `materialWithLang`) for the Supabase save — we are not saving language to DB.

- [ ] **Step 4: Re-detect language on load — after `loadMaterialUploads`**

Replace the existing `useEffect` (lines 303–312):

```typescript
useEffect(() => {
  let cancelled = false;
  loadMaterialUploads().then(async ({ data, error }) => {
    if (!cancelled) {
      if (!error && data.length > 0) {
        // Re-detect language for all loaded materials in parallel
        const langs = await Promise.all(data.map(m => detectLanguageAPI(m.text)));
        const withLangs = data.map((m, i) => ({ ...m, language: langs[i] }));
        setMaterials(withLangs);
      } else if (!error) {
        setMaterials(data);
      }
      setMaterialsLoading(false);
    }
  });
  return () => { cancelled = true; };
}, []);
```

- [ ] **Step 5: Update `refreshMaterials` to also re-detect**

Replace the existing `refreshMaterials` function (lines 314–317):

```typescript
const refreshMaterials = async () => {
  const { data, error } = await loadMaterialUploads();
  if (error) return; // keep current state on error, same as original
  if (data.length > 0) {
    const langs = await Promise.all(data.map(m => detectLanguageAPI(m.text)));
    setMaterials(data.map((m, i) => ({ ...m, language: langs[i] })));
  } else {
    setMaterials(data);
  }
};
```

- [ ] **Step 6: Update the `displayed` filter to include `langFilter`**

Current filter (lines 448–455):
```typescript
const displayed = sortMaterials(
  materials.filter(m => {
    if (filter !== 'all' && m.complexityResult.level !== filter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }),
  sort
);
```

Replace with:
```typescript
const displayed = sortMaterials(
  materials.filter(m => {
    if (filter !== 'all' && m.complexityResult.level !== filter) return false;
    if (langFilter !== 'all' && m.language !== langFilter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }),
  sort
);
```

- [ ] **Step 7: Add language counts**

After the existing `counts` object (around line 465), add:
```typescript
const langCounts = {
  eng: materials.filter(m => m.language === 'eng').length,
  fil: materials.filter(m => m.language === 'fil').length,
};
```

- [ ] **Step 8: Add language filter tabs to the UI**

Find the filter tabs section (lines 558–587). Replace with:

```tsx
{/* Filter tabs */}
<div className="flex gap-2 flex-wrap items-center">
  {/* Language filters */}
  {([
    { key: 'all' as const, label: 'All', count: materials.length }, // total, not complexity-filtered count
    { key: 'eng' as const, label: '🇬🇧 English', count: langCounts.eng },
    { key: 'fil' as const, label: '🇵🇭 Filipino', count: langCounts.fil },
  ]).map(({ key, label, count }) => (
    <button
      key={key}
      onClick={() => setLangFilter(key)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
        langFilter === key
          ? 'bg-teal-50 text-teal-700 border-teal-200'
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
      }`}
    >
      {label}
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${langFilter === key ? 'bg-white/60' : 'bg-gray-100'}`}>
        {count}
      </span>
    </button>
  ))}

  {/* Divider */}
  <div className="w-px h-5 bg-gray-200 mx-1" />

  {/* Complexity filters */}
  {([
    { key: 'all' as const, label: 'All', meta: null },
    { key: ComplexityLevel.LITERAL, label: 'Literal', meta: levelMeta[ComplexityLevel.LITERAL] },
    { key: ComplexityLevel.INFERENTIAL, label: 'Inferential', meta: levelMeta[ComplexityLevel.INFERENTIAL] },
    { key: ComplexityLevel.EVALUATIVE, label: 'Evaluative', meta: levelMeta[ComplexityLevel.EVALUATIVE] },
  ]).map(({ key, label, meta: m }) => {
    const count = counts[key];
    const isActive = filter === key;
    return (
      <button
        key={key}
        onClick={() => setFilter(key)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
          isActive
            ? m ? `${m.bg} ${m.text} ${m.border}` : 'bg-teal-50 text-teal-700 border-teal-200'
            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
        }`}
      >
        {m && <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />}
        {label}
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/60' : 'bg-gray-100'}`}>
          {count}
        </span>
      </button>
    );
  })}
</div>
```

- [ ] **Step 9: Add language tag to material cards**

Inside the card grid (around line 657, inside the `displayed.map`), find the badge row that shows the complexity level badge. Add the language tag directly after it:

```tsx
{/* After the existing level badge div */}
{mat.language && (
  <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
    mat.language === 'eng'
      ? 'bg-blue-50 text-blue-600 border-blue-100'
      : 'bg-purple-50 text-purple-600 border-purple-100'
  }`}>
    {mat.language === 'eng' ? '🇬🇧 EN' : '🇵🇭 FIL'}
  </span>
)}
```

Also add the language tag to `DetailModal`'s header (around line 122, after the level badge):
```tsx
{material.language && (
  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
    material.language === 'eng'
      ? 'bg-blue-50 text-blue-600 border-blue-100'
      : 'bg-purple-50 text-purple-600 border-purple-100'
  }`}>
    {material.language === 'eng' ? '🇬🇧 English' : '🇵🇭 Filipino'}
  </span>
)}
```

- [ ] **Step 10: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 11: Verify visually**

1. Open the Material Library page — existing materials should show language tags after the spinner resolves
2. Upload an English text file — card should show `🇬🇧 EN`
3. Upload a Filipino text file — card should show `🇵🇭 FIL`
4. Click `🇬🇧 English` filter — only English materials shown
5. Click `🇵🇭 Filipino` filter — only Filipino materials shown
6. Open a material detail — language tag appears in header

- [ ] **Step 12: Commit**

```bash
git add components/MaterialLibrary.tsx services/pythonService.ts
git commit -m "feat(material-library): add language detection, filter tabs, and language tags on cards"
```

---

## Chunk 3: Dashboard Changes

> **Context:** All changes are in `components/Dashboard.tsx`. Key locations:
> - `DistributionChart` component: lines 53–77 (inline, not a separate file)
> - `DistributionRow` interface: lines 46–51
> - Dashboard hero section: lines 188–208
> - Charts section: lines 210–221
> - Tool cards section: lines 223–242
> - Legend section: lines 244–248

### Task 9: Add `subtitle` prop to `MetricCard`

**Files:**
- Modify: `components/Dashboard.tsx` (lines 32–44, the `MetricCard` component)

> **Do this before Task 10** — Task 10 passes a `subtitle` prop to `MetricCard`. Without this step TypeScript will error.

- [ ] **Step 1: Add `subtitle` to `MetricCardProps`**

Current (lines 32–36):
```typescript
interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}
```

The `subtitle` prop already exists on `MetricCardProps` (line 35) — verify with:
```bash
grep -n "subtitle" components/Dashboard.tsx | head -10
```

If `subtitle?: string` is already there and the render already shows `{subtitle && ...}`, this task is already done — skip to Task 10. If the prop is missing, add it now.

- [ ] **Step 2: Commit if changed**

```bash
git add components/Dashboard.tsx
git commit -m "feat(dashboard): ensure MetricCard accepts subtitle prop"
```

---

### Task 10: Update `DistributionChart` and row labels

**Files:**
- Modify: `components/Dashboard.tsx`

- [ ] **Step 1: Update `DistributionRow` to accept `React.ReactNode` label**

Current (lines 46–51):
```typescript
interface DistributionRow {
  label: string;
  count: number;
  colorClass: string;
  bgClass: string;
}
```

Replace with:
```typescript
interface DistributionRow {
  label: React.ReactNode;
  count: number;
  colorClass: string;
  bgClass: string;
}
```

- [ ] **Step 2: Add `subtitle` prop to `DistributionChart`**

Current `DistributionChart` signature (line 53–57):
```typescript
const DistributionChart: React.FC<{
  title: string;
  rows: DistributionRow[];
  total: number;
}> = ({ title, rows, total }) => (
```

Replace with:
```typescript
const DistributionChart: React.FC<{
  title: string;
  subtitle?: string;
  rows: DistributionRow[];
  total: number;
}> = ({ title, subtitle, rows, total }) => (
```

- [ ] **Step 3: Render the subtitle inside `DistributionChart`**

Current title line inside the component (line 59):
```tsx
<div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-3">{title}</div>
```

Replace with:
```tsx
<div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{title}</div>
{subtitle && (
  <div className="text-xs text-gray-500 mt-0.5 mb-3">{subtitle}</div>
)}
{!subtitle && <div className="mb-3" />}
```

- [ ] **Step 4: Update proficiency row labels to bilingual**

Current `proficiencyRows` (lines 132–151):
```typescript
const proficiencyRows: DistributionRow[] = [
  { label: ProficiencyLevel.NAGSISIMULA, colorClass: "bg-red-500", bgClass: "bg-red-50", ... },
  { label: ProficiencyLevel.PAPAUNLAD, colorClass: "bg-orange-500", bgClass: "bg-orange-50", ... },
  { label: ProficiencyLevel.MAHUSAY, colorClass: "bg-teal-500", bgClass: "bg-teal-50", ... },
];
```

Replace each `label` string with a JSX node (keep `count`, `colorClass`, `bgClass` as-is):
```typescript
const proficiencyRows: DistributionRow[] = [
  {
    label: <><span className="font-bold text-gray-700">Beginning</span><span className="text-[10px] text-gray-400 font-normal"> · Nagsisimula</span></>,
    count: analytics.proficiencyCounts[ProficiencyLevel.NAGSISIMULA],
    colorClass: "bg-red-500",
    bgClass: "bg-red-50",
  },
  {
    label: <><span className="font-bold text-gray-700">Developing</span><span className="text-[10px] text-gray-400 font-normal"> · Papaunlad</span></>,
    count: analytics.proficiencyCounts[ProficiencyLevel.PAPAUNLAD],
    colorClass: "bg-orange-500",
    bgClass: "bg-orange-50",
  },
  {
    label: <><span className="font-bold text-gray-700">Proficient</span><span className="text-[10px] text-gray-400 font-normal"> · Mahusay</span></>,
    count: analytics.proficiencyCounts[ProficiencyLevel.MAHUSAY],
    colorClass: "bg-teal-500",
    bgClass: "bg-teal-50",
  },
];
```

- [ ] **Step 5: Update complexity row labels similarly**

```typescript
const complexityRows: DistributionRow[] = [
  {
    label: <><span className="font-bold text-gray-700">Literal</span><span className="text-[10px] text-gray-400 font-normal"> · Easy, G7 Readable</span></>,
    count: analytics.complexityCounts[ComplexityLevel.LITERAL],
    colorClass: "bg-green-500",
    bgClass: "bg-green-50",
  },
  {
    label: <><span className="font-bold text-gray-700">Inferential</span><span className="text-[10px] text-gray-400 font-normal"> · Moderate, Borderline</span></>,
    count: analytics.complexityCounts[ComplexityLevel.INFERENTIAL],
    colorClass: "bg-orange-500",
    bgClass: "bg-orange-50",
  },
  {
    label: <><span className="font-bold text-gray-700">Evaluative</span><span className="text-[10px] text-gray-400 font-normal"> · Difficult, Above G7</span></>,
    count: analytics.complexityCounts[ComplexityLevel.EVALUATIVE],
    colorClass: "bg-red-500",
    bgClass: "bg-red-50",
  },
];
```

- [ ] **Step 6: Pass subtitles to `DistributionChart` calls**

Find the two `<DistributionChart` usages (around lines 211–220). Add `subtitle` props:

```tsx
<DistributionChart
  title="Essay Proficiency"
  subtitle="How well are your students writing?"
  rows={proficiencyRows}
  total={analytics.totalEssays}
/>
<DistributionChart
  title="Material Complexity"
  subtitle="Are your materials right for Grade 7 students?"
  rows={complexityRows}
  total={analytics.totalMaterials}
/>
```

- [ ] **Step 7: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat(dashboard): bilingual chart labels and chart subtitles"
```

---

### Task 10: Dashboard hero subtitle and metric subtitles

**Files:**
- Modify: `components/Dashboard.tsx`

- [ ] **Step 1: Add subtitle below "Dashboard Overview" h1**

Find the hero section (around line 194):
```tsx
<h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
  Dashboard Overview
</h1>
```

Add a subtitle directly after:
```tsx
<h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
  Dashboard Overview
</h1>
<p className="text-sm text-gray-400 mt-1">
  Grade 7 Reading Complexity &amp; Proficiency Tracker
</p>
```

- [ ] **Step 2: Add subtitles to Essays and Materials metric cards**

Find the metric cards section (around lines 202–205). Update `Essays` and `Materials`:
```tsx
<MetricCard label="Students" value={analytics.totalStudents} />
<MetricCard label="Essays" value={analytics.totalEssays} subtitle={`${analytics.ratedEssays} rated`} />
<MetricCard label="Materials" value={analytics.totalMaterials} subtitle="uploaded to library" />
<MetricCard label="Avg Teacher Rating" value={analytics.avgTeacherRating} subtitle={`${analytics.ratedEssays} rated`} />
```

Wait — `Essays` should say `submitted for scoring`. The existing `subtitle` on `Avg Teacher Rating` is already `${analytics.ratedEssays} rated`. Update only `Essays`:
```tsx
<MetricCard label="Essays" value={analytics.totalEssays} subtitle="submitted for scoring" />
<MetricCard label="Materials" value={analytics.totalMaterials} subtitle="uploaded to library" />
```

- [ ] **Step 3: Verify visually**

Load the Dashboard. Confirm:
- "Grade 7 Reading Complexity & Proficiency Tracker" subtitle appears under "Dashboard Overview"
- Essays card shows "submitted for scoring" below the number
- Materials card shows "uploaded to library" below the number

- [ ] **Step 4: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat(dashboard): add hero subtitle and metric card subtitles"
```

---

### Task 11: Replace ToolCards with quick-action cards and update legend

**Files:**
- Modify: `components/Dashboard.tsx`

- [ ] **Step 1: Replace the ToolCard section**

Find the ToolCard grid section (lines 223–242):
```tsx
<section className="grid sm:grid-cols-2 gap-4">
  <ToolCard title="Material Library" ... />
  <ToolCard title="Essay Scoring" ... />
</section>
```

Replace with:
```tsx
<section className="grid sm:grid-cols-2 gap-4">
  <div className="flex flex-col items-start p-6 bg-white border border-gray-100 rounded-2xl shadow-sm gap-3">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl bg-blue-50">📚</div>
    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Complexity</span>
    <div>
      <h3 className="text-sm font-bold text-gray-800 mb-1">Upload a Material</h3>
      <p className="text-xs text-gray-400 leading-relaxed">Check if a reading material is appropriate for Grade 7 students.</p>
    </div>
    <button
      onClick={() => navigate("/material")}
      className="mt-auto w-full py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors"
    >
      Go to Material Library →
    </button>
  </div>
  <div className="flex flex-col items-start p-6 bg-white border border-gray-100 rounded-2xl shadow-sm gap-3">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl bg-teal-50">📝</div>
    <span className="text-[10px] font-bold uppercase tracking-widest text-teal-500">Proficiency</span>
    <div>
      <h3 className="text-sm font-bold text-gray-800 mb-1">Grade an Essay</h3>
      <p className="text-xs text-gray-400 leading-relaxed">Score a student essay and estimate their reading proficiency level.</p>
    </div>
    <button
      onClick={() => navigate("/student")}
      className="mt-auto w-full py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors"
    >
      Go to Essay Scoring →
    </button>
  </div>
</section>
```

The `ToolCard` component and `ToolCardProps` interface (lines 6–30) are now unused and must be deleted. Remove lines 6–30 (the full `ToolCardProps` interface and `ToolCard` component definition).

- [ ] **Step 2: Update the legend section**

Find the legend (lines 244–248):
```tsx
<section className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm text-xs text-gray-500 leading-relaxed">
  <span className="font-semibold text-blue-600">Complexity</span> — measures if a reading material is G7-readable.&nbsp;
  <span className="font-semibold text-teal-600">Proficiency</span> — measures a student's writing quality and scores their essay.
  These are two separate models. See <button onClick={() => navigate("/about")} className="underline text-teal-500 hover:text-teal-600">About</button> for details.
</section>
```

Replace with:
```tsx
<section className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">How to read this dashboard</div>
  <p className="text-xs text-gray-500 leading-relaxed">
    <span className="font-semibold text-blue-600">Complexity</span> — measures if a reading material is G7-readable.{' '}
    <span className="font-semibold text-teal-600">Proficiency</span> — measures a student's writing quality. These are two separate AI models.{' '}
    See <button onClick={() => navigate("/about")} className="underline text-teal-500 hover:text-teal-600">About</button> for details.
  </p>
</section>
```

- [ ] **Step 3: Delete unused `ToolCard` component and check TypeScript**

Delete lines 6–30 from `Dashboard.tsx` (the `ToolCardProps` interface and `ToolCard` component — confirmed unused after Step 1).

Then verify:
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Verify visually**

Load Dashboard. Confirm:
- Two action cards with emoji, badge, title, description, and teal button
- Legend shows "How to read this dashboard" heading
- No console errors

- [ ] **Step 5: Final commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat(dashboard): replace tool cards with quick-action cards and update legend"
```

---

## Final Verification Checklist

- [ ] Backend `/detect-language` endpoint responds correctly for English, Filipino, and short text
- [ ] Material Library: new materials get language tag immediately after upload
- [ ] Material Library: existing materials get language tags after page reload (brief spinner)
- [ ] Material Library: language filter tabs work independently of complexity filter tabs
- [ ] Material Library: side-by-side is the default view for image/PDF materials
- [ ] Material Library: "Why is this X?" reasoning box shows plain summary + tags
- [ ] Material Library: G7 banner has bold heading
- [ ] Dashboard: "Grade 7 Reading Complexity & Proficiency Tracker" subtitle visible
- [ ] Dashboard: "submitted for scoring" and "uploaded to library" metric subtitles visible
- [ ] Dashboard: Chart subtitles visible below chart titles
- [ ] Dashboard: **Beginning** · Nagsisimula (and equivalents) in both charts
- [ ] Dashboard: Quick-action cards with buttons navigate correctly
- [ ] Dashboard: "How to read this dashboard" legend heading visible
- [ ] `npx tsc --noEmit` passes with no new errors
