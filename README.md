# Formly

> Fábrica de questionários com áudio e IA

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js App Router + React + Tailwind |
| Backend | FastAPI (Python) |
| Banco | PostgreSQL (Supabase) |
| Arquivos | S3 / Cloudflare R2 |
| Transcrição | Groq Whisper |
| LLM | OCI GenAI / Groq |
| Auth | Supabase Auth |

## Estrutura

```
formly/
├── frontend/          # Next.js App Router
│   ├── src/
│   │   ├── app/       # Rotas (builder, survey/[slug], dashboard)
│   │   ├── components/# Componentes React
│   │   └── lib/       # Utilitários, API client
│   └── ...
├── backend/           # FastAPI
│   ├── app/
│   │   ├── api/       # Rotas da API
│   │   ├── models/    # SQLAlchemy/Pydantic
│   │   └── services/  # Lógica de negócio
│   └── ...
├── docs/              # Documentação do projeto
└── PLANO.md           # Plano de implementação
```

## Docs

- [PLANO.md](./PLANO.md) — Fases, workstreams, decisões
- [Docs do hub](https://github.com/CidLucas/projetos/tree/main/formly) — Requisitos no portfolio repo

