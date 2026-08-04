from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.auth import get_user_id
from app.db import get_db
from app.services.analysis_service import analyze_responses
from app.services.llm_service import generate_survey_skeleton, generate_refinement_questions, chat_refinement

router = APIRouter()

class SkeletonRequest(BaseModel):
    description: str

class RefinementQuestionsRequest(BaseModel):
    description: str

class RefineRequest(BaseModel):
    survey: dict
    message: str

class AnalyzeRequest(BaseModel):
    survey_id: str

@router.post("/skeleton")
def skeleton(data: SkeletonRequest, user_id: str = Depends(get_user_id)):
    """Gera esqueleto de questionário a partir de descrição."""
    try:
        return generate_survey_skeleton(data.description)
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível gerar o questionário. Tente novamente com uma descrição mais clara.",
        )

@router.post("/refinement-questions")
def refinement_questions(data: RefinementQuestionsRequest, user_id: str = Depends(get_user_id)):
    """Gera perguntas de refinamento a partir da descrição."""
    questions = generate_refinement_questions(data.description)
    return {"questions": questions}

@router.post("/refine")
def refine(data: RefineRequest, user_id: str = Depends(get_user_id)):
    """Refina um questionário existente a partir de uma mensagem."""
    reply = chat_refinement(data.survey, data.message)
    return {"reply": reply}

@router.post("/analyze")
def analyze(data: AnalyzeRequest, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    """Analisa as respostas do questionário via LLM e gera relatório (Fase 4)."""
    try:
        return analyze_responses(data.survey_id, user_id, db=db)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível analisar as respostas. Tente novamente.",
        )