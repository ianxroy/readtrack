# Algorithm Visualizer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `diagrams/algorithm-visualizer.html` — a standalone single-file HTML page that walks through the ReadTrack NLP pipeline step-by-step for thesis defense presentation.

**Architecture:** Single vanilla HTML/CSS/JS file. No framework, no build step. Calls FastAPI backend at `http://localhost:8000`. Six sections stacked vertically: essay input → feature extraction → formula walkthrough → DepEd verdict + sliders → teacher feedback loop → teacher rubric scorer with live retrain.

**Tech Stack:** Vanilla HTML5, CSS3, ES6+ JS (fetch, async/await, Set), FastAPI backend at `http://localhost:8000`

**Spec:** `docs/superpowers/specs/2026-04-05-algorithm-visualizer-design.md`

---

## Chunk 1: Scaffold + Section 1 (Input + Analyze)

### Task 1: Page Scaffold

**Files:**
- Create: `diagrams/algorithm-visualizer.html`

- [ ] **Step 1: Create the HTML skeleton**

Create `diagrams/algorithm-visualizer.html` with this exact content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ReadTrack — Algorithm Visualizer</title>
<style>
/* ── Reset ── */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f4f6fb; color: #1a1a2e; font-size: 13px; line-height: 1.5; }

/* ── Page Header ── */
.page-header {
  background: linear-gradient(135deg, #1a237e 0%, #1565c0 100%);
  color: white; padding: 20px 32px;
  display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.page-header h1 { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; }
.page-header .tagline { font-size: 11px; opacity: 0.75; margin-top: 2px; }
.backend-badge {
  padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 600;
  border: 1px solid rgba(255,255,255,0.4);
}
.backend-badge.connected { background: rgba(76,175,80,0.25); }
.backend-badge.disconnected { background: rgba(244,67,54,0.25); }

/* ── Container ── */
.container { max-width: 1100px; margin: 0 auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 20px; }

/* ── Section Cards ── */
.section-card {
  background: white; border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden;
}
.section-header {
  padding: 13px 20px; display: flex; align-items: center; gap: 12px;
  border-bottom: 1px solid #eef0f5;
}
.section-number {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; color: white;
}
.section-title { font-size: 14px; font-weight: 600; }
.section-subtitle { font-size: 11px; color: #666; margin-top: 1px; }
.section-body { padding: 18px 20px; }

/* Section accent colors */
.s1 .section-number { background: #1565c0; }
.s1 .section-header { border-left: 4px solid #1565c0; }
.s2 .section-number { background: #2e7d32; }
.s2 .section-header { border-left: 4px solid #2e7d32; }
.s3 .section-number { background: #6a1b9a; }
.s3 .section-header { border-left: 4px solid #6a1b9a; }
.s4 .section-number { background: #e65100; }
.s4 .section-header { border-left: 4px solid #e65100; }
.s5 .section-number { background: #00695c; }
.s5 .section-header { border-left: 4px solid #00695c; }
.s6 .section-number { background: #4527a0; }
.s6 .section-header { border-left: 4px solid #4527a0; }

/* ── Error Banner ── */
.error-banner {
  background: #ffebee; border: 1px solid #ef9a9a; border-radius: 8px;
  padding: 12px 16px; margin-bottom: 16px; display: none;
  font-size: 12px; color: #c62828;
}
.error-banner.visible { display: block; }

/* ── Loading Spinner ── */
.spinner {
  display: inline-block; width: 16px; height: 16px; vertical-align: middle;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
  border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 6px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Footer ── */
.page-footer { text-align: center; padding: 20px; color: #aaa; font-size: 11px; }
</style>
</head>
<body>

<div class="page-header">
  <div>
    <h1>ReadTrack — Algorithm Visualizer</h1>
    <div class="tagline">Step-by-step: how a student essay is analyzed, scored, and classified</div>
  </div>
  <div class="backend-badge disconnected" id="backendBadge">⬤ Checking backend…</div>
</div>

<div class="container" id="main">
  <!-- Sections injected by JS -->
  <div class="error-banner" id="globalError"></div>
</div>

<div class="page-footer">ReadTrack Algorithm Visualizer · Thesis Defense Reference · 2026</div>

<script>
// ── Backend base URL ──
const API = 'http://localhost:8000';

// ── State ──
let analysisResult = null;   // POST /analyze/student response
let complexityResult = null; // POST /analyze/complexity response

// ── Backend connectivity check ──
async function checkBackend() {
  const badge = document.getElementById('backendBadge');
  try {
    const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      badge.textContent = '● Connected to backend';
      badge.className = 'backend-badge connected';
      return true;
    }
  } catch (_) {}
  badge.textContent = '✕ Backend offline';
  badge.className = 'backend-badge disconnected';
  showGlobalError(`Backend unreachable at ${API}. Start the backend with: cd backend && uvicorn main:app --reload --port 8000`);
  return false;
}

function showGlobalError(msg) {
  const el = document.getElementById('globalError');
  el.textContent = msg;
  el.classList.add('visible');
}
function hideGlobalError() {
  document.getElementById('globalError').classList.remove('visible');
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  checkBackend();
  renderSections();
});
</script>
</body>
</html>
```

- [ ] **Step 2: Verify scaffold in browser**

Open `diagrams/algorithm-visualizer.html` directly in a browser. Verify:
- Deep blue gradient header appears with title
- Backend badge shows "Checking backend…" then switches to "✕ Backend offline" (since backend isn't running yet)
- Page has white background, footer text visible
- No JS console errors

- [ ] **Step 3: Commit scaffold**

```bash
cd /Volumes/Hanteck/Projects/readtrack
git add diagrams/algorithm-visualizer.html
git commit -m "feat(visualizer): scaffold page shell with header and backend connectivity check"
```

---

### Task 2: Section 1 — Essay Input

**Files:**
- Modify: `diagrams/algorithm-visualizer.html`

- [ ] **Step 1: Add Section 1 CSS**

Inside the `<style>` block, before the closing `</style>`, add:

```css
/* ── Section 1: Input ── */
.essay-textarea {
  width: 100%; border: 1px solid #d0d5e8; border-radius: 8px;
  padding: 12px; font-size: 13px; font-family: inherit;
  resize: vertical; min-height: 110px; background: #fafbff;
  transition: border-color 0.2s;
}
.essay-textarea:focus { outline: none; border-color: #1565c0; box-shadow: 0 0 0 3px rgba(21,101,192,0.1); }

.input-row { display: flex; align-items: center; gap: 12px; margin-top: 10px; flex-wrap: wrap; }
.btn-primary {
  background: #1565c0; color: white; border: none; border-radius: 8px;
  padding: 10px 24px; font-size: 13px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; transition: background 0.2s;
}
.btn-primary:hover { background: #1976d2; }
.btn-primary:disabled { background: #90a4ae; cursor: not-allowed; }

.lang-badge {
  background: #e3f2fd; color: #1565c0; border-radius: 12px;
  padding: 4px 12px; font-size: 11px; font-weight: 600;
}
.api-note { font-size: 10px; color: #aaa; font-family: monospace; }
.section-error { background: #ffebee; color: #c62828; border-radius: 6px; padding: 8px 12px; font-size: 12px; margin-top: 10px; display: none; }
.section-error.visible { display: block; }
```

- [ ] **Step 2: Add `renderSections()` and Section 1 HTML**

Replace the `// Bootstrap` comment block (keep the two lines above it) and the `renderSections()` call. Add just before `</script>`:

```javascript
function renderSections() {
  const main = document.getElementById('main');
  main.insertAdjacentHTML('beforeend', buildSection1());
}

function buildSection1() {
  return `
  <div class="section-card s1" id="sec1">
    <div class="section-header">
      <div class="section-number">1</div>
      <div>
        <div class="section-title">Student Essay Input</div>
        <div class="section-subtitle">Enter or paste a student essay — plain text, OCR from image, or extracted from PDF</div>
      </div>
    </div>
    <div class="section-body">
      <textarea class="essay-textarea" id="essayInput" placeholder="Paste student essay here…">The sun sets slowly behind the mountains. Birds fly home as darkness comes. Children run to their houses. The air gets cold and quiet. Stars begin to appear in the sky above.</textarea>
      <div class="input-row">
        <button class="btn-primary" id="analyzeBtn" onclick="runAnalysis()">
          ▶ Analyze Essay
        </button>
        <span class="lang-badge" id="langBadge">🌐 Language: —</span>
        <span class="api-note">POST /analyze/student · POST /analyze/complexity</span>
      </div>
      <div class="section-error" id="sec1Error"></div>
    </div>
  </div>`;
}

async function runAnalysis() {
  const text = document.getElementById('essayInput').value.trim();
  if (!text) return;

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Analyzing…';
  document.getElementById('sec1Error').classList.remove('visible');
  hideGlobalError();

  try {
    const [studentRes, complexityRes] = await Promise.allSettled([
      fetch(`${API}/analyze/student`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      }).then(r => r.json()),
      fetch(`${API}/analyze/complexity`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      }).then(r => r.json())
    ]);

    const studentOk = studentRes.status === 'fulfilled' && !studentRes.value.error;
    const complexityOk = complexityRes.status === 'fulfilled' && !complexityRes.value.error;

    if (studentOk) {
      analysisResult = studentRes.value;
      document.getElementById('langBadge').textContent =
        `🌐 Language: ${detectLangLabel(text)}`;
    }
    if (complexityOk) {
      complexityResult = complexityRes.value;
    }

    if (!studentOk && !complexityOk) {
      const err = document.getElementById('sec1Error');
      err.textContent = 'Analysis failed — backend returned an error. Is the backend running?';
      err.classList.add('visible');
    } else if (!complexityOk) {
      showGlobalError('Complexity analysis unavailable — backend error. Sections 3–4 may be incomplete.');
    } else if (!studentOk) {
      showGlobalError('Proficiency analysis unavailable — backend error. Proficiency verdict will show —.');
    }

    renderResults();
  } catch (e) {
    const err = document.getElementById('sec1Error');
    err.textContent = `Network error: ${e.message}. Start backend with: uvicorn main:app --reload --port 8000`;
    err.classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '▶ Analyze Essay';
  }
}

// Language is not returned by the API — infer from essay text using simple heuristic
function detectLangLabel(essayText) {
  const filipino = ['ang','ng','na','sa','ay','mga','ko','mo','niya','namin','kayo','sila','ito','iyan'];
  const words = (essayText || '').toLowerCase().match(/\b\w+\b/g) || [];
  const filCount = words.filter(w => filipino.includes(w)).length;
  return filCount >= 3 ? 'Filipino (TL)' : 'English (EN)';
}

// Stub builders — replaced when Chunks 2–4 are applied
function buildSection2() { return ''; }
function buildSection3() { return ''; }
function buildSection4() { return ''; }
function buildSection5() { return ''; }
function buildSection6() { return ''; }
function loadTrainStatus() {}

function renderResults() {
  // Remove and re-render Sections 2–6 after each analysis
  ['sec2','sec3','sec4','sec5','sec6'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  const main = document.getElementById('main');
  // Render with whatever data is available — at least one API call must have succeeded
  if (complexityResult || analysisResult) {
    main.insertAdjacentHTML('beforeend', buildSection2());
    main.insertAdjacentHTML('beforeend', buildSection3());
    main.insertAdjacentHTML('beforeend', buildSection4());
    main.insertAdjacentHTML('beforeend', buildSection5());
    main.insertAdjacentHTML('beforeend', buildSection6());
    loadTrainStatus();
    setTimeout(() => { if (document.getElementById('sl-asl')) updateSliders(); }, 0);
  }
}
```

- [ ] **Step 3: Verify Section 1 in browser**

Open the file. Verify:
- Textarea shows pre-filled sample essay
- "Analyze Essay" button is visible and blue
- Clicking with no backend running shows a red error in Section 1 (not a crash)
- Language badge shows "—" until analysis completes

- [ ] **Step 4: Commit**

```bash
git add diagrams/algorithm-visualizer.html
git commit -m "feat(visualizer): add section 1 essay input with parallel API calls and error handling"
```

---

## Chunk 2: Sections 2 & 3 (Features + Formulas)

### Task 3: Section 2 — Feature Extraction Grid

**Files:**
- Modify: `diagrams/algorithm-visualizer.html`

- [ ] **Step 1: Add Section 2 CSS**

Inside `<style>`, append:

```css
/* ── Section 2: Feature Grid ── */
.feature-legend { display: flex; gap: 14px; margin-bottom: 12px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

.feature-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
@media (max-width: 800px) { .feature-grid { grid-template-columns: repeat(2, 1fr); } }

.feature-chip {
  border-radius: 8px; padding: 9px 11px;
  border: 1px solid #e0e4f0; transition: transform 0.15s;
}
.feature-chip:hover { transform: translateY(-1px); }
.feature-chip .fname { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #555; }
.feature-chip .fval { font-size: 17px; font-weight: 800; margin-top: 2px; font-variant-numeric: tabular-nums; }
.feature-chip .fdesc { font-size: 10px; color: #888; margin-top: 1px; }
.feature-chip.server-only { opacity: 0.55; }
.feature-chip.server-only .fval { font-size: 12px; font-style: italic; color: #aaa; }

/* Category colors */
.fc-vocab  { background: #e8f5e9; border-color: #a5d6a7; }
.fc-vocab  .fval { color: #2e7d32; }
.fc-syntax { background: #e3f2fd; border-color: #90caf9; }
.fc-syntax .fval { color: #1565c0; }
.fc-cefr   { background: #f3e5f5; border-color: #ce93d8; }
.fc-cefr   .fval { color: #6a1b9a; }
.fc-read   { background: #fff3e0; border-color: #ffcc80; }
.fc-read   .fval { color: #e65100; }
```

- [ ] **Step 2: Add `buildSection2()` function**

Add this function before the closing `</script>`:

```javascript
function buildSection2() {
  const m = complexityResult?.metrics || {};
  const cefr = m.cefrDistribution || {};
  const wc = m.wordCount || 1;
  const ri = m.readabilityIndices || {};

  // Computed values from API
  const ttr = m.vocabularyRichness != null ? m.vocabularyRichness.toFixed(3) : '—';
  const asl = m.avgSentenceLength != null ? m.avgSentenceLength.toFixed(1) : '—';
  const dwr = m.difficultWordRatio != null ? (m.difficultWordRatio).toFixed(1) + '%' : '—';
  const advRatio = m.advancedWordCount != null ? (m.advancedWordCount / wc).toFixed(3) : '—';
  const fk  = ri.flesch_kincaid != null ? ri.flesch_kincaid.toFixed(1) : '—';
  const fog = ri.gunning_fog    != null ? ri.gunning_fog.toFixed(1)    : '—';

  const cefrPct = (key) => cefr[key] != null ? ((cefr[key]/wc)*100).toFixed(1)+'%' : '—';
  const basicPct = (cefr.A1||0) + (cefr.A2||0);
  const indPct   = (cefr.B1||0) + (cefr.B2||0);
  const profPct  = (cefr.C1||0) + (cefr.C2||0);

  const chips = [
    { cat:'fc-vocab',  name:'TTR',              val: ttr,       desc:'Unique / total words' },
    { cat:'fc-syntax', name:'Avg Sent Length',  val: asl,       desc:'Words per sentence' },
    { cat:'fc-read',   name:'Difficult Word %', val: dwr,       desc:'≥ 3 syllables' },
    { cat:'fc-cefr',   name:'Adv CEFR Ratio',   val: advRatio,  desc:'C1/C2 word fraction' },
    { cat:'fc-cefr',   name:'CEFR A1',           val: cefrPct('A1'), desc:'Basic' },
    { cat:'fc-cefr',   name:'CEFR A2',           val: cefrPct('A2'), desc:'Elementary' },
    { cat:'fc-cefr',   name:'CEFR B1',           val: cefrPct('B1'), desc:'Intermediate' },
    { cat:'fc-cefr',   name:'CEFR B2',           val: cefrPct('B2'), desc:'Upper-Intermediate' },
    { cat:'fc-cefr',   name:'CEFR C1',           val: cefrPct('C1'), desc:'Advanced' },
    { cat:'fc-cefr',   name:'CEFR C2',           val: cefrPct('C2'), desc:'Mastery' },
    { cat:'fc-syntax', name:'Verb Ratio',         val: 'spaCy',   desc:'Verb tokens / total', serverOnly: true },
    { cat:'fc-syntax', name:'Noun Ratio',         val: 'spaCy',   desc:'Noun tokens / total', serverOnly: true },
    { cat:'fc-syntax', name:'Adj Ratio',          val: 'spaCy',   desc:'Adj tokens / total',  serverOnly: true },
    { cat:'fc-syntax', name:'Clause Density',     val: 'spaCy',   desc:'Verbs / sentences',   serverOnly: true },
    { cat:'fc-syntax', name:'Structure Score',    val: 'spaCy',   desc:'(CD×10)+(ASL×2)',      serverOnly: true },
    { cat:'fc-syntax', name:'Sent Complexity',    val: 'spaCy',   desc:'ASL × 4, cap 100',    serverOnly: true },
    { cat:'fc-syntax', name:'Avg Dep Distance',   val: 'spaCy',   desc:'Syntax tree depth',   serverOnly: true },
    { cat:'fc-read',   name:'Flesch-Kincaid',     val: fk,        desc:'Grade level' },
    { cat:'fc-read',   name:'Gunning Fog',        val: fog,       desc:'Years education needed' },
    { cat:'fc-syntax', name:'Punct Density',      val: 'spaCy',   desc:'Punctuation / total', serverOnly: true },
    { cat:'fc-syntax', name:'Sent Len StdDev',    val: 'spaCy',   desc:'Sentence "burstiness"', serverOnly: true },
    { cat:'fc-cefr',   name:'% Basic CEFR',       val: wc > 0 ? ((basicPct/wc)*100).toFixed(1)+'%' : '—', desc:'A1–A2 words' },
    { cat:'fc-cefr',   name:'% Independent',      val: wc > 0 ? ((indPct/wc)*100).toFixed(1)+'%'   : '—', desc:'B1–B2 words' },
    { cat:'fc-cefr',   name:'% Proficient',       val: wc > 0 ? ((profPct/wc)*100).toFixed(1)+'%'  : '—', desc:'C1–C2 words' },
  ];

  const chipHtml = chips.map(c => `
    <div class="feature-chip ${c.cat}${c.serverOnly ? ' server-only' : ''}"
         title="${c.serverOnly ? 'Computed server-side by spaCy — value not surfaced by current API' : ''}">
      <div class="fname">${c.name}</div>
      <div class="fval">${c.serverOnly ? '— (spaCy)' : c.val}</div>
      <div class="fdesc">${c.desc}</div>
    </div>`).join('');

  return `
  <div class="section-card s2" id="sec2">
    <div class="section-header">
      <div class="section-number">2</div>
      <div>
        <div class="section-title">Feature Extraction — 24-Dimensional Vector</div>
        <div class="section-subtitle">Computed by spaCy en_core_web_sm + cefrpy · Each value feeds directly into the SVM classifier</div>
      </div>
    </div>
    <div class="section-body">
      <div class="feature-legend">
        <div class="legend-item"><div class="legend-dot" style="background:#2e7d32"></div>Vocabulary</div>
        <div class="legend-item"><div class="legend-dot" style="background:#1565c0"></div>Syntax / Structure</div>
        <div class="legend-item"><div class="legend-dot" style="background:#6a1b9a"></div>CEFR Levels</div>
        <div class="legend-item"><div class="legend-dot" style="background:#e65100"></div>Readability</div>
        <div class="legend-item" style="opacity:0.55"><div class="legend-dot" style="background:#aaa"></div>Server-side only (spaCy)</div>
      </div>
      <div class="feature-grid">${chipHtml}</div>
    </div>
  </div>`;
}
```

- [ ] **Step 3: Verify Section 2**

Start the backend (`cd backend && uvicorn main:app --reload --port 8000`). Open the file, click Analyze. Verify:
- 24 chips appear in a 4-column grid
- Green chips show vocabulary features with real numbers
- Purple chips show CEFR ratios with real percentages
- 7 grey "server-side only" chips show "— (spaCy)" with tooltip on hover
- Orange chips show FK grade and Fog index

- [ ] **Step 4: Commit**

```bash
git add diagrams/algorithm-visualizer.html
git commit -m "feat(visualizer): add section 2 feature extraction grid with 24 chips"
```

---

### Task 4: Section 3 — Formula Walkthrough

**Files:**
- Modify: `diagrams/algorithm-visualizer.html`

- [ ] **Step 1: Add Section 3 CSS**

Inside `<style>`, append:

```css
/* ── Section 3: Formulas ── */
.formula-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 700px) { .formula-grid { grid-template-columns: 1fr; } }

.formula-block {
  background: #fafbff; border: 1px solid #e0e4f0; border-radius: 8px;
  padding: 13px 15px;
}
.formula-title {
  font-size: 12px; font-weight: 700; margin-bottom: 8px;
  display: flex; align-items: center; gap: 6px;
}
.formula-eq  { font-family: 'Courier New', monospace; font-size: 13px; margin-bottom: 4px; }
.formula-sub { font-family: 'Courier New', monospace; font-size: 11px; color: #555; margin-bottom: 3px; }
.formula-result { font-size: 14px; font-weight: 800; color: #e65100; margin-top: 6px; }

.svm-box {
  background: #f3e5f5; border: 1px solid #ce93d8; border-radius: 10px;
  padding: 14px 16px; margin-top: 12px;
}
.svm-box-title { font-weight: 700; color: #6a1b9a; margin-bottom: 6px; font-size: 13px; }
.svm-box-code  { font-family: monospace; font-size: 11px; color: #444; line-height: 1.7; margin-bottom: 8px; }
.svm-verdict   { font-size: 16px; font-weight: 800; }
.confidence-tag {
  display: inline-block; background: #e3f2fd; color: #1565c0;
  border-radius: 10px; padding: 2px 10px; font-size: 11px; margin-left: 8px; font-weight: 600;
}
```

- [ ] **Step 2: Add helper functions + `buildSection3()`**

Add before `</script>`:

```javascript
// ── Syllable count (Gunning Fog / FK) ──
function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  const vowels = 'aeiouy';
  let count = vowels.includes(word[0]) ? 1 : 0;
  for (let i = 1; i < word.length; i++) {
    if (vowels.includes(word[i]) && !vowels.includes(word[i-1])) count++;
  }
  if (word.endsWith('e')) count--;
  return Math.max(1, count);
}

function buildSection3() {
  const m = complexityResult?.metrics || {};
  const ri = m.readabilityIndices || {};
  const wc = m.wordCount || 0;

  // Derive counts for formula display from API values
  const asl  = m.avgSentenceLength != null ? m.avgSentenceLength.toFixed(1) : '?';
  const dwr  = m.difficultWordRatio != null ? m.difficultWordRatio.toFixed(2) : '?';
  const fk   = ri.flesch_kincaid != null ? ri.flesch_kincaid.toFixed(2) : '?';
  const fog  = ri.gunning_fog    != null ? ri.gunning_fog.toFixed(2)    : '?';
  const ttr  = m.vocabularyRichness != null ? m.vocabularyRichness.toFixed(3) : '?';
  const advC = m.advancedWordCount != null ? m.advancedWordCount : '?';

  // Syllable/word counts derived from essay text (best-effort for formula display)
  const essay = document.getElementById('essayInput').value.trim();
  const words = essay.match(/\b\w+\b/g) || [];
  const sentences = essay.split(/[.!?]+/).filter(s => s.trim()).length || 1;
  const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
  const syllableCount = words.reduce((s, w) => s + countSyllables(w), 0);
  const complexWords = words.filter(w => countSyllables(w) >= 3).length;

  // SVM result
  const level = complexityResult?.level || '—';
  const proficiency = analysisResult?.proficiency || '—';
  const score = complexityResult?.score != null ? complexityResult.score.toFixed(1) : '—';

  // Heuristic CS for formula display
  const dwr_num  = m.difficultWordRatio != null ? parseFloat(m.difficultWordRatio) : 0;
  const asl_num  = m.avgSentenceLength != null ? parseFloat(m.avgSentenceLength) : 0;
  const adv_num  = typeof advC === 'number' ? advC : 0;
  // dwr_num is a raw ratio (e.g. 7.5 meaning 7.5%) — use as-is in CS formula
  const cs = ((asl_num * 3) + (dwr_num * 4) + (adv_num * 3)).toFixed(1);
  const csThreshold = parseFloat(cs) < 40 ? 'Literal (< 40)' : parseFloat(cs) < 75 ? 'Inferential (< 75)' : 'Evaluative (≥ 75)';
  // dwr for display in formula: use numeric value without % sign
  const dwrNum = dwr.replace('%','');

  return `
  <div class="section-card s3" id="sec3">
    <div class="section-header">
      <div class="section-number">3</div>
      <div>
        <div class="section-title">Score Computation — Formulas with Exact Values</div>
        <div class="section-subtitle">Every formula step-by-step using the actual numbers from this essay</div>
      </div>
    </div>
    <div class="section-body">
      <div class="formula-grid">

        <div class="formula-block">
          <div class="formula-title" style="color:#2e7d32">📐 TTR — Type-Token Ratio</div>
          <div class="formula-eq">TTR = unique_words / total_words</div>
          <div class="formula-sub">= ${uniqueWords} / ${words.length}</div>
          <div class="formula-result">= ${ttr}</div>
        </div>

        <div class="formula-block">
          <div class="formula-title" style="color:#1565c0">📐 Average Sentence Length</div>
          <div class="formula-eq">ASL = total_words / total_sentences</div>
          <div class="formula-sub">= ${words.length} / ${sentences}</div>
          <div class="formula-result">= ${asl} words/sentence</div>
        </div>

        <div class="formula-block">
          <div class="formula-title" style="color:#e65100">📐 Difficult Word Ratio</div>
          <div class="formula-eq">DWR = (complex_words / total_words) × 100</div>
          <div class="formula-sub">complex words (≥ 3 syllables) = ${complexWords}</div>
          <div class="formula-sub">= (${complexWords} / ${words.length}) × 100</div>
          <div class="formula-result">= ${dwrNum}%</div>
        </div>

        <div class="formula-block">
          <div class="formula-title" style="color:#e65100">📐 Flesch-Kincaid Grade Level</div>
          <div class="formula-eq">FK = (0.39 × ASL) + (11.8 × Syl/W) − 15.59</div>
          <div class="formula-sub">syllables = ${syllableCount}, words = ${words.length}</div>
          <div class="formula-sub">= (0.39 × ${asl}) + (11.8 × ${(syllableCount/Math.max(words.length,1)).toFixed(3)}) − 15.59</div>
          <div class="formula-result">= ${fk} → Grade ${isNaN(parseFloat(fk)) ? '?' : Math.round(parseFloat(fk))} reading level <span style="font-size:10px;color:#888">(from backend)</span></div>
        </div>

        <div class="formula-block">
          <div class="formula-title" style="color:#e65100">📐 Gunning Fog Index</div>
          <div class="formula-eq">Fog = 0.4 × (ASL + 100 × CW/W)</div>
          <div class="formula-sub">CW (≥ 3 syllables) = ${complexWords}</div>
          <div class="formula-sub">= 0.4 × (${asl} + 100 × ${complexWords}/${words.length})</div>
          <div class="formula-sub">= 0.4 × (${asl} + ${(100 * complexWords / Math.max(words.length,1)).toFixed(2)})</div>
          <div class="formula-result">= ${fog} → ~Grade ${Math.round(parseFloat(fog))} education needed</div>
        </div>

        <div class="formula-block">
          <div class="formula-title" style="color:#1565c0">📐 Structure Score (heuristic)</div>
          <div class="formula-eq">SS = min(100, (CD × 10) + (ASL × 2))</div>
          <div class="formula-sub">CD (clause density) = computed server-side by spaCy</div>
          <div class="formula-sub">Shown here with ASL proxy only</div>
          <div class="formula-result">ASL component = ${(parseFloat(asl_num)*2).toFixed(1)}</div>
        </div>

        <div class="formula-block" style="grid-column: span 2">
          <div class="formula-title" style="color:#6a1b9a">📐 Heuristic Complexity Score (CS)</div>
          <div class="formula-eq">CS = (ASL × 3) + (DWR × 4) + (AdvCEFR_count × 3)</div>
          <div class="formula-sub">= (${asl} × 3) + (${dwr} × 4) + (${advC} × 3)</div>
          <div class="formula-sub">= ${(asl_num*3).toFixed(2)} + ${(dwr_num*4).toFixed(2)} + ${(adv_num*3).toFixed(2)}</div>
          <div class="formula-result">= ${cs} → <strong>${csThreshold}</strong></div>
          <div style="font-size:10px;color:#888;margin-top:4px;">Threshold: &lt;40 Literal · &lt;75 Inferential · ≥75 Evaluative</div>
        </div>

      </div>

      <div class="svm-box">
        <div class="svm-box-title">🤖 SVM Model Prediction</div>
        <div class="svm-box-code">
          feature_vector[24] → StandardScaler.transform() → SVC(kernel="rbf", C=10, gamma="scale")<br>
          predict() → label index → labels = ["Literal", "Inferential", "Evaluative"]
        </div>
        <div class="svm-verdict">
          Complexity: <span style="color:#e65100">${level}</span>
          <span class="confidence-tag">score: ${score}</span>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          Proficiency: <span style="color:#6a1b9a">${proficiency}</span>
        </div>
      </div>
    </div>
  </div>`;
}
```

- [ ] **Step 3: Verify Section 3**

Click Analyze with the backend running. Verify:
- 7 formula blocks appear in 2-column grid
- Each shows formula → substitution → result with real numbers from the essay
- DWR formula shows `= X%` with no double-`%` artifacts (e.g. `"7.5%"` not `"7.5%%"`)
- FK formula result matches: open DevTools → Network → `/analyze/complexity` response → `metrics.readabilityIndices.flesch_kincaid` — value on screen must match
- Heuristic CS formula spans full width, showing 3 separate addend values and total
- SVM verdict box shows complexity level and proficiency from the backend

- [ ] **Step 4: Commit**

```bash
git add diagrams/algorithm-visualizer.html
git commit -m "feat(visualizer): add section 3 formula walkthrough with real computed values"
```

---

## Chunk 3: Sections 4 & 5 (DepEd Scale + Teacher Pipeline)

### Task 5: Section 4 — DepEd Verdict Bands + What-if Sliders

**Files:**
- Modify: `diagrams/algorithm-visualizer.html`

- [ ] **Step 1: Add Section 4 CSS**

Inside `<style>`, append:

```css
/* ── Section 4: DepEd Scale ── */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 700px) { .two-col { grid-template-columns: 1fr; } }

.subsection-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; color: #555; margin-bottom: 10px;
}

/* Complexity verdict bands */
.verdict-band {
  border-radius: 10px; padding: 13px 15px; margin-bottom: 8px;
  border: 2px solid transparent; transition: border-color 0.2s;
  position: relative;
}
.verdict-band.active { border-color: #1565c0 !important; }
.verdict-band-label { font-size: 15px; font-weight: 700; }
.verdict-band-sub   { font-size: 11px; margin-top: 3px; color: #555; }
.verdict-band-g7    { font-size: 11px; font-weight: 600; margin-top: 5px; }
.verdict-badge {
  float: right; display: inline-block; border-radius: 12px;
  padding: 3px 12px; font-size: 10px; font-weight: 700; color: white;
}
.vb-literal      { background: #e8f5e9; border-color: #c8e6c9; }
.vb-literal      .verdict-band-label { color: #2e7d32; }
.vb-literal      .verdict-band-g7    { color: #2e7d32; }
.vb-literal      .verdict-badge      { background: #2e7d32; }
.vb-inferential  { background: #fff8e1; border-color: #ffecb3; }
.vb-inferential  .verdict-band-label { color: #f57f17; }
.vb-inferential  .verdict-band-g7    { color: #f57f17; }
.vb-inferential  .verdict-badge      { background: #f57f17; }
.vb-evaluative   { background: #fce4ec; border-color: #f8bbd0; }
.vb-evaluative   .verdict-band-label { color: #c62828; }
.vb-evaluative   .verdict-band-g7    { color: #c62828; }
.vb-evaluative   .verdict-badge      { background: #c62828; }

/* Proficiency bands */
.prof-bands { display: flex; flex-direction: column; gap: 7px; margin-top: 14px; }
.prof-band {
  border-radius: 8px; padding: 9px 13px; border: 2px solid transparent;
  display: flex; align-items: center; justify-content: space-between;
  transition: border-color 0.2s;
}
.prof-band.active { border-color: #1565c0 !important; }
.prof-label { font-weight: 700; font-size: 13px; }
.prof-desc  { font-size: 11px; color: #555; margin-top: 1px; }
.pb-mahusay     { background: #e8f5e9; border-color: #c8e6c9; }
.pb-mahusay     .prof-label { color: #2e7d32; }
.pb-papaunlad   { background: #fff8e1; border-color: #ffecb3; }
.pb-papaunlad   .prof-label { color: #f57f17; }
.pb-nagsisimula { background: #fce4ec; border-color: #f8bbd0; }
.pb-nagsisimula .prof-label { color: #c62828; }
.current-tag {
  display: inline-block; background: #1565c0; color: white;
  border-radius: 10px; padding: 2px 10px; font-size: 10px; font-weight: 700;
}

/* Sliders */
.slider-section { display: flex; flex-direction: column; gap: 10px; }
.slider-row     { display: grid; grid-template-columns: 150px 1fr 55px; align-items: center; gap: 10px; }
.slider-label   { font-size: 11px; font-weight: 600; color: #444; }
.slider-val     { font-size: 12px; font-weight: 700; color: #1565c0; text-align: right; font-variant-numeric: tabular-nums; }
.slider-hint    { font-size: 10px; color: #888; margin-top: -4px; grid-column: 2; }
input[type=range] { width: 100%; accent-color: #1565c0; cursor: pointer; }
.slider-info-note { font-size: 10px; color: #aaa; font-style: italic; }

.live-formula-box {
  background: #fff3e0; border: 1px solid #ffcc80; border-radius: 8px;
  padding: 11px 13px; margin-top: 12px;
}
.live-formula-title { font-size: 11px; font-weight: 700; color: #e65100; margin-bottom: 5px; }
.live-formula-eq    { font-family: monospace; font-size: 12px; margin-bottom: 2px; }
.live-formula-result { font-size: 15px; font-weight: 800; margin-top: 6px; }
.threshold-note { font-size: 10px; color: #888; margin-top: 3px; }
```

- [ ] **Step 2: Add `buildSection4()` and slider logic**

Add before `</script>`:

```javascript
function buildSection4() {
  const m  = complexityResult?.metrics || {};
  const level = complexityResult?.level || 'Literal';
  const proficiency = analysisResult?.proficiency || 'Nagsisimula';

  const initAsl  = m.avgSentenceLength != null ? parseFloat(m.avgSentenceLength).toFixed(1) : '9.0';
  const initDwr  = m.difficultWordRatio != null ? parseFloat(m.difficultWordRatio).toFixed(1) : '15.0';
  const initAdv  = m.advancedWordCount  != null ? m.advancedWordCount : 2;

  const essay = document.getElementById('essayInput').value.trim();
  const words = essay.match(/\b\w+\b/g) || ['x'];
  const initTtr  = (new Set(words.map(w => w.toLowerCase())).size / words.length).toFixed(2);

  const verdictBands = [
    { cls:'vb-literal',     id:'vb-literal',     label:'Literal',     sub:'Direct, surface-level meaning · Phil-IRI: Instructional', g7:'→ Ready for Grade 7 use',         badge:'G7 Ready' },
    { cls:'vb-inferential', id:'vb-inferential',  label:'Inferential', sub:'Reading between the lines · Phil-IRI: Frustration',      g7:'→ Use with Teacher Support',       badge:'With Support' },
    { cls:'vb-evaluative',  id:'vb-evaluative',   label:'Evaluative',  sub:'Critical judgment required · Phil-IRI: Independent',     g7:'→ Above Grade 7 Level',            badge:'Above G7' },
  ].map(b => `
    <div class="verdict-band ${b.cls} ${level === b.label ? 'active' : ''}" id="${b.id}">
      <span class="verdict-badge">${b.badge}</span>
      <div class="verdict-band-label">${b.label}</div>
      <div class="verdict-band-sub">${b.sub}</div>
      <div class="verdict-band-g7">${b.g7}</div>
    </div>`).join('');

  const profBands = [
    { cls:'pb-mahusay',     label:'Mahusay',      desc:'Proficient — varied vocab, complex sentences, clear organization' },
    { cls:'pb-papaunlad',   label:'Papaunlad',     desc:'Developing — emerging structure, growing vocabulary' },
    { cls:'pb-nagsisimula', label:'Nagsisimula',   desc:'Beginning — limited vocabulary, simple sentences' },
  ].map(b => `
    <div class="prof-band ${b.cls} ${proficiency === b.label ? 'active' : ''}" id="pb-${b.label}">
      <div><div class="prof-label">${b.label}</div><div class="prof-desc">${b.desc}</div></div>
      ${proficiency === b.label ? '<span class="current-tag">CURRENT</span>' : ''}
    </div>`).join('');

  return `
  <div class="section-card s4" id="sec4">
    <div class="section-header">
      <div class="section-number">4</div>
      <div>
        <div class="section-title">DepEd Scale — G7 Suitability Verdict &amp; What-if Sliders</div>
        <div class="section-subtitle">Phil-IRI levels anchored to DepEd MELCs · Sliders show how feature changes shift the classification</div>
      </div>
    </div>
    <div class="section-body">
      <div class="two-col">
        <div>
          <div class="subsection-label">Complexity Classification Bands</div>
          ${verdictBands}
          <div class="subsection-label" style="margin-top:14px">Writing Proficiency Level (SVM)</div>
          <div class="prof-bands">${profBands}</div>
        </div>

        <div>
          <div class="subsection-label">What-if Feature Sliders</div>
          <div style="font-size:11px;color:#888;margin-bottom:12px;">
            Drag ASL, DWR, or Adv CEFR to shift the complexity classification.
            TTR and Clause Density are informational only.
          </div>
          <div class="slider-section">
            <div>
              <div class="slider-row">
                <div class="slider-label">Avg Sentence Length</div>
                <input type="range" id="sl-asl" min="3" max="40" step="0.5" value="${initAsl}"
                  oninput="updateSliders()">
                <div class="slider-val" id="sv-asl">${initAsl}</div>
              </div>
              <div class="slider-row"><div></div><div class="slider-hint">↑ Longer = more complex syntax</div></div>
            </div>
            <div>
              <div class="slider-row">
                <div class="slider-label">Difficult Word %</div>
                <input type="range" id="sl-dwr" min="0" max="60" step="1" value="${initDwr}"
                  oninput="updateSliders()">
                <div class="slider-val" id="sv-dwr">${initDwr}%</div>
              </div>
              <div class="slider-row"><div></div><div class="slider-hint">↑ More 3+ syllable words = harder text</div></div>
            </div>
            <div>
              <div class="slider-row">
                <div class="slider-label">Advanced CEFR count</div>
                <input type="range" id="sl-adv" min="0" max="30" step="1" value="${initAdv}"
                  oninput="updateSliders()">
                <div class="slider-val" id="sv-adv">${initAdv}</div>
              </div>
              <div class="slider-row"><div></div><div class="slider-hint">↑ More C1/C2 words pushes toward Evaluative</div></div>
            </div>
            <div>
              <div class="slider-row">
                <div class="slider-label">TTR <span class="slider-info-note">(info only)</span></div>
                <input type="range" id="sl-ttr" min="10" max="100" step="1" value="${Math.round(parseFloat(initTtr)*100)}"
                  oninput="updateTtrDisplay()">
                <div class="slider-val" id="sv-ttr">${initTtr}</div>
              </div>
              <div class="slider-row"><div></div><div class="slider-hint">Vocabulary diversity — does not affect CS formula</div></div>
            </div>
            <div>
              <div class="slider-row">
                <div class="slider-label">Clause Density <span class="slider-info-note">(info only)</span></div>
                <input type="range" id="sl-cd" min="5" max="50" step="1" value="18"
                  oninput="updateCdDisplay()">
                <div class="slider-val" id="sv-cd">1.8</div>
              </div>
              <div class="slider-row"><div></div><div class="slider-hint">Verbs/sentence — does not affect CS formula</div></div>
            </div>
          </div>

          <div class="live-formula-box">
            <div class="live-formula-title">LIVE HEURISTIC FORMULA</div>
            <div class="live-formula-eq" id="lf-eq">CS = (? × 3) + (? × 4) + (? × 3)</div>
            <div class="live-formula-eq" id="lf-sub">   = ? + ? + ?</div>
            <div class="live-formula-result" id="lf-result">= ?</div>
            <div class="threshold-note">Threshold: &lt;40 Literal · &lt;75 Inferential · ≥75 Evaluative</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function updateSliders() {
  const asl = parseFloat(document.getElementById('sl-asl').value);
  const dwr = parseFloat(document.getElementById('sl-dwr').value);
  const adv = parseFloat(document.getElementById('sl-adv').value);

  document.getElementById('sv-asl').textContent = asl.toFixed(1);
  document.getElementById('sv-dwr').textContent = dwr.toFixed(1) + '%';
  document.getElementById('sv-adv').textContent = adv;

  const cs = (asl * 3) + (dwr * 4) + (adv * 3);
  const newLevel = cs < 40 ? 'Literal' : cs < 75 ? 'Inferential' : 'Evaluative';

  // Update live formula box
  document.getElementById('lf-eq').textContent   = `CS = (${asl.toFixed(1)} × 3) + (${dwr.toFixed(1)} × 4) + (${adv} × 3)`;
  document.getElementById('lf-sub').textContent  = `   = ${(asl*3).toFixed(2)} + ${(dwr*4).toFixed(2)} + ${(adv*3).toFixed(2)}`;
  document.getElementById('lf-result').textContent = `= ${cs.toFixed(1)} → ${newLevel}`;
  document.getElementById('lf-result').style.color = newLevel === 'Literal' ? '#2e7d32' : newLevel === 'Inferential' ? '#f57f17' : '#c62828';

  // Update active band highlight
  ['Literal','Inferential','Evaluative'].forEach(l => {
    const el = document.getElementById(`vb-${l.toLowerCase()}`);
    if (el) el.classList.toggle('active', l === newLevel);
  });
}

function updateTtrDisplay() {
  const v = parseInt(document.getElementById('sl-ttr').value) / 100;
  document.getElementById('sv-ttr').textContent = v.toFixed(2);
}
function updateCdDisplay() {
  const v = parseInt(document.getElementById('sl-cd').value) / 10;
  document.getElementById('sv-cd').textContent = v.toFixed(1);
}
```

- [ ] **Step 3: Confirm slider initialization is wired**

The `renderResults()` stub written in Task 2 already includes:
```javascript
setTimeout(() => { if (document.getElementById('sl-asl')) updateSliders(); }, 0);
```
No change needed — verify it's present in the file.

- [ ] **Step 4: Verify Section 4**

Click Analyze. Verify:
- Three verdict bands appear — correct one highlighted with blue border
- Proficiency bands show with correct "CURRENT" tag
- Dragging ASL/DWR/AdvCEFR sliders updates the live formula box instantly
- The active verdict band changes highlight as CS threshold crosses
- TTR/Clause Density sliders update their display value but don't change the active band

- [ ] **Step 5: Commit**

```bash
git add diagrams/algorithm-visualizer.html
git commit -m "feat(visualizer): add section 4 DepEd verdict bands and what-if sliders"
```

---

### Task 6: Section 5 — Teacher Feedback Loop

**Files:**
- Modify: `diagrams/algorithm-visualizer.html`

- [ ] **Step 1: Add Section 5 CSS**

Inside `<style>`, append:

```css
/* ── Section 5: Teacher Feedback Loop ── */
.stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.stat-box  { background: #f0f4ff; border-radius: 8px; padding: 10px 12px; text-align: center; }
.stat-val  { font-size: 24px; font-weight: 800; color: #1565c0; font-variant-numeric: tabular-nums; }
.stat-lbl  { font-size: 10px; color: #666; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.4px; }
.stat-meta { background: #f0f4ff; border-radius: 8px; padding: 11px 13px; font-size: 11px; line-height: 1.8; }
.stat-meta code { background: #dce8ff; padding: 1px 5px; border-radius: 3px; font-size: 10px; }

.pipeline { display: flex; flex-direction: column; }
.pipe-step { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; }
.pipe-dot  {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: white; margin-top: 1px;
}
.pipe-line { width: 2px; background: #d0d5e8; margin-left: 13px; height: 14px; }
.pipe-text b    { display: block; font-weight: 600; color: #1a1a2e; font-size: 12px; }
.pipe-text span { color: #666; font-size: 11px; }

.retry-btn {
  background: none; border: 1px solid #1565c0; color: #1565c0;
  border-radius: 6px; padding: 4px 12px; font-size: 11px; cursor: pointer; margin-top: 8px;
}
```

- [ ] **Step 2: Add Section 5 render + data fetch**

In `renderResults()` (or its surrounding logic), add Section 5 render. Add `buildSection5()` and `loadTrainStatus()`:

```javascript
// In renderResults(), after section 4:
main.insertAdjacentHTML('beforeend', buildSection5());
loadTrainStatus();

// ── Section 5 builder ──
function buildSection5() {
  const pipeSteps = [
    { color:'#1565c0', title:'Teacher rates student essay', detail:'Assigns rubric scores (Content, Organization, Vocab, Grammar, Mechanics) in ReadTrack app' },
    { color:'#1565c0', title:'Stored in Supabase', detail:'teacher_rubric_scores + diagnosis_result saved to student_grading_uploads table' },
    { color:'#1565c0', title:'POST /train/proficiency triggered', detail:'Fetches all rated essays · re-extracts 24-dim feature vectors for each' },
    { color:'#00695c', title:'RobustScaler.fit_transform(X)', detail:'Normalizes features using median + IQR — resistant to outliers in small datasets' },
    { color:'#00695c', title:'SVC.fit(X_scaled, y)', detail:'Trains SVM: kernel="rbf", C=10, gamma="scale", class_weight="balanced", random_state=42' },
    { color:'#00695c', title:'Save .pkl + hot-reload', detail:'New model serialized to disk and loaded into memory immediately — no server restart needed' },
  ];

  const pipeHtml = pipeSteps.map((s, i) => `
    ${i > 0 ? '<div class="pipe-line"></div>' : ''}
    <div class="pipe-step">
      <div class="pipe-dot" style="background:${s.color}">${i+1}</div>
      <div class="pipe-text"><b>${s.title}</b><span>${s.detail}</span></div>
    </div>`).join('');

  return `
  <div class="section-card s5" id="sec5">
    <div class="section-header">
      <div class="section-number">5</div>
      <div>
        <div class="section-title">Teacher Feedback Loop — Model Retraining</div>
        <div class="section-subtitle">How teacher ratings of student essays improve the SVM model over time</div>
      </div>
    </div>
    <div class="section-body">
      <div class="two-col">
        <div>
          <div class="subsection-label">Live Model Performance <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#888">(GET /train/status)</span></div>
          <div class="stat-grid" id="statGrid">
            <div class="stat-box"><div class="stat-val" id="stat-en-rated">—</div><div class="stat-lbl">Rated Essays (EN)</div></div>
            <div class="stat-box"><div class="stat-val" id="stat-tl-rated">—</div><div class="stat-lbl">Rated Essays (TL)</div></div>
            <div class="stat-box"><div class="stat-val" id="stat-en-new">—</div><div class="stat-lbl">New Since Retrain (EN)</div></div>
            <div class="stat-box"><div class="stat-val" id="stat-tl-new">—</div><div class="stat-lbl">New Since Retrain (TL)</div></div>
          </div>
          <div class="stat-meta" id="statMeta">
            <div><strong>Last Retrain (EN):</strong> <span id="stat-en-date">—</span></div>
            <div><strong>Confidence:</strong> <span id="stat-en-conf">—</span></div>
            <div><strong>Model:</strong> <code>proficiency_model_en.pkl</code> / <code>proficiency_model_tl.pkl</code></div>
            <div><strong>Scaler:</strong> <code>RobustScaler</code> · <strong>Algorithm:</strong> <code>SVC(rbf, C=10)</code></div>
            <div><strong>EN Blend:</strong> PH essays (×2 weight) + ASAP2 benchmark dataset</div>
          </div>
          <button class="retry-btn" onclick="loadTrainStatus()">↻ Refresh stats</button>
        </div>
        <div>
          <div class="subsection-label">Retraining Pipeline</div>
          <div class="pipeline">${pipeHtml}</div>
        </div>
      </div>
    </div>
  </div>`;
}

async function loadTrainStatus() {
  try {
    const r = await fetch(`${API}/train/status`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const en = data.en || {};
    const tl = data.tl || {};

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? '—'; };
    set('stat-en-rated', en.rated_essays ?? '—');
    set('stat-tl-rated', tl.rated_essays ?? '—');
    set('stat-en-new',   en.new_since_retrain ?? '—');
    set('stat-tl-new',   tl.new_since_retrain ?? '—');
    set('stat-en-date',  en.last_retrain ? new Date(en.last_retrain).toLocaleDateString() : 'Not yet retrained');
    set('stat-en-conf',  en.confidence_level ?? '—');
  } catch (e) {
    ['stat-en-rated','stat-tl-rated','stat-en-new','stat-tl-new'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
  }
}
```

- [ ] **Step 3: Verify Section 5**

Click Analyze. Verify:
- Stats boxes show real numbers from the backend (or "—" if Supabase data not set up)
- Metadata row shows model filenames, scaler, algorithm params
- Pipeline diagram shows 6 numbered steps with correct colors
- Refresh button re-calls the API

- [ ] **Step 4: Commit**

```bash
git add diagrams/algorithm-visualizer.html
git commit -m "feat(visualizer): add section 5 teacher feedback loop with live stats and pipeline diagram"
```

---

## Chunk 4: Section 6 (Teacher Rubric Scorer)

### Task 7: Section 6 — Teacher Rubric Scorer

**Files:**
- Modify: `diagrams/algorithm-visualizer.html`

- [ ] **Step 1: Add Section 6 CSS**

Inside `<style>`, append:

```css
/* ── Section 6: Rubric Scorer ── */
.rubric-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;
  margin-bottom: 16px;
}
@media (max-width: 800px) { .rubric-grid { grid-template-columns: repeat(2, 1fr); } }

.rubric-dimension { background: #fafbff; border: 1px solid #e0e4f0; border-radius: 8px; padding: 11px 12px; }
.rubric-dim-name  { font-size: 12px; font-weight: 700; color: #333; margin-bottom: 8px; }
.score-buttons    { display: flex; gap: 5px; }
.score-btn {
  flex: 1; padding: 7px 0; border: 1px solid #d0d5e8; border-radius: 6px;
  background: white; cursor: pointer; font-weight: 700; font-size: 13px;
  color: #555; transition: all 0.15s; position: relative;
}
.score-btn:hover   { border-color: #1565c0; color: #1565c0; background: #f0f4ff; }
.score-btn.selected { background: #1565c0; color: white; border-color: #1565c0; }
.score-btn-tooltip {
  position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%);
  background: #1a1a2e; color: white; font-size: 10px; font-weight: 400;
  padding: 5px 8px; border-radius: 5px; white-space: nowrap; pointer-events: none;
  opacity: 0; transition: opacity 0.15s; z-index: 10; min-width: 120px; text-align: center;
}
.score-btn:hover .score-btn-tooltip { opacity: 1; }

.rubric-total-row {
  display: flex; align-items: center; gap: 14px; margin-bottom: 14px;
  background: #f0f4ff; border-radius: 8px; padding: 12px 16px; flex-wrap: wrap;
}
.total-score { font-size: 28px; font-weight: 800; color: #1565c0; font-variant-numeric: tabular-nums; }
.total-label { font-size: 11px; color: #666; }
.deped-verdict {
  margin-left: auto; font-size: 15px; font-weight: 700; padding: 6px 18px;
  border-radius: 20px;
}
.dv-nagsisimula { background: #fce4ec; color: #c62828; }
.dv-papaunlad   { background: #fff8e1; color: #f57f17; }
.dv-mahusay     { background: #e8f5e9; color: #2e7d32; }

.comparison-box {
  border: 1px solid #e0e4f0; border-radius: 8px; padding: 12px 16px;
  margin-bottom: 14px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
}
.cmp-item { text-align: center; }
.cmp-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #888; }
.cmp-value { font-size: 14px; font-weight: 700; margin-top: 2px; }
.cmp-match   { background: #e8f5e9; border-color: #a5d6a7; }
.cmp-mismatch { background: #fff8e1; border-color: #ffe082; }
.cmp-status  { font-size: 11px; font-style: italic; color: #555; margin-left: auto; }

.lang-selector { display: flex; gap: 8px; margin-bottom: 14px; }
.lang-btn {
  padding: 5px 16px; border: 1px solid #d0d5e8; border-radius: 20px;
  background: white; cursor: pointer; font-size: 12px; font-weight: 600; color: #555;
}
.lang-btn.active { background: #1565c0; color: white; border-color: #1565c0; }

.btn-retrain {
  background: #00695c; color: white; border: none; border-radius: 8px;
  padding: 11px 28px; font-size: 13px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; gap: 8px; transition: background 0.2s;
}
.btn-retrain:hover    { background: #00796b; }
.btn-retrain:disabled { background: #90a4ae; cursor: not-allowed; }

.retrain-result {
  margin-top: 12px; background: #e8f5e9; border: 1px solid #a5d6a7;
  border-radius: 8px; padding: 12px 16px; display: none; font-size: 12px;
}
.retrain-result.visible { display: block; }
.retrain-result strong  { font-size: 14px; color: #2e7d32; }
.retrain-error {
  margin-top: 12px; background: #ffebee; border: 1px solid #ef9a9a;
  border-radius: 8px; padding: 10px 14px; display: none; font-size: 12px; color: #c62828;
}
.retrain-error.visible { display: block; }
```

- [ ] **Step 2: Add `buildSection6()` and rubric logic**

Add before `</script>`:

```javascript
// Rubric score descriptions (DepEd 4-level)
const RUBRIC_TOOLTIPS = {
  content:      ['Does not develop ideas','Partial ideas, little support','Clear ideas, some support','Fully developed, strong support'],
  organization: ['No structure visible','Weak intro/body/conclusion','Clear structure, some transitions','Strong structure, smooth flow'],
  language:     ['Very limited, inappropriate','Simple, some errors','Adequate, mostly appropriate','Varied, precise, register-appropriate'],
  grammar:      ['Many errors impede understanding','Frequent errors, mostly clear','Some errors, meaning clear','Few/no errors'],
  mechanics:    ['Pervasive errors','Many errors','Some errors','Correct punctuation & spelling'],
};

const RUBRIC_DIMS = [
  { key:'content',      label:'Content' },
  { key:'organization', label:'Organization' },
  { key:'language',     label:'Language / Vocab' },
  { key:'grammar',      label:'Grammar' },
  { key:'mechanics',    label:'Mechanics' },
];

// State
let rubricScores = { content: 0, organization: 0, language: 0, grammar: 0, mechanics: 0 };
let rubricLang = 'en';

function buildSection6() {
  const dimHtml = RUBRIC_DIMS.map(d => {
    const btns = [1,2,3,4].map(n => `
      <button class="score-btn" data-dim="${d.key}" data-score="${n}"
        onclick="setRubricScore('${d.key}', ${n})">
        ${n}
        <div class="score-btn-tooltip">${n} — ${RUBRIC_TOOLTIPS[d.key][n-1]}</div>
      </button>`).join('');
    return `
      <div class="rubric-dimension">
        <div class="rubric-dim-name">${d.label}</div>
        <div class="score-buttons" id="rb-${d.key}">${btns}</div>
      </div>`;
  }).join('');

  return `
  <div class="section-card s6" id="sec6">
    <div class="section-header">
      <div class="section-number">6</div>
      <div>
        <div class="section-title">Teacher DepEd Rubric Scorer</div>
        <div class="section-subtitle">Score the student essay on 5 dimensions · Submit to retrain the SVM model with this rating</div>
      </div>
    </div>
    <div class="section-body">

      <div class="lang-selector">
        <span style="font-size:12px;font-weight:600;color:#444;align-self:center">Essay Language:</span>
        <button class="lang-btn active" id="lbtn-en" onclick="setRubricLang('en')">English (EN)</button>
        <button class="lang-btn" id="lbtn-tl" onclick="setRubricLang('tl')">Filipino (TL)</button>
      </div>

      <div class="rubric-grid">${dimHtml}</div>

      <div class="rubric-total-row">
        <div>
          <div class="total-score"><span id="rubric-total">0</span> / 20</div>
          <div class="total-label">Total rubric score</div>
        </div>
        <div>
          <div class="total-label">DepEd Scale</div>
          <div id="rubric-scale" style="font-size:12px;color:#888;margin-top:2px;">5–8 Nagsisimula · 9–14 Papaunlad · 15–20 Mahusay</div>
        </div>
        <div class="deped-verdict dv-nagsisimula" id="rubric-verdict">Nagsisimula</div>
      </div>

      <div class="comparison-box" id="cmpBox">
        <div class="cmp-item">
          <div class="cmp-label">SVM Says</div>
          <div class="cmp-value" style="color:#6a1b9a" id="cmp-svm">${analysisResult?.proficiency || '—'}</div>
        </div>
        <div style="font-size:20px;color:#ccc">↔</div>
        <div class="cmp-item">
          <div class="cmp-label">Teacher Rubric Says</div>
          <div class="cmp-value" id="cmp-teacher">—</div>
        </div>
        <div class="cmp-status" id="cmp-status">Score the essay above to compare</div>
      </div>

      <button class="btn-retrain" id="retrainBtn" onclick="submitAndRetrain()">
        ↻ Submit Score &amp; Retrain Model
      </button>
      <div class="retrain-result" id="retrainResult"></div>
      <div class="retrain-error"  id="retrainError"></div>
    </div>
  </div>`;
}

function setRubricLang(lang) {
  rubricLang = lang;
  document.getElementById('lbtn-en').classList.toggle('active', lang === 'en');
  document.getElementById('lbtn-tl').classList.toggle('active', lang === 'tl');
}

function setRubricScore(dim, score) {
  rubricScores[dim] = score;
  // Update button highlight
  document.querySelectorAll(`[data-dim="${dim}"]`).forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.score) === score);
  });
  updateRubricTotal();
}

function updateRubricTotal() {
  const total = Object.values(rubricScores).reduce((a, b) => a + b, 0);
  const verdict = total <= 8 ? 'Nagsisimula' : total <= 14 ? 'Papaunlad' : 'Mahusay';
  const cls     = verdict === 'Nagsisimula' ? 'dv-nagsisimula' : verdict === 'Papaunlad' ? 'dv-papaunlad' : 'dv-mahusay';

  document.getElementById('rubric-total').textContent = total;
  const vEl = document.getElementById('rubric-verdict');
  vEl.textContent = verdict;
  vEl.className = `deped-verdict ${cls}`;

  // Comparison box
  const svmLabel = analysisResult?.proficiency || '—';
  const match = svmLabel === verdict;
  document.getElementById('cmp-teacher').textContent = verdict;
  document.getElementById('cmp-teacher').style.color = verdict === 'Mahusay' ? '#2e7d32' : verdict === 'Papaunlad' ? '#f57f17' : '#c62828';
  document.getElementById('cmpBox').className = `comparison-box ${match ? 'cmp-match' : 'cmp-mismatch'}`;
  document.getElementById('cmp-status').textContent = total === 0
    ? 'Score the essay above to compare'
    : match
      ? '✓ SVM and teacher agree on this essay'
      : '⚠ Mismatch — this essay will help improve the model when submitted';
}

async function submitAndRetrain() {
  const total = Object.values(rubricScores).reduce((a, b) => a + b, 0);
  const scoredCount = Object.values(rubricScores).filter(v => v > 0).length;
  if (scoredCount < 5) {
    document.getElementById('retrainError').textContent = `Please score all 5 dimensions before submitting (${scoredCount}/5 scored).`;
    document.getElementById('retrainError').classList.add('visible');
    return;
  }

  const btn = document.getElementById('retrainBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="border-top-color:#00695c;border-color:rgba(0,105,92,0.3)"></span>Retraining…';
  document.getElementById('retrainResult').classList.remove('visible');
  document.getElementById('retrainError').classList.remove('visible');

  try {
    const r = await fetch(`${API}/train/proficiency`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: rubricLang })
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error);

    const resultEl = document.getElementById('retrainResult');
    resultEl.innerHTML = `
      <strong>Model retrained successfully</strong><br>
      New accuracy: <strong>${data.accuracy || '—'}</strong> ·
      Trained on <strong>${data.samples_used ?? '—'}</strong> rated essays
      ${data.asap2_samples > 0 ? ` + ${data.asap2_samples} ASAP2 benchmark samples (EN only)` : ''}
    `;
    resultEl.classList.add('visible');

    // Refresh Section 5 stats
    await loadTrainStatus();
  } catch (e) {
    const errEl = document.getElementById('retrainError');
    errEl.textContent = `Retraining failed: ${e.message}. Make sure there are at least 5 rated essays in Supabase.`;
    errEl.classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '↻ Submit Score &amp; Retrain Model';
  }
}
```

- [ ] **Step 3: Confirm Section 6 is wired in `renderResults()`**

The stub `renderResults()` from Task 2 already calls `buildSection6()`. No change needed — verify the stub includes `main.insertAdjacentHTML('beforeend', buildSection6())` after Section 5.

- [ ] **Step 4: Verify Section 6**

Click Analyze. Scroll to Section 6. Verify:
- 5 rubric dimension cards appear in a row
- Clicking a score button highlights it blue and clears the others in the same dimension
- Hovering a score button shows the tooltip description
- Total score updates live; verdict badge changes color (red/amber/green)
- Comparison box shows SVM vs teacher verdict with match/mismatch styling
- Submit button calls `/train/proficiency` and shows success/error message
- On success, Section 5 stats refresh

- [ ] **Step 5: Commit**

```bash
git add diagrams/algorithm-visualizer.html
git commit -m "feat(visualizer): add section 6 teacher rubric scorer with submit-and-retrain"
```

---

## Chunk 5: Polish + Final Verification

### Task 8: Polish & End-to-End Verification

**Files:**
- Modify: `diagrams/algorithm-visualizer.html`

- [ ] **Step 1: Smooth scroll anchors in header**

Add navigation anchors to page header for quick-jump during thesis demo:

Inside `<style>`, append:
```css
.jump-links { display: flex; gap: 8px; margin-top: 8px; }
.jump-link {
  font-size: 10px; color: rgba(255,255,255,0.7); text-decoration: none;
  background: rgba(255,255,255,0.1); border-radius: 10px; padding: 2px 10px;
  transition: background 0.15s;
}
.jump-link:hover { background: rgba(255,255,255,0.25); color: white; }
```

In the page header HTML, after `.tagline` div, add:
```html
<div class="jump-links">
  <a class="jump-link" href="#sec1">① Input</a>
  <a class="jump-link" href="#sec2">② Features</a>
  <a class="jump-link" href="#sec3">③ Formulas</a>
  <a class="jump-link" href="#sec4">④ DepEd Scale</a>
  <a class="jump-link" href="#sec5">⑤ Teacher Loop</a>
  <a class="jump-link" href="#sec6">⑥ Rubric Scorer</a>
</div>
```

- [ ] **Step 2: Add `id` anchors to section cards**

Each `buildSectionN()` function's root div already has `id="secN"` — verify they all do. If any are missing, add them.

- [ ] **Step 3: End-to-end test with backend running**

Start backend: `cd /Volumes/Hanteck/Projects/readtrack/backend && uvicorn main:app --reload --port 8000`

Open `diagrams/algorithm-visualizer.html` and verify the full flow:

1. Header shows "● Connected to backend"
2. Click Analyze — all 6 sections appear
3. Section 2: 24 chips, 7 grey "spaCy" chips, real CEFR/readability values
4. Section 3: All 7 formula blocks with real substituted numbers
5. Section 4: Correct verdict band highlighted; drag ASL slider to 30 → classification shifts to Evaluative
6. Section 5: Stat boxes show numbers (or "—" if no rated essays)
7. Section 6: Score all 5 dimensions → total updates → comparison shows match/mismatch
8. Jump links scroll to correct section
9. No JS console errors (`F12 → Console`)

- [ ] **Step 4: Final commit**

```bash
git add diagrams/algorithm-visualizer.html
git commit -m "feat(visualizer): add jump navigation links and complete end-to-end verification"
```

---

## Summary

| File | What it does |
|------|-------------|
| `diagrams/algorithm-visualizer.html` | Complete standalone visualizer — all HTML, CSS, JS in one file |

**Backend required:** FastAPI at `http://localhost:8000`
**Endpoints used:** `POST /analyze/student`, `POST /analyze/complexity`, `GET /train/status`, `POST /train/proficiency`
**No build step.** Open directly in browser.
