# ReadTrack - Setup & Run Instructions

**ReadTrack** is an intelligent reading and grammar analysis platform with a React frontend and Python FastAPI backend. This guide will help you set up and run the application locally.

---

## System Requirements

- **Node.js**: v18 or higher (for frontend)
- **Python**: 3.8 or higher (for backend)
- **npm**: v9 or higher (comes with Node.js)
- **pip**: Python package manager
- **Git**: Optional, for version control

---

## Project Structure

```
readtrack/
├── frontend/
│   ├── src/
│   ├── components/
│   ├── services/
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/
│   ├── main.py           # FastAPI server
│   ├── requirements.txt   # Python dependencies
│   ├── grammar_service.py
│   ├── tagalog_service.py
│   ├── ocr.py
│   ├── svm_models.py
│   └── preprocessing.py
├── SETUP_INSTRUCTIONS.md (this file)
└── README.md
```

---

## Quick Start (5 Minutes)

### Option 1: Run Backend & Frontend Separately

#### Step 1: Backend Setup

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. Create a Python virtual environment:
   ```bash
   # On Windows
   python -m venv .venv
   .venv\Scripts\activate

   # On macOS/Linux
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   - Create a `.env.local` file in the `backend` folder (or `.env`)
   - Add your Gemini API key:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```
   - If you don't have an API key, the app will still work with reduced AI features

5. Run the backend server:
   ```bash
   python main.py
   ```
   
   Expected output:
   ```
   ✓ Loaded Gemini API key: xxxxx...
   ✓ GPU acceleration enabled for spaCy (or using CPU)
   INFO:     Uvicorn running on http://127.0.0.1:8000
   ```

6. Backend is now running on **http://localhost:8000**

#### Step 2: Frontend Setup

1. Open a **new terminal** and navigate to the root project folder:
   ```bash
   cd ..
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   Expected output:
   ```
     VITE v6.2.0  ready in XXX ms

     ➜  Local:   http://localhost:5173/
   ```

4. Frontend is now running on **http://localhost:5173**

5. Open your browser to **http://localhost:5173** to use the application

---

## Environment Variables Setup

Create a `.env.local` file in the `backend/` folder with:

```env
# Google Gemini API (optional but recommended for AI features)
GEMINI_API_KEY=your_api_key_here

# Backend Port (optional, default: 8000)
# PORT=8000

# Other optional configurations
# LOG_LEVEL=INFO
```

**How to get a Gemini API Key:**
1. Visit https://ai.google.dev/
2. Sign in with your Google account
3. Create a new API key in the Google AI Studio
4. Copy the key and paste it in `.env.local`

---

## Available Commands

### Frontend Commands

```bash
npm run dev      # Start development server (http://localhost:5173)
npm run build    # Build for production
npm run preview  # Preview production build locally
```

### Backend Commands

```bash
python main.py   # Start the FastAPI server
# Server runs on http://localhost:8000/docs (interactive API docs)
```

---

## Troubleshooting

### Issue: "Module not found" or import errors in backend

**Solution:**
- Ensure your virtual environment is activated
- Run `pip install -r requirements.txt` again
- Check that Python version is 3.8+: `python --version`

### Issue: "Port 8000 already in use"

**Solution:**
- The backend port is in use. Either:
  - Close the other application using port 8000
  - Set a different port: Modify `main.py` to use a different port

### Issue: Gemini API errors

**Solution:**
- Verify your API key is correct in `.env.local`
- Check that the key has not expired
- Ensure you have API credits available
- If no key provided, the app will use fallback grammar checking (LanguageTool)

### Issue: "spaCy model not found"

**Solution:**
- The app will automatically download it on first run
- If it fails, run manually: `python -m spacy download en_core_web_sm`

### Issue: Frontend won't connect to backend

**Solution:**
- Ensure backend is running on `http://localhost:8000`
- Check that CORS is enabled in backend (should be by default)
- Clear browser cache: Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)

### Issue: npm install fails

**Solution:**
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` folder and `package-lock.json`
- Run `npm install` again
- Ensure you have Node.js v18+: `node --version`

---

## Project Features

✅ **Grammar Checking** - Detects and corrects grammatical errors  
✅ **Spell Checking** - Fast spell correction with context awareness  
✅ **Text Analysis** - Readability, complexity, and proficiency analysis  
✅ **OCR** - Extract text from images using Gemini Vision  
✅ **Tagalog Support** - Grammar checking for Tagalog text  
✅ **AI-Powered Suggestions** - Context-aware corrections using Gemini  

---

## File Descriptions

| File | Purpose |
|------|---------|
| `main.py` | FastAPI server entry point |
| `grammar_service.py` | Grammar checking service |
| `ocr.py` | OCR extraction service |
| `preprocessing.py` | Text preprocessing and feature extraction |
| `svm_models.py` | SVM machine learning models |
| `tagalog_service.py` | Tagalog-specific NLP service |
| `requirements.txt` | Python dependencies |
| `package.json` | Node.js dependencies |
| `vite.config.ts` | Vite build configuration |
| `tsconfig.json` | TypeScript configuration |

---

## API Endpoints

Once the backend is running, view interactive API documentation:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## Performance Tips

- **GPU Acceleration**: If your system has an NVIDIA GPU, the app will automatically use CUDA for faster processing
- **First Load**: The first request might be slow as models are loaded. Subsequent requests will be faster.
- **Production Build**: Use `npm run build` for optimized frontend bundle

---

## Support & Documentation

For more detailed information, see:
- `System Documentation.md` - Full system architecture and components
- `backend/README.md` - Backend-specific setup
- `backend/MODEL_SERVICES.md` - Machine learning model documentation
- `backend/TAGALOG_SERVICE_README.md` - Tagalog service specifics

---

## Getting Help

If you encounter issues:
1. Check the Troubleshooting section above
2. Review the logs in your terminal
3. Ensure all dependencies are installed: `pip install -r requirements.txt` and `npm install`
4. Verify environment variables are set correctly

---

**Last Updated**: February 2026  
**Version**: 1.0

Happy Reading! 📚
