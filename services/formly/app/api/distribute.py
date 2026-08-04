import os
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import get_user_id
from app.models import Survey, Contact, SurveyStatus
from pydantic import BaseModel

router = APIRouter()

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")


class DistributeRequest(BaseModel):
    contact_ids: List[str] = []
    emails: List[str] = []
    message: Optional[str] = None


@router.post("/{survey_id}/distribute")
def distribute_survey(
    survey_id: str,
    data: DistributeRequest,
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db),
):
    """Dispara o questionário para os contatos selecionados.

    Fase 1 (sem integração SMTP/Resend):
    - Não há provedor de e-mail configurado por padrão.
    - Se a env var RESEND_API_KEY estiver definida E a lib `resend` estiver
      instalada, tenta o envio real. Caso contrário retorna modo "simulated"
      com o link público como alternativa de distribuição.
    """
    survey = (
        db.query(Survey)
        .filter(Survey.id == survey_id, Survey.user_id == user_id)
        .first()
    )
    if not survey:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    # Garante link público para distribuição alternativa.
    if not survey.slug:
        survey.slug = secrets.token_urlsafe(6)
        survey.status = SurveyStatus.published
        db.commit()
        db.refresh(survey)

    # Monta a lista de e-mails a partir dos contatos selecionados + e-mails de CSV.
    recipients = set(data.emails)
    if data.contact_ids:
        contacts = (
            db.query(Contact)
            .filter(Contact.user_id == user_id, Contact.id.in_(data.contact_ids))
            .all()
        )
        for c in contacts:
            if c.email:
                recipients.add(c.email)

    public_link = f"/s/{survey.slug}"
    total = len(recipients)

    mode = "real"
    try:
        import resend  # noqa: F401
    except ImportError:
        resend = None

    if not RESEND_API_KEY or resend is None:
        return {
            "status": "sent",
            "total": total,
            "sent": total,
            "failed": 0,
            "mode": "simulated",
            "public_link": public_link,
            "message": f"{total} e-mails simulados"
            + (f" (sem provedor configurado)" if total > 0 else ""),
        }

    resend.api_key = RESEND_API_KEY
    email_body = (data.message or "") + f"\n\nResponda em: {public_link}"
    sent = 0
    failed = 0
    for email in recipients:
        try:
            resend.Emails.send(
                {
                    "from": "Formly <onboarding@resend.dev>",
                    "to": [email],
                    "subject": f"Questionário: {survey.title}",
                    "text": email_body,
                }
            )
            sent += 1
        except Exception:
            failed += 1

    return {
        "status": "sent",
        "total": total,
        "sent": sent,
        "failed": failed,
        "mode": mode,
        "public_link": public_link,
        "message": f"{sent} e-mails enviados",
    }