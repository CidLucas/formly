import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response as ApiResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import get_user_id
from app.models import Survey, Response, Answer, Question

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

    audio_responses = (
        db.query(Answer)
        .join(Response, Answer.response_id == Response.id)
        .filter(Response.survey_id == survey_id, Answer.audio_url.isnot(None))
        .count()
    )

    avg_scale = (
        db.query(func.avg(Answer.scale_value))
        .join(Question, Answer.question_id == Question.id)
        .join(Response, Answer.response_id == Response.id)
        .filter(Response.survey_id == survey_id, Question.type == "scale", Answer.scale_value.isnot(None))
        .scalar()
    )

    return {
        "total_responses": total,
        "complete": complete,
        "partial": partial,
        "completion_rate": round(complete / total * 100, 1) if total > 0 else 0,
        "audio_responses": audio_responses,
        "avg_scale": round(float(avg_scale), 2) if avg_scale is not None else None,
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
            "time_spent_secs": r.time_spent_secs,
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

def _answer_cell(a: Answer) -> str:
    """Serializa uma answer em string para exportação CSV."""
    if a.value_text is not None:
        return a.value_text
    if a.value_choices is not None:
        return "; ".join(str(c) for c in a.value_choices)
    if a.scale_value is not None:
        return str(a.scale_value)
    if a.transcription is not None:
        return a.transcription
    return ""

@router.get("/{survey_id}/export")
def export_survey(
    survey_id: str,
    format: str = Query("csv"),
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db),
):
    """Exporta respostas do questionário em CSV."""
    if format != "csv":
        raise HTTPException(status_code=400, detail="Formato não suportado. Use ?format=csv")

    survey = db.query(Survey).filter(Survey.id == survey_id, Survey.user_id == user_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    questions = sorted(survey.questions, key=lambda x: x.position)
    header = [q.title for q in questions] + ["respondent_ref", "started_at", "completed_at"]

    responses = db.query(Response).filter(Response.survey_id == survey_id).order_by(Response.started_at).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)

    for r in responses:
        answers = {a.question_id: a for a in r.answers}
        row = [_answer_cell(answers[q.id]) if q.id in answers else "" for q in questions]
        row += [
            r.respondent_ref or "",
            r.started_at.isoformat() if r.started_at else "",
            r.completed_at.isoformat() if r.completed_at else "",
        ]
        writer.writerow(row)

    csv_bytes = b"\xef\xbb\xbf" + buf.getvalue().encode("utf-8")
    return ApiResponse(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="survey_{survey_id}.csv"'},
    )
