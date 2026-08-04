"""
Dev-only login endpoint — gera JWT HS256 local para desenvolvimento.

Ativo SOMENTE quando SUPABASE_URL não está configurada (modo dev).
Em produção (Supabase configurado), retorna 404.
"""
import datetime
import os
import uuid

import jwt
from fastapi import APIRouter, HTTPException

router = APIRouter()

DEV_USER_ID = os.getenv("FORMFLY_DEV_USER_ID", "c44feede-fe22-467e-a7fb-eaaa839687ab")


@router.post("/dev/login")
def dev_login():
    """Gera token JWT dev (apenas sem Supabase configurado)."""
    if os.getenv("SUPABASE_URL"):
        raise HTTPException(status_code=404, detail="Modo dev desativado (Supabase configurado)")

    secret = os.getenv("SUPABASE_JWT_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET não configurado")

    now = datetime.datetime.now(datetime.UTC)
    claims = {
        "sub": DEV_USER_ID,
        "email": "dev@formly.local",
        "aud": "authenticated",
        "iat": now,
        "exp": now + datetime.timedelta(days=7),
    }
    token = jwt.encode(claims, secret, algorithm="HS256")
    return {"token": token, "user_id": DEV_USER_ID, "mode": "dev"}
