# T1 — Backend: endpoints de IA, transcrição e exportação

Repo: /home/ec2-user/formly (monorepo: `services/formly` = FastAPI, `apps/formly_app` = Vite React)
Venv: /home/ec2-user/formly/services/formly/.venv/bin/python (Python 3.12)
Backend já roda em http://localhost:8000 (uvicorn, porta 8000).

## Contexto

O backend FastAPI em `services/formly/app/` já tem:
- `models.py` — SQLAlchemy: Survey, Question, Response, Answer, Contact (5 tabelas)
- `api/surveys.py` — CRUD surveys + publish (gera slug)
- `api/public.py` — GET /api/public/surveys/{slug}, POST .../responses, POST .../partial
- `api/responses.py` — GET /{survey_id}/stats, GET /{survey_id}/responses (registrado com prefix /api/surveys no main.py)
- `api/contacts.py` — CRUD contacts
- `services/llm_service.py` — usa `blu_llm_service` do monorepo (DeepSeek): `generate_survey_skeleton(description)`, `chat_refinement(survey_json, user_message)`, `generate_refinement_questions(description)`
- `auth.py` — get_user_id via blu_auth (JWT)
- `config.py` — DATABASE_URL, SUPABASE_*, S3_*, GROQ_API_KEY vem do ambiente

## Tarefas

### 1. Criar `services/formly/app/api/ai.py` — router com prefix `/api/ai` (protegido: user_id via Depends(get_user_id))

Endpoints (todos POST, JSON):

- `POST /api/ai/skeleton` — body: `{"description": "texto livre"}` → chama `generate_survey_skeleton(description)` → retorna o dict {title, questions} da lib. Adiciona try/except: se a lib falhar (ex: JSON inválido), retorna 502 com detail amigável.
- `POST /api/ai/refinement-questions` — body: `{"description": "..."}` → `generate_refinement_questions(description)` → retorna `{"questions": [...]}`.
- `POST /api/ai/refine` — body: `{"survey": {...}, "message": "pedido do usuário"}` → `chat_refinement(survey, message)` → retorna `{"reply": "texto"}`.

### 2. Criar `services/formly/app/api/transcribe.py` — router com prefix `/api/transcribe` (público, sem auth)

- `POST /api/transcribe` — recebe multipart upload com campo `file` (arquivo de áudio webm/mp3/ogg/wav) e opcional `language` (default "pt").
  - Usa a lib `groq` (já em pyproject.toml): `from groq import Groq; client = Groq(api_key=os.getenv("GROQ_API_KEY"))`
  - `client.audio.transcriptions.create(model="whisper-large-v3-turbo", file=(filename, file_bytes, mimetype), language=language)` (ou whisper-large-v3; use whisper-large-v3-turbo)
  - Retorna `{"text": "...", "duration_secs": N}` (duration opcional — pode omitir se não vier)
  - Se GROQ_API_KEY ausente → 503 com detail claro.
  - Se transcrição falhar → 502 com detail.
  - Limite de tamanho: rejeitar > 25MB com 413.

### 3. Melhorar `services/formly/app/api/responses.py`

Adicionar a `GET /{survey_id}/stats`:
- `audio_responses`: count de answers com audio_url não nulo (query em Answer join Response onde survey_id)
- `avg_scale`: média de scale_value nas answers de perguntas tipo scale (JOIN questions onde type='scale')
- manter campos existentes (total_responses, complete, partial, completion_rate)

### 4. Criar export CSV em `services/formly/app/api/responses.py`

- `GET /{survey_id}/export?format=csv` — protegido.
  - Gera CSV em memória: cabeçalho = título de cada pergunta (na ordem) + colunas "respondent_ref", "started_at", "completed_at".
  - Uma linha por resposta; célula = valor da answer (value_text OU value_choices unido por "; " OU scale_value OU transcription se audio).
  - UTF-8 com BOM (para Excel): `b"\xef\xbb\xbf" + csv_string`.
  - Retorna `Response(content=csv_bytes, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="survey_{survey_id}.csv"'})`.
  - Se format != csv → 400. Se survey não existe/não é do user → 404.

### 5. Registrar routers no `services/formly/app/main.py`

- `app.include_router(ai.router, prefix="/api/ai", tags=["ai"])`
- `app.include_router(transcribe.router, prefix="/api/transcribe", tags=["transcribe"])`
- import atualizar (from app.api import surveys, public, contacts, responses, ai, transcribe)

### 6. Corrigir CORS em `services/formly/app/main.py`

allow_origins: ["http://localhost:5173", "http://127.0.0.1:5173"]

## Critérios de aceite

- [ ] `POST /api/ai/skeleton` com description de exemplo retorna {title, questions} (testar com curl e token dev)
- [ ] `POST /api/transcribe` responde 400/413 sem arquivo e 503 sem GROQ_API_KEY (não precisa testar transcrição real)
- [ ] `GET /{survey_id}/stats` retorna audio_responses e avg_scale
- [ ] `GET /{survey_id}/export?format=csv` retorna CSV com BOM
- [ ] `python -c "from app.main import app"` importa sem erro
- [ ] Todos os imports relativos a `app.` — rodar testes com o venv: `cd services/formly && .venv/bin/python -c "import app.main"`

## Token dev para testes

JWT HS256 com secret em /tmp/formly_jwt_secret.txt, sub=c44feede-fe22-467e-a7fb-eaaa839687ab, aud=authenticated.
O backend já está rodando com reload? NÃO — após editar, é preciso reiniciar o uvicorn (mate o processo na porta 8000 e suba com `bash /home/ec2-user/formly/scripts/dev-backend.sh` em background) — OU apenas valide com import/typecheck e deixe o restart para o orquestrador.

NÃO COMMITAR. Apenas editar os arquivos.
