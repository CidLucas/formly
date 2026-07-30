import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Survey, Question, Response, Answer, ResponseStatus

router = APIRouter()

@router.get("/surveys/{slug}")
def get_public_survey(slug: str, db: Session = Depends(get_db)):
    """Retorna questionário público pelo slug (sem auth)."""
    survey = db.query(Survey).filter(Survey.slug == slug, Survey.status == "published").first()
    if not survey:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")
    return {
        "id": str(survey.id),
        "title": survey.title,
        "theme": survey.theme,
        "logo_url": survey.logo_url,
        "brand_colors": survey.brand_colors,
        "questions": [
            {
                "id": str(q.id),
                "position": q.position,
                "type": q.type.value,
                "title": q.title,
                "required": q.required,
                "config": q.config,
            }
            for q in sorted(survey.questions, key=lambda x: x.position)
        ],
    }

@router.post("/surveys/{slug}/responses")
def submit_response(slug: str, data: dict, db: Session = Depends(get_db)):
    """Recebe resposta completa do respondente (sem auth)."""
    survey = db.query(Survey).filter(Survey.slug == slug, Survey.status == "published").first()
    if not survey:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    response = Response(
        id=uuid.uuid4(),
        survey_id=survey.id,
        status=ResponseStatus.complete,
        respondent_ref=data.get("respondent_ref"),
    )
    db.add(response)

    for answer_data in data.get("answers", []):
        answer = Answer(
            id=uuid.uuid4(),
            response_id=response.id,
            question_id=answer_data["question_id"],
            value_text=answer_data.get("value_text"),
            value_choices=answer_data.get("value_choices"),
            scale_value=answer_data.get("scale_value"),
            audio_url=answer_data.get("audio_url"),
            transcription=answer_data.get("transcription"),
            file_url=answer_data.get("file_url"),
            file_name=answer_data.get("file_name"),
        )
        db.add(answer)

    db.commit()
    return {"id": str(response.id), "status": "complete"}

@router.post("/surveys/{slug}/responses/partial")
def save_partial(slug: str, data: dict, db: Session = Depends(get_db)):
    """Salva resposta parcial (sem auth)."""
    survey = db.query(Survey).filter(Survey.slug == slug, Survey.status == "published").first()
    if not survey:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    response = Response(
        id=uuid.uuid4(),
        survey_id=survey.id,
        status=ResponseStatus.partial,
        respondent_ref=data.get("respondent_ref"),
    )
    db.add(response)
    db.commit()
    return {"id": str(response.id), "status": "partial"}
