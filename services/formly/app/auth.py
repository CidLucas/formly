from fastapi import Depends, HTTPException, Request
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_KEY

def get_supabase() -> Client:
    """Retorna cliente Supabase (admin — usar com cuidado)."""
    return create_client(SUPABASE_URL, SUPABASE_KEY)

async def get_current_user(request: Request) -> dict:
    """Extrai usuário autenticado do token JWT no header Authorization."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token não informado")

    token = auth_header.split(" ")[1]
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    try:
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Token inválido ou expirado")
        return {"id": user.user.id, "email": user.user.email}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Falha na autenticação: {str(e)}")

# Dependency: injeta user_id em rotas protegidas
def get_user_id(user: dict = Depends(get_current_user)) -> str:
    return user["id"]
