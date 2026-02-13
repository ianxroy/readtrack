import calamancy
import uvicorn
from fastapi import FastAPI, APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Calamancy Tagalog API")
router = APIRouter()

nlp = None
model_versions = ["tl_calamancy_md-0.2.0", "tl_calamancy_md-0.1.0"]

print("Initializing Tagalog NLP Model")
for version in model_versions:
    try:
        print(f"Attempting to load {version}...")
        nlp = calamancy.load(version)
        print(f"Success: Loaded {version}")
        break
    except Exception:
        continue

if not nlp:
    print("Warning: No compatible Tagalog model found.")

class TagalogAnalysisRequest(BaseModel):
    text: str

class TokenInfo(BaseModel):
    text: str
    lemma: str
    pos: str
    morphology: str
    dep: str

class EntityInfo(BaseModel):
    text: str
    label: str
    start: int
    end: int

class TagalogAnalysisResponse(BaseModel):
    tokens: List[TokenInfo]
    entities: List[EntityInfo]
    original_text: str
    token_count: int
    entity_count: int

@router.post("/api/tagalog/analyze", response_model=TagalogAnalysisResponse)
async def analyze_tagalog(request: TagalogAnalysisRequest):

    if not nlp:
        raise HTTPException(status_code=500, detail="Tagalog model not loaded.")

    try:
        doc = nlp(request.text)

        tokens = [
            TokenInfo(
                text=token.text,
                lemma=token.lemma_,
                pos=token.pos_,
                morphology=str(token.morph),
                dep=token.dep_
            )
            for token in doc
        ]

        entities = [
            EntityInfo(
                text=ent.text,
                label=ent.label_,
                start=ent.start_char,
                end=ent.end_char
            )
            for ent in doc.ents
        ]

        result = TagalogAnalysisResponse(
            tokens=tokens,
            entities=entities,
            original_text=request.text,
            token_count=len(tokens),
            entity_count=len(entities)
        )

        return result

    except Exception as e:
        print(f"Error analyzing text: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.get("/api/tagalog/health")
async def health_check():

    return {
        "status": "healthy" if nlp else "degraded",
        "model_loaded": nlp is not None,
        "service": "Tagalog NLP Service"
    }

@router.post("/api/tagalog/pos-tags")
async def get_pos_tags(request: TagalogAnalysisRequest):
    if not nlp:
        raise HTTPException(status_code=500, detail="Tagalog model not loaded")

    doc = nlp(request.text)
    pos_tags = [{"text": t.text, "pos": t.pos_, "tag": t.tag_} for t in doc]

    return {"text": request.text, "pos_tags": pos_tags}

@router.post("/api/tagalog/morphology")
async def get_morphology(request: TagalogAnalysisRequest):
    if not nlp:
        raise HTTPException(status_code=500, detail="Tagalog model not loaded")

    doc = nlp(request.text)
    morphology = [
        {
            "text": t.text,
            "lemma": t.lemma_,
            "morphology": dict(t.morph) if t.morph else {}
        }
        for t in doc
    ]

    return {"text": request.text, "morphology": morphology}

app.include_router(router)

if __name__ == "__main__":

    uvicorn.run(app, host="127.0.0.1", port=8000)