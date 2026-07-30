import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import get_user_id
from app.models import Survey, Question, SurveyStatus, QuestionType
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

# ── Schemas ──

class QuestionSchema(BaseModel):
    id: Optional[str] = None
    type: QuestionType
    title: str
    required: bool = False
    config: dict = {}

class SurveyCreate(BaseModel):
    title: str
    questions: List[QuestionSchema] = []

class SurveyUpdate(BaseModel):
    title: Optional[str] = None
    questions: Optional[List[QuestionSchema]] = None

# ── CRUD ──

@router.get("/")
def list_surveys(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    """Lista questionários do usuário autenticado."""
    return db.query(Survey).filter(Survey.user_id == user_id).order_by(Survey.created_at.desc()).all()

@router.post("/")
def create_survey(data: SurveyCreate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    """Cria novo questionário com perguntas."""
    survey = Survey(
        id=uuid.uuid4(),
        user_id=user_id,
        title=data.title,
    )
    db.add(survey)

    for i, q in enumerate(data.questions):
        question = Question(
            id=uuid.uuid4(),
            survey_id=survey.id,
            position=i + 1,
            type=q.type,
            title=q.title,
            required=q.required,
            config=q.config,
        )
        db.add(question)

    db.commit()
    db.refresh(survey)
    return survey

@router.get("/{survey_id}")
def get_survey(survey_id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    """Carrega questionário com perguntas (apenas dono)."""
    survey = db.query(Survey).filter(Survey.id == survey_id, Survey.user_id == user_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")
    return survey

@router.patch("/{survey_id}")
def update_survey(survey_id: str, data: SurveyUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    """Atualiza questionário e/ou perguntas."""
    survey = db.query(Survey).filter(Survey.id == survey_id, Survey.user_id == user_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    if data.title is not None:
        survey.title = data.title

    if data.questions is not None:
        # Remove perguntas antigas e recria
        db.query(Question).filter(Question.survey_id == survey_id).delete()
        for i, q in enumerate(data.questions):
            question = Question(
                id=uuid.uuid4(),
                survey_id=survey.id,
                position=i + 1,
                type=q.type,
                title=q.title,
                required=q.required,
                config=q.config,
            )
            db.add(question)

    db.commit()
    db.refresh(survey)
    return survey

@router.post("/{survey_id}/publish")
def publish_survey(survey_id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    """Publica questionário — gera slug público."""
    survey = db.query(Survey).filter(Survey.id == survey_id, Survey.user_id == user_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    import secrets
    survey.slug = secrets.token_urlsafe(6)
    survey.status = SurveyStatus.published
    db.commit()
    db.refresh(survey)
    return {"slug": survey.slug, "url": f"/s/{survey.slug}"}
