from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Formly", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Rotas serão registradas aqui:
# from app.api import surveys, public, contacts
# app.include_router(surveys.router, prefix="/api/surveys")
# app.include_router(public.router, prefix="/api/public")
# app.include_router(contacts.router, prefix="/api/contacts")
