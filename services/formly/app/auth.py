"""
Auth dependency — wrapper sobre blu_auth para o Formly.

Usa `get_auth_result` do blu_auth.fastapi.dependencies que:
- Valida JWT do Supabase
- Retorna AuthResult com client_id (UUID), email, auth_method
"""
from uuid import UUID

from fastapi import Depends
from blu_auth.fastapi.dependencies import get_auth_result
from blu_auth.core.models import AuthResult

__all__ = ["get_user_id", "get_user_uuid", "get_auth_result", "AuthResult"]


async def get_user_id(auth: AuthResult = Depends(get_auth_result)) -> str:
    """Retorna user_id como string para queries SQLAlchemy."""
    return str(auth.client_id)


async def get_user_uuid(auth: AuthResult = Depends(get_auth_result)) -> UUID:
    """Retorna user_id como UUID (tipado)."""
    return auth.client_id
