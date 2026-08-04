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
    from_email: Optional[str] = None


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

    # Remetente: e-mail informado pelo usuário no envio (ou do JWT em dev).
    sender_email = (data.from_email or "").strip() or getattr(auth, "email", None) or "usuario"
    sender_name = (sender_email.split("@")[0] or "Alguém").capitalize()

    survey_title = survey.title or "Formly"
    message_html = ""
    if data.message and data.message.strip():
        message_html = f'<p style="font-size:15px;line-height:1.6;color:#1a1a1a;margin:0 0 20px;">“{data.message.strip()}”</p>'

    email_html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#E7E6E0;font-family:Georgia,'Times New Roman',Times,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E7E6E0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FCFBF8;border:1.5px solid #C9C7BE;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#7A2E3F;padding:24px 32px;">
            <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.02em;">formly</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            {message_html}
            <p style="font-size:15px;line-height:1.6;color:#1a1a1a;margin:0 0 6px;">
              Você recebeu um questionário <strong style="color:#7A2E3F;">{survey_title}</strong>
              de {sender_name} ({sender_email}).
            </p>
            <p style="font-size:15px;line-height:1.6;color:#6E6D66;margin:0 0 24px;">
              Sua opinião é importante — leva menos de 2 minutos.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:6px;background:#7A2E3F;">
                  <a href="{full_link}" target="_blank"
                     style="display:inline-block;padding:14px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px;">
                    Responder questionário →
                  </a>
                </td>
              </tr>
            </table>
            <p style="font-size:13px;line-height:1.5;color:#6E6D66;margin:24px 0 0;">
              Ou copie o link: <span style="font-family:'SF Mono','Fira Code',monospace;font-size:12px;color:#3B5B52;">{full_link}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#F3F2EE;padding:16px 32px;border-top:1px solid #C9C7BE;">
            <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#6E6D66;">
              Formly — questionários com áudio e IA
            </span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    # Versão texto (fallback p/ clientes sem HTML).
    email_text = "\n".join([
        f'"{data.message.strip()}"' if data.message and data.message.strip() else "",
        "",
        f"Você recebeu um questionário {survey_title} de {sender_name} ({sender_email}).",
        "",
        "Para responder, acesse:",
        full_link,
    ])

    subject = f"Você recebeu um questionário: {survey_title}"
    sent = 0
    failed = 0
    for email in recipients:
        try:
            resend.Emails.send(
                {
                    "from": "Formly <onboarding@resend.dev>",
                    "to": [email],
                    "subject": subject,
                    "text": email_text,
                    "html": email_html,
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