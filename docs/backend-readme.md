# ReadTrack Backend

## How to Run

1. Open a terminal in the backend folder:
   ```bash
   cd /Users/ianxroy/readtrack/backend
   ```

2. Create a virtual environment (optional if `.venv` already exists):
   ```bash
   python3 -m venv .venv
   ```

3. Activate the virtual environment:

   macOS/Linux:
   ```bash
   source .venv/bin/activate
   ```

   Windows (PowerShell):
   ```powershell
   .venv\Scripts\Activate.ps1
   ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Start the API server:
   ```bash
   python -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```

The server will be available at http://localhost:8000

## Quick Health Check

```bash
curl http://localhost:8000/
```

## Troubleshooting

- If you run from the workspace root, use `--app-dir`:
  ```bash
  python -m uvicorn --app-dir /Users/ianxroy/readtrack/backend main:app --host 0.0.0.0 --port 8000
  ```
- If startup fails with `No module named 'langdetect'`, install it inside `backend/.venv`:
  ```bash
  pip install langdetect
  ```
- Ensure you are using `backend/.venv`, not `/Users/ianxroy/readtrack/.venv`.

## Documentation
- [Machine Learning Integration](ML_README.md) - Technical details on training, features, and SVM architecture.
- [Tagalog Service](TAGALOG_SERVICE_README.md) - Details on Tagalog-specific NLP.
