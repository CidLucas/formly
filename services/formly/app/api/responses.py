from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import get_user_id
from app.models import Survey, Response, Answer

router = APIRouter()

@router.get("/{survey_id}/stats")
def get_stats(survey_id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    """Métricas agregadas do questionário."""
    survey = db.query(Survey).filter(Survey.id == survey_id, Survey.user_id == user_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    total = db.query(Response).filter(Response.survey_id == survey_id).count()
    complete = db.query(Response).filter(Response.survey_id == survey_id, Response.status == "complete").count()
    partial = total - complete

    return {
        "total_responses": total,
        "complete": complete,
        "partial": partial,
        "completion_rate": round(complete / total * 100, 1) if total > 0 else 0,
    }

@router.get("/{survey_id}/responses")
def list_responses(
    survey_id: str,
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, le=200),
    status: str = Query(None),
):
    """Lista respostas do questionário (paginado)."""
    survey = db.query(Survey).filter(Survey.id == survey_id, Survey.user_id == user_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    q = db.query(Response).filter(Response.survey_id == survey_id)
    if status:
        q = q.filter(Response.status == status)

    total = q.count()
    responses = q.order_by(Response.completed_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    result = []
    for r in responses:
        answers = db.query(Answer).filter(Answer.response_id == r.id).all()
        result.append({
            "id": str(r.id),
            "status": r.status.value,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "answers": [
                {
                    "question_id": str(a.question_id),
                    "value_text": a.value_text,
                    "value_choices": a.value_choices,
                    "scale_value": a.scale_value,
                    "audio_url": a.audio_url,
                    "transcription": a.transcription,
                    "file_url": a.file_url,
                    "file_name": a.file_name,
                }
                for a in answers
            ],
        })

    return {"data": result, "total": total, "page": page, "per_page": per_page}
