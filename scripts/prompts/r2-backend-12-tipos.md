# R2 — Backend: expandir tipos de pergunta para 12 + schema de resposta

Repo: /home/ec2-user/formly — backend em `services/formly` (FastAPI + SQLAlchemy, venv `.venv` Python 3.12).
Backend roda em localhost:8000 (reiniciar após mudanças: matar processo da porta 8000 e `bash /home/ec2-user/formly/scripts/dev-backend.sh` em background).
Banco: PostgreSQL 16 em docker (container `formly-pg`).

## Contexto

O protótipo canônico define **12 tipos de pergunta** (ver `scripts/reference/formly-site/formly-tipos-v2.html`). O backend atual tem 6 tipos no enum `QuestionType` (models.py): text_short, text_long, multiple_choice, audio, scale, file_upload.

Os 12 tipos canônicos e seu mapeamento:

| # | Tipo canônico | enum backend | config JSONB |
|---|---|---|---|
| T01 | Texto curto | `text_short` (existe) | `{"max_chars": 500, "placeholder": "..."}` |
| T02 | Texto longo + áudio | `text_long` (existe) | `{"max_chars": 400, "audio_enabled": true}` |
| T03 | Múltipla (única) | `multiple_choice` (existe) | `{"options": [...], "multiple": false}` |
| T04 | Múltipla (múltipla) | `multiple_choice` (existe) | `{"options": [...], "multiple": true}` |
| T05 | Escala Likert | `scale` (existe) | `{"min": 1, "max": 5, "labels": ["Discordo totalmente", "Concordo totalmente"], "na_option": true}` |
| T06 | NPS | `nps` (NOVO) | `{"min": 0, "max": 10}` |
| T07 | Ranking | `ranking` (NOVO) | `{"options": ["Redução de custo", "Velocidade", ...]}` |
| T08 | Matriz de escala | `matrix` (NOVO) | `{"rows": ["Atendimento", "Tempo"], "columns": ["Ruim", "Reg.", "Bom", "Ótimo"]}` |
| T09 | Upload de arquivo | `file_upload` (existe) | `{"allowed_types": ["pdf","docx","png"], "max_size_mb": 10}` |
| T10 | Data e hora | `datetime` (NOVO) | `{"include_time": true}` |
| T11 | Número | `number` (NOVO) | `{"min": 1, "max": 500}` |
| T12 | Lista dinâmica | `dyn_list` (NOVO) | `{"suggestions": ["Briefing", "Orçamento", ...], "placeholder": "Nome da etapa"}` |

## Tarefas

### 1. `services/formly/app/models.py` — expandir enum

```python
class QuestionType(str, enum.Enum):
    text_short = "text_short"
    text_long = "text_long"
    multiple_choice = "multiple_choice"
    audio = "audio"
    scale = "scale"
    file_upload = "file_upload"
    nps = "nps"
    ranking = "ranking"
    matrix = "matrix"
    datetime = "datetime"
    number = "number"
    dyn_list = "dyn_list"
```

NOTA: o enum é um tipo PostgreSQL (SAEnum). Como estamos em dev com create_all, o caminho mais simples para a migration é **dropar e recriar as tabelas** (dados de teste podem ser perdidos):
```bash
cd services/formly && .venv/bin/python -c "
from app.db import engine, Base
from app import models
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print('Tabelas recriadas')
"
```

### 2. Schema de resposta — `services/formly/app/api/public.py`

O protótipo usa estes campos de resposta por tipo (o schema `answers` já tem value_text, value_choices, scale_value, audio_url, transcription, file_url, file_name — **usar os existentes, NÃO adicionar colunas**):

| Tipo | Campo(s) preenchidos na answer |
|---|---|
| text_short / text_long | `value_text` |
| multiple_choice única | `value_text` (opção escolhida) |
| multiple_choice múltipla | `value_choices` (array) |
| scale (likert) | `scale_value` (1..max) |
| nps | `scale_value` (0..10) |
| ranking | `value_choices` (array ordenado — o item arrastado para cima vem primeiro) |
| matrix | `value_choices` (array de strings "row:col" — ex: `["Atendimento:Bom", "Tempo:Reg."]`) |
| file_upload | `file_url` + `file_name` |
| datetime | `value_text` (ex: "15/08/2026 14:30") |
| number | `scale_value` (int) OU `value_text` — usar `scale_value` se inteiro, senão value_text |
| dyn_list | `value_choices` (array de strings, ordenado) |
| audio (tipo legado / text_long com áudio) | `transcription` + `audio_url` |

**Nada muda no POST /responses** — ele já aceita dict genérico. Apenas garantir que o `submit_response` em `public.py` persiste `value_choices` como JSON (já faz). Verificar que o schema de `Answer` aceita todos os campos (já tem).

### 3. Export CSV — `services/formly/app/api/responses.py`

Atualizar o `export?format=csv` para tratar os novos tipos na célula:
- multiple_choice múltipla / ranking / matrix / dyn_list → `value_choices` unido por "; " (já faz)
- nps / scale / number → `scale_value` como string
- datetime → `value_text`
- sem mudança estrutural, só garantir cobertura

### 4. Stats — adicionar contagem por tipo

Em `GET /{survey_id}/stats`, adicionar `by_question`: lista de `{question_id, type, title, total_answers, ...}` — MAS manter simples: o frontend do analytics (protópio) mostra barras por pergunta. O frontend pode calcular isso das respostas; stats pode ficar como está + campos existentes. **NÃO adicionar by_question agora** (o frontend agrega das responses). Foco: enum + schema.

### 5. LLM — `services/formly/app/services/llm_service.py`

Atualizar o `BUILDER_SYSTEM_PROMPT` para gerar os 12 tipos:
- Lista de tipos válidos: text_short, text_long, multiple_choice, scale, nps, ranking, matrix, file_upload, datetime, number, dyn_list
- Config por tipo:
  - nps: `{"min": 0, "max": 10}`
  - ranking: `{"options": ["Item A", "Item B", ...]}`
  - matrix: `{"rows": ["Linha 1", ...], "columns": ["Ruim", "Bom", "Ótimo"]}`
  - datetime: `{"include_time": true}`
  - number: `{"min": 1, "max": 500}`
  - dyn_list: `{"suggestions": ["..."]}`
  - scale: `{"min": 1, "max": 5, "labels": ["Discordo", "Concordo"], "na_option": true}`
- Manter audio como tipo opcional (depoimentos) e text_long com `audio_enabled: true` quando fizer sentido.

## Critérios de aceite

- [ ] Enum com 12 valores em models.py
- [ ] Tabelas recriadas (drop_all + create_all) sem erro
- [ ] `POST /api/surveys` aceita pergunta `nps`, `ranking`, `matrix`, `datetime`, `number`, `dyn_list` (testar com curl + token dev)
- [ ] `POST /api/public/surveys/{slug}/responses` persiste `value_choices` e `scale_value` (testar)
- [ ] `GET /api/surveys/{id}/export?format=csv` funciona com os novos tipos
- [ ] `.venv/bin/python -c "from app.main import app"` importa sem erro
- [ ] NÃO COMMITAR

## Token dev

JWT HS256, secret em /tmp/formly_jwt_secret.txt, sub=c44feede-fe22-467e-a7fb-eaaa839687ab, aud=authenticated. Ou use `POST /api/dev/login` que retorna token direto.
