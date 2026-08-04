import os
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import get_user_id, get_auth_result
from app.models import Survey, Contact, SurveyStatus
from pydantic import BaseModel
from blu_auth.core.models import AuthResult

router = APIRouter()

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
# URL pública do app (domínio de produção ou IP dev) — usada no link do e-mail.
PUBLIC_URL = os.getenv("FORMLY_PUBLIC_URL", "http://localhost:5173").rstrip("/")


class DistributeRequest(BaseModel):
    contact_ids: List[str] = []
    emails: List[str] = []
    message: Optional[str] = None


@router.post("/{survey_id}/distribute")
def distribute_survey(
    survey_id: str,
    data: DistributeRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
    auth: AuthResult = Depends(get_auth_result),
    db: Session = Depends(get_db),
):
    """Dispara o questionário para os e-mails selecionados.

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
    full_link = f"{PUBLIC_URL}{public_link}"
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

    # Remetente: nome exibido = e-mail/usuário logado, senão "Formly".
    sender_email = getattr(auth, "email", None) or "usuario"
    sender_name = (sender_email.split("@")[0] or "Alguém").capitalize()

    # Mensagem personalizada (se houver) + contexto + link clicável.
    parts = []
    if data.message and data.message.strip():
        parts.append(f'"{data.message.strip()}"')
        parts.append("")
    parts.append(
        f"Você recebeu um questionário {survey.title or 'Formly'} "
        f"de {sender_name} ({sender_email})."
    )
    parts.append("")
    parts.append("Para responder, acesse o link abaixo:")
    parts.append(full_link)
    email_body = "\n".join(parts)

    subject = f"Questionário: {survey.title or 'Formly'}"
    sent = 0
    failed = 0
    for email in recipients:
        try:
            resend.Emails.send(
                {
                    "from": "Formly <onboarding@resend.dev>",
                    "to": [email],
                    "subject": subject,
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