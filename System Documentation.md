# ReadTrack System Documentation

Version: 2.3
Last Updated: April 7, 2026
Audience: Developers, System Administrators, Educational Technologists

## 1. Overview

ReadTrack is a web platform for reading-material analysis, student writing evaluation, grammar support, and OCR-based text ingestion for Philippine education contexts. It combines deterministic NLP and machine learning with generative AI to balance speed, explainability, and contextual quality.

The system supports English and Filipino workflows, uses Supabase for authentication and persistence, and includes model retraining from teacher-evaluated data.

## 2. Scope and Objectives

Primary objectives:
- Classify student writing proficiency (DepEd-aligned levels).
- Classify reading material complexity (Literal, Inferential, Evaluative).
- Provide rubric-based AI feedback for student writing.
- Support grammar and spelling checks using hybrid NLP + AI processing.
- Ingest text from images and PDFs for downstream analysis.

Out of scope for this version:
- Offline-first operation.
- Multi-tenant district-level role orchestration.
- Native mobile applications.

## 3. Technology Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6, React Router 7 |
| UI/Animation | Framer Motion 12, Recharts 3 |
| Backend | Python, FastAPI, Uvicorn |
| NLP (English) | spaCy, CEFRpy, LanguageTool-Python, SymSpellPy |
| NLP (Filipino) | calamanCy |
| ML | scikit-learn (SVM, LinearSVC), HistGradientBoosting, imbalanced-learn |
| OCR and GenAI | Google Gemini 2.5 Flash (Vision + text) |
| Storage/Auth | Supabase (PostgreSQL + Auth + RLS) |
| Document Processing | pypdf |

## 4. Architecture Summary

ReadTrack uses a hybrid service architecture:
- Layer 1 (deterministic): LanguageTool, SymSpell, spaCy/calamanCy, SVM models.
- Layer 2 (AI enhancement): Gemini for contextual grammar, OCR, and rubric feedback.

Benefits:
- Fast baseline outputs from deterministic components.
- Higher-quality contextual suggestions via Gemini.
- Graceful fallback behavior when AI services are unavailable.

## 5. Core Capabilities

| Capability | Description | Status |
| --- | --- | --- |
| Student Proficiency Classification | HistGradientBoosting predicts Frustration, Instructional, Independent | Implemented |
| Text Complexity Analysis | SVM predicts Literal, Inferential, Evaluative | Implemented |
| Rubric-Based Grading | AI-generated criterion-level feedback and summary | Implemented |
| Grammar and Spelling | LanguageTool + SymSpell + Gemini enhancements | Implemented |
| Material Library | Upload, detect language, filter by language/complexity | Implemented |
| Material Checker (G7) | DepEd MELCs verdict from complexity model output | Implemented |
| OCR | Gemini Vision image text extraction | Implemented |
| PDF Text Extraction | pypdf extraction for uploaded PDFs | Implemented |
| Model Retraining | Retrain from teacher-rated Supabase records | Implemented |
| Export Results | Downloadable report exports | Planned |

## 6. Component Map

### Frontend

Key components:
- Dashboard: Grade 7 complexity and proficiency analytics.
- Analyzer: Central text analysis workflow.
- MaterialLibrary: Upload/list/filter reference materials.
- MaterialChecker: G7 suitability workflow and verdict rendering.
- StudentGrading: Essay upload, rubric scoring, feedback visualization.
- GrammarChecker: Inline grammar and spelling suggestions.
- ChatInterface: AI-assisted prompt-and-response interactions.
- About: System overview, model metrics, and embedded algorithm visualizer.

Service modules:
- services/supabaseService.ts
- services/geminiService.ts
- services/grammarService.ts
- services/pythonService.ts

### Backend

Key services:
- backend/main.py: FastAPI app and endpoint orchestration.
- backend/preprocessing.py: feature extraction pipeline.
- backend/svm_models.py: complexity and proficiency model inference.
- backend/grammar_service.py: grammar pipeline integration.
- backend/tagalog_service.py: Filipino NLP utilities (calamanCy).
- backend/ocr.py: OCR extraction workflow.
- backend/train_proficiency.py, backend/train_utils.py: retraining pipeline.
- backend/scripts/train_complexity.py: complexity model retraining from Phil-IRI features.
- backend/scripts/build_complexity_features.py: feature extraction from labeled_passages.csv.

Static assets:
- public/algorithm-visualizer.html: interactive NLP pipeline walkthrough (served by Vite).

## 7. Data Inputs and Persistence

Input sources:
- Student essays (plain text).
- Reading materials (plain text, image, PDF).
- Teacher evaluation records for retraining.

