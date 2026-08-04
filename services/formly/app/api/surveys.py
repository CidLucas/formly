import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import get_user_id
from app.models import Survey, Question, SurveyStatus, QuestionType
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

# ── Serialização ──

def serialize_survey(survey):
    """Serializa survey + perguntas (mesmo formato do endpoint público)."""
    return {
        "id": str(survey.id),
        "user_id": str(survey.user_id),
        "title": survey.title,
        "slug": survey.slug,
        "status": survey.status.value if survey.status else None,
        "theme": survey.theme,
        "logo_url": survey.logo_url,
        "brand_colors": survey.brand_colors,
        "created_at": survey.created_at.isoformat() if survey.created_at else None,
        "published_at": survey.published_at.isoformat() if survey.published_at else None,
        "questions": [
            {
                "id": str(q.id),
                "position": q.position,
                "type": q.type.value if hasattr(q.type, "value") else q.type,
                "title": q.title,
                "required": q.required,
                "config": q.config,
            }
            for q in sorted(survey.questions, key=lambda x: x.position)
        ],
    }

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
    surveys = db.query(Survey).filter(Survey.user_id == user_id).order_by(Survey.created_at.desc()).all()
    return [serialize_survey(s) for s in surveys]

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
    return serialize_survey(survey)

@router.get("/{survey_id}")
def get_survey(survey_id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    """Carrega questionário com perguntas (apenas dono)."""
    survey = db.query(Survey).filter(Survey.id == survey_id, Survey.user_id == user_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")
    return serialize_survey(survey)

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
    return serialize_survey(survey)

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
