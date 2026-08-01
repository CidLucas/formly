from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import surveys, public, contacts, responses

app = FastAPI(title="Formly", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Rotas protegidas (auth required)
app.include_router(surveys.router, prefix="/api/surveys", tags=["surveys"])
app.include_router(contacts.router, prefix="/api/contacts", tags=["contacts"])
app.include_router(responses.router, prefix="/api/surveys", tags=["responses"])

# Rotas públicas (sem auth)
app.include_router(public.router, prefix="/api/public", tags=["public"])