Training data sources:
- ASAP2 (24,721 essays) — proficiency model.
- Phil-IRI labeled passages (G4–G10, 36 passages) — complexity model (`backend/data/labeled_passages.csv`).

Primary tables:
- teacher_evaluations
- material_uploads
- student_grading_uploads

Security model:
- Supabase Auth with JWT sessions.
- Row-Level Security (RLS) on all production tables.
- Service-key access restricted to backend tasks.

## 8. Functional Flows

### 8.1 Authentication
1. User signs in from frontend login.
2. Supabase validates credentials.
3. JWT session is issued and used for authorized calls.

### 8.2 Student Essay Grading
1. Teacher submits essay text.
2. Backend performs feature extraction.
3. Proficiency SVM predicts level and confidence.
4. Gemini produces rubric-based feedback.
5. Result is stored in student_grading_uploads and surfaced on dashboard.

### 8.3 Material Complexity
1. Teacher submits or ingests material.
2. Backend computes features and runs complexity SVM.
3. Output label is saved in material_uploads.
4. Material appears in library filters and analytics.

### 8.4 G7 Suitability (Material Checker)
1. Teacher pastes or uploads text.
2. Complexity endpoint returns predicted level + readability metrics.
3. Verdict mapping is applied:
   - Literal: Ready for Grade 7
   - Inferential: Use with Teacher Support
   - Evaluative: Above Grade 7 Level
4. Phil-IRI display level is shown as informational context.

### 8.5 Grammar Checking
1. User submits text.
2. LanguageTool returns rule-based issues.
3. Gemini refines semantic/contextual suggestions.
4. Combined results are shown in UI.

### 8.6 Model Retraining
1. Teacher-rated samples are saved in teacher_evaluations.
2. Retrain endpoint validates minimum sample threshold.
3. Grid search retrains model artifacts.
4. Performance metrics are updated and exposed via API.

## 9. API Surface (Summary)

| Endpoint | Purpose |
| --- | --- |
| GET /health | Service health and model availability |
| POST /analyze/student | Student proficiency prediction |
| POST /analyze/complexity | Material complexity prediction |
| POST /analyze/rubric | Rubric evaluation and feedback |
| POST /ocr/extract | Image text extraction |
| POST /reference/ingest | Reference material ingestion |
| POST /train/retrain | Trigger model retraining |
| GET /train/status | Retraining status |
| GET /train/performance | Model performance metrics |

## 10. Performance Snapshot

Observed production targets and averages:
- API response: target < 200ms, average around 120ms.
- Grammar check: target < 1s, average around 650ms.
- OCR and AI responses: target < 5s, average around 3.5s.
- SVM prediction: target < 50ms, average around 25ms.

## 11. Security and Compliance Controls

- Secrets stored in environment variables only.
- API keys are never exposed in frontend bundles.
- Input validation for text, file type, and payload shape.
- CORS restrictions on approved origins.
- Error handling avoids leaking stack traces or credentials.

Required environment variables:
- SUPABASE_URL
- SUPABASE_KEY
- SUPABASE_SERVICE_KEY
- GEMINI_API_KEY

## 12. Known Limitations

- Filipino feature extraction for SVM still relies on en_core_web_sm in parts of preprocessing, which can reduce POS-derived feature quality for Filipino text.
- Current model retraining depends on sufficient teacher-labeled samples.
- Export workflows are not yet fully implemented.

Recommended next engineering action:
- Migrate Filipino feature extraction in backend/preprocessing.py to calamanCy for POS- and dependency-based features.

## 13. Deployment and Operations

Supported deployment shape:
- Frontend: static hosting (Vercel/Netlify or equivalent).
- Backend: Railway/Render containerized FastAPI service.
- Database/Auth: Supabase cloud.

Relevant configuration files:
- Dockerfile
- backend/Dockerfile
- docker-compose.yml
- Procfile
- railway.toml
- render.yaml

## 14. Validation and Testing Coverage

Validated scenarios include:
- Proficiency and complexity classification.
- Rubric generation.
- Grammar and spelling suggestions.
- OCR and PDF extraction.
- Auth and persistence paths.
- Error handling and concurrent request handling.

## 15. References

- Supabase Docs: https://supabase.com/docs
- FastAPI Docs: https://fastapi.tiangolo.com/
- React Docs: https://react.dev/
- Vite Docs: https://vitejs.dev/
- calamanCy Model: https://huggingface.co/ljvmiranda921/tl_calamancy_md
- Gemini Overview: https://ai.google/discover/gemini/
