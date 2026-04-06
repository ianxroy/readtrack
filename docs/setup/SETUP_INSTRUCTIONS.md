# ReadTrack Setup Instructions

## Prerequisites

- **Node.js** v18 or higher ([Download](https://nodejs.org/))
- **Python** 3.8 or higher ([Download](https://www.python.org/downloads/))
- **Git** (for cloning the repository)

---

## Setup Guide

### 1. Clone the Repository

```bash
git clone <repository-url>
cd readtrack
```

### 2. Backend Setup

#### Step 2.1: Navigate to Backend Directory

```bash
cd backend
```

#### Step 2.2: Create Virtual Environment

**macOS/Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows (PowerShell):**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**
```cmd
python -m venv .venv
.venv\Scripts\activate.bat
```

#### Step 2.3: Install Python Dependencies

```bash
pip install -r requirements.txt
```

This will install all required packages including:
- FastAPI & Uvicorn (web framework)
- spaCy, Calamancy (NLP models for English & Tagalog)
- scikit-learn, XGBoost, PyTorch (machine learning)
- Google Generative AI (Gemini API)
- Language Tool (grammar checking)
- And more...

#### Step 2.4: Download spaCy Model

```bash
python -m spacy download en_core_web_sm
```

#### Step 2.5: Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Copy from example
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

Get your API key from: [Google AI Studio](https://aistudio.google.com/apikey)

#### Step 2.6: Verify ML Models

Make sure the trained models exist in `backend/models/`:
- `complexity_model.pkl` (Text complexity classifier)
- `proficiency_model.pkl` (Student proficiency classifier)

If they're missing, you can train them (see [Training Models](#training-models-optional) section).

#### Step 2.7: Start Backend Server

```bash
python main.py
```

**Alternative method:**
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

✅ **Backend runs at:** http://localhost:8000

Test it by visiting: http://localhost:8000 in your browser

---

### 3. Frontend Setup

Open a **new terminal** in the project root directory.

#### Step 3.1: Install Node Dependencies

```bash
npm install
```

This installs:
- React 19, React Router, React Icons
- Vite (build tool)
- Supabase client
- Google Generative AI
- Recharts, Framer Motion
- TypeScript

#### Step 3.2: Configure Environment Variables

Create a `.env` file in the **root** directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

> **Note:** The frontend uses Supabase for authentication and data storage. The Supabase configuration is currently hardcoded in `services/supabaseService.ts`. For production, move these to environment variables.

#### Step 3.3: Start Development Server

```bash
npm run dev
```

✅ **Frontend runs at:** http://localhost:3000

---

## Training Models (Optional)

If you need to retrain the machine learning models:

```bash
cd backend

# Train text complexity model
python train_complexity.py

# Train student proficiency model  
python train_proficiency.py
```

Trained models will be saved to `backend/models/`.

For more details, see [backend/ML_README.md](backend/ML_README.md).

---

## Project Structure

```
readtrack/
├── backend/               # Python FastAPI backend
│   ├── main.py           # Main server entry point
│   ├── requirements.txt  # Python dependencies
│   ├── models/           # Trained ML models (.pkl files)
│   ├── svm_models.py     # SVM classifier implementations
│   ├── preprocessing.py  # Feature extraction
│   ├── grammar_service.py     # Grammar checking endpoint
│   ├── tagalog_service.py     # Tagalog NLP analysis
│   └── ...
├── components/           # React components
├── services/            # Frontend services (API, Supabase)
├── context/             # React context providers
├── App.tsx              # Main React app
├── index.tsx            # Entry point
├── vite.config.ts       # Vite configuration
└── package.json         # Node dependencies
```

---

## Troubleshooting

### Backend Issues

**Problem:** `ModuleNotFoundError: No module named 'X'`
```bash
# Make sure you're in the backend directory
cd backend
# Activate virtual environment
source .venv/bin/activate  # Mac/Linux
# or .venv\Scripts\Activate.ps1  # Windows
# Reinstall dependencies
pip install -r requirements.txt
```

**Problem:** `OSError: [E050] Can't find model 'en_core_web_sm'`
```bash
python -m spacy download en_core_web_sm
```

**Problem:** Backend won't start - `FileNotFoundError` for models
```bash
# Train the models first
cd backend
python train_complexity.py
python train_proficiency.py
```

**Problem:** `No module named 'langdetect'`
```bash
cd backend
source .venv/bin/activate
pip install langdetect
```

### Frontend Issues

**Problem:** `Module not found` errors
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Problem:** Wrong port (showing 5173 instead of 3000)
- Check [vite.config.ts](vite.config.ts) - port is set to 3000
- Clear browser cache or try incognito mode

**Problem:** API calls failing
- Ensure backend is running on http://localhost:8000
- Check browser console for CORS errors
- Verify `.env` file has `GEMINI_API_KEY`

### Environment Variable Issues

**Problem:** `GEMINI_API_KEY` not found
- Make sure `.env` exists in both root and `backend/` directories
- No quotes needed around the API key value
- Restart the servers after modifying `.env`

---

## Useful Commands

### Backend
```bash
# Start server
python main.py

# Start with auto-reload (development)
python -m uvicorn main:app --reload

# Run tests
python test_models.py
python test_calamancy.py

# Check installed packages
pip list
```

### Frontend
```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Additional Resources

- **[Backend README](backend/README.md)** - Backend-specific setup and troubleshooting
- **[Machine Learning Guide](backend/ML_README.md)** - Model training and evaluation
- **[Tagalog Service](backend/TAGALOG_SERVICE_README.md)** - Tagalog NLP features
- **[System Documentation](System%20Documentation.md)** - Architecture and design

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the specific README files for each component
3. Check the console/terminal for error messages
4. Verify all prerequisites are installed correctly
