import calamancy
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

# Load the Tagalog model
try:
    nlp = calamancy.load("tl_calamancy_md-0.2.0")
    print("✓ Tagalog model loaded successfully")
except Exception as e:
    print(f"✗ Error loading Tagalog model: {e}")
    nlp = None

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
    """
    Analyze Tagalog text for POS tagging, morphology, and named entities.
    
    Example request:
    {
        "text": "Ibinigay ng guro ang mga libro sa mga mag-aaral."
    }
    """
    if not nlp:
        raise HTTPException(status_code=500, detail="Tagalog model not loaded. Please ensure the model is installed.")
    
    try:
        doc = nlp(request.text)
        
        # Extract token information
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
        
        # Extract entities
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
        
        # Log to console
        print(f"\n--- Tagalog Analysis ---")
        print(f"Text: {request.text[:50]}...")
        print(f"Tokens: {len(tokens)}, Entities: {len(entities)}")
        print("------------------------\n")
        
        return result
    
    except Exception as e:
        import traceback
        print(f"Error analyzing Tagalog text: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.get("/api/tagalog/health")
async def health_check():
    """Check if the Tagalog service is running and model is loaded."""
    return {
        "status": "healthy" if nlp else "unhealthy",
        "model_loaded": nlp is not None,
        "model_name": "tl_calamancy_md-0.2.0" if nlp else None,
        "service": "Tagalog NLP Service"
    }

@router.post("/api/tagalog/pos-tags")
async def get_pos_tags(request: TagalogAnalysisRequest):
    """
    Get only POS tags for Tagalog text.
    Useful for quick grammatical analysis.
    """
    if not nlp:
        raise HTTPException(status_code=500, detail="Tagalog model not loaded")
    
    try:
        doc = nlp(request.text)
        pos_tags = [
            {
                "text": token.text,
                "pos": token.pos_,
                "tag": token.tag_
            }
            for token in doc
        ]
        
        return {
            "text": request.text,
            "pos_tags": pos_tags,
            "count": len(pos_tags)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"POS tagging failed: {str(e)}")

@router.post("/api/tagalog/morphology")
async def get_morphology(request: TagalogAnalysisRequest):
    """
    Get detailed morphological analysis for Tagalog text.
    Returns features like Aspect, Case, and Number.
    """
    if not nlp:
        raise HTTPException(status_code=500, detail="Tagalog model not loaded")
    
    try:
        doc = nlp(request.text)
        morphology = [
            {
                "text": token.text,
                "lemma": token.lemma_,
                "pos": token.pos_,
                "morphology": dict(token.morph) if token.morph else {}
            }
            for token in doc
        ]
        
        return {
            "text": request.text,
            "morphology": morphology,
            "count": len(morphology)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Morphology analysis failed: {str(e)}")