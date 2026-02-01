# Tagalog NLP Service

## Overview
The Tagalog service provides Natural Language Processing capabilities for Tagalog text using the calamanCy library. It's integrated into the ReadTrack FastAPI backend.

## Features
- **POS Tagging**: Part-of-speech tagging for Tagalog text
- **Morphological Analysis**: Detailed morphological features (Aspect, Case, Number, etc.)
- **Named Entity Recognition**: Identify and extract named entities
- **Lemmatization**: Get base forms of words
- **Dependency Parsing**: Syntactic dependency relationships

## API Endpoints

### 1. Health Check
**GET** `/api/tagalog/health`

Check if the Tagalog service is running and the model is loaded.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_name": "tl_calamancy_md-0.2.0",
  "service": "Tagalog NLP Service"
}
```

### 2. Full Analysis
**POST** `/api/tagalog/analyze`

Perform complete linguistic analysis on Tagalog text.

**Request Body:**
```json
{
  "text": "Ibinigay ng guro ang mga libro sa mga mag-aaral."
}
```

**Response:**
```json
{
  "tokens": [
    {
      "text": "Ibinigay",
      "lemma": "bigay",
      "pos": "VERB",
      "morphology": "Aspect=Perf|Voice=Pass",
      "dep": "ROOT"
    }
    // ... more tokens
  ],
  "entities": [
    {
      "text": "guro",
      "label": "PER",
      "start": 11,
      "end": 15
    }
  ],
  "original_text": "Ibinigay ng guro ang mga libro sa mga mag-aaral.",
  "token_count": 9,
  "entity_count": 1
}
```

### 3. POS Tags Only
**POST** `/api/tagalog/pos-tags`

Get only part-of-speech tags for quick grammatical analysis.

**Request Body:**
```json
{
  "text": "Ang bata ay tumatakbo sa parke."
}
```

**Response:**
```json
{
  "text": "Ang bata ay tumatakbo sa parke.",
  "pos_tags": [
    {
      "text": "Ang",
      "pos": "DET",
      "tag": "DET"
    }
    // ... more tags
  ],
  "count": 7
}
```

### 4. Morphology Analysis
**POST** `/api/tagalog/morphology`

Get detailed morphological features for each token.

**Request Body:**
```json
{
  "text": "Kumain sila ng masarap na pagkain."
}
```

**Response:**
```json
{
  "text": "Kumain sila ng masarap na pagkain.",
  "morphology": [
    {
      "text": "Kumain",
      "lemma": "kain",
      "pos": "VERB",
      "morphology": {
        "Aspect": "Perf",
        "Voice": "Act"
      }
    }
    // ... more morphology data
  ],
  "count": 7
}
```

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Download Tagalog Model
The model will be automatically downloaded the first time you import the service:
```python
import calamancy
nlp = calamancy.load("tl_calamancy_md-0.2.0")
```

Alternatively, install manually:
```bash
pip install https://huggingface.co/ljvmiranda921/tl_calamancy_md/resolve/main/tl_calamancy_md-0.2.0-py3-none-any.whl
```

### 3. Start the Server
```bash
cd backend
uvicorn main:app --reload --port 8000
```

The server will start at `http://localhost:8000`

### 4. Test the API
Run the test script:
```bash
python test_tagalog_api.py
```

Or use curl:
```bash
# Health check
curl http://localhost:8000/api/tagalog/health

# Analyze text
curl -X POST http://localhost:8000/api/tagalog/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"Kumusta! Ako ay estudyante."}'
```

## Integration with Main App

The Tagalog service is automatically integrated in `main.py`:

```python
from tagalog_service import router as tagalog_router

app.include_router(tagalog_router)
```

## Model Information

- **Model**: tl_calamancy_md-0.2.0
- **Library**: calamanCy (spaCy pipeline for Tagalog)
- **Size**: Medium (md) model with transformer support
- **Capabilities**: POS tagging, NER, dependency parsing, morphology

## Performance Notes

- The model runs on CPU by default
- First load may take a few seconds
- For better performance, use a GPU-enabled environment
- The transformer model provides high accuracy but slower inference

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `500`: Server error (model not loaded, analysis failed)

Example error response:
```json
{
  "detail": "Tagalog model not loaded. Please ensure the model is installed."
}
```

## Example Use Cases

1. **Language Learning Apps**: Analyze student-written Tagalog text
2. **Grammar Checkers**: Identify POS and morphological features
3. **Content Analysis**: Extract entities from Tagalog documents
4. **Text Complexity Analysis**: Evaluate difficulty based on linguistic features

## Troubleshooting

### Model Not Loading
```python
# Check if calamancy is installed
pip show calamancy

# Reinstall if needed
pip install --upgrade calamancy
```

### Import Errors
Make sure FastAPI and dependencies are installed:
```bash
pip install fastapi uvicorn pydantic
```

### API Connection Issues
- Verify server is running: `http://localhost:8000`
- Check firewall settings
- Ensure correct port (8000)

## References

- [calamanCy Documentation](https://github.com/ljvmiranda921/calamanCy)
- [spaCy Documentation](https://spacy.io/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
