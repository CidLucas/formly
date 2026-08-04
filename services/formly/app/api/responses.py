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


def _qtype(q) -> str:
    return q.type.value if hasattr(q.type, "value") else q.type


def _nps_parts(values):
    """Decompõe valores de escala NPS (0-10) em promoters/passives/detractors.

    Promoters = 9-10, Passives = 7-8, Detractors = 0-6.
    score = %promoters − %detractors (arredondado). Counts são ints.
    """
    n = len(values)
    if n == 0:
        return {"score": None, "promoters": 0, "passives": 0, "detractors": 0, "n": 0}
    promoters = sum(1 for v in values if v >= 9)
    passives = sum(1 for v in values if 7 <= v <= 8)
    detractors = sum(1 for v in values if v <= 6)
    return {
        "score": round((promoters - detractors) / n * 100),
        "promoters": promoters,
        "passives": passives,
        "detractors": detractors,
        "n": n,
    }


def _top2_pct(values, config):
    """% de respostas nos 2 valores mais altos da escala (frações 0-1)."""
    if not values:
        return None
    scale = int(config.get("max") or max(values))
    top = sum(1 for v in values if v >= scale - 1)
    return round(top / len(values), 4)


def _by_question_stats(question, answers):
    """Métricas por pergunta: n, distribution, avg, nps_score, top2_pct, amostras."""
    qtype = _qtype(question)
    config = question.config or {}
    distribution = {}
    values = []
    samples = []
    n = 0

    for a in answers:
        if not any([
            a.value_text,
            a.value_choices,
            a.scale_value is not None,
            a.audio_url,
            a.transcription,
            a.file_url,
            a.file_name,
        ]):
            continue
        n += 1
        if qtype in ("nps", "scale") and a.scale_value is not None:
            distribution[str(a.scale_value)] = distribution.get(str(a.scale_value), 0) + 1
            values.append(a.scale_value)
        elif qtype in ("multiple_choice", "dyn_list", "ranking", "matrix"):
            if a.value_choices:
                for c in a.value_choices:
                    if c is None:
                        continue
                    key = str(c)
                    distribution[key] = distribution.get(key, 0) + 1
            elif a.value_text and a.value_text.strip():
                key = a.value_text.strip()
                distribution[key] = distribution.get(key, 0) + 1
        if qtype in ("text_short", "text_long"):
            snippet = None
            if a.value_text and a.value_text.strip():
                snippet = a.value_text.strip()
            elif a.transcription and a.transcription.strip():
                snippet = a.transcription.strip()
            if snippet:
                samples.append(snippet[:2000])

    # Distribuição completa: preenche zeros para toda a faixa da escala.
    if qtype == "nps":
        lo = int(config.get("min") or 0)
        hi = int(config.get("max") or 10)
        for v in range(lo, hi + 1):
            distribution.setdefault(str(v), 0)
    elif qtype == "scale":
        lo = int(config.get("min") or 1)
        hi = int(config.get("max") or 5)
        for v in range(lo, hi + 1):
            distribution.setdefault(str(v), 0)

    result = {
        "question_id": str(question.id),
        "type": qtype,
        "title": question.title,
        "n": n,
        "distribution": distribution if qtype not in ("text_short", "text_long") else None,
        "avg": round(sum(values) / len(values), 2) if values else None,
    }
    if qtype == "nps":
        result["nps_score"] = _nps_parts(values)["score"]
    elif qtype == "scale":
        result["top2_pct"] = _top2_pct(values, config)
    if qtype in ("text_short", "text_long"):
        result["open_text_samples"] = samples[:20]
    return result


@router.get("/{survey_id}/stats")
def get_stats(survey_id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    """Métricas agregadas do questionário (survey-metrics)."""
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

    avg_time = (
        db.query(func.avg(Response.time_spent_secs))
        .filter(
            Response.survey_id == survey_id,
            Response.status == "complete",
            Response.time_spent_secs.isnot(None),
        )
        .scalar()
    )

    # ── Métricas novas (skill survey-metrics) ─────────────────────
    questions = sorted(survey.questions, key=lambda x: x.position)
    answers_by_q = {}
    if questions:
        all_answers = (
            db.query(Answer)
            .join(Response, Answer.response_id == Response.id)
            .filter(Response.survey_id == survey_id)
            .all()
        )
        for a in all_answers:
            answers_by_q.setdefault(str(a.question_id), []).append(a)

    def _answers(qid):
        return answers_by_q.get(str(qid), [])

    nps_question = next((q for q in questions if _qtype(q) == "nps"), None)
    csat_question = next(
        (q for q in questions if _qtype(q) == "scale" and "satisf" in q.title.lower()), None
    )
    ces_question = next(
        (
            q
            for q in questions
            if _qtype(q) == "scale" and any(k in q.title.lower() for k in ("fácil", "esforço"))
        ),
        None,
    )

    nps = None
    if nps_question:
        vals = [a.scale_value for a in _answers(nps_question.id) if a.scale_value is not None]
        nps = _nps_parts(vals)

    csat = None
    if csat_question:
        vals = [a.scale_value for a in _answers(csat_question.id) if a.scale_value is not None]
        scale = int((csat_question.config or {}).get("max") or (max(vals) if vals else 5))
        csat = {"pct_top": _top2_pct(vals, csat_question.config or {}), "scale": scale, "n": len(vals)}

    ces = None
    if ces_question:
        vals = [a.scale_value for a in _answers(ces_question.id) if a.scale_value is not None]
        scale = int((ces_question.config or {}).get("max") or (max(vals) if vals else 5))
        ces = {"pct_top": _top2_pct(vals, ces_question.config or {}), "scale": scale, "n": len(vals)}

    by_question = [_by_question_stats(q, _answers(q.id)) for q in questions]

    metric_ns = [q["n"] for q in by_question]
    if nps:
        metric_ns.append(nps["n"])
    if csat:
        metric_ns.append(csat["n"])
    if ces:
        metric_ns.append(ces["n"])
    low_n_warning = any(n < 30 for n in metric_ns)

    # Não existe tabela de distribuição/convites persistida → taxa de resposta indisponível.
    response_rate = None

    return {
        "total_responses": total,
        "complete": complete,
        "partial": partial,
        "completion_rate": round(complete / total * 100, 1) if total > 0 else 0,
        "audio_responses": audio_responses,
        "avg_scale": round(float(avg_scale), 2) if avg_scale is not None else None,
        "avg_time_secs": round(float(avg_time), 1) if avg_time is not None else None,
        "response_rate": response_rate,
        "nps": nps,
        "csat": csat,
        "ces": ces,
        "by_question": by_question,
        "low_n_warning": low_n_warning,
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