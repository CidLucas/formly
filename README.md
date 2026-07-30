# Formly

> Fábrica de questionários com áudio e IA

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Vite + React 18 + Blu DS (CSS tokens) + Zustand + React Query |
| Backend | FastAPI (Python) |
| Banco | PostgreSQL (Supabase) |
| Arquivos | S3 / Cloudflare R2 |
| Transcrição | Groq Whisper |
| LLM | OCI GenAI / Groq |
| Auth | Supabase Auth |

## Estrutura (monorepo)

```
formly/
├── apps/
│   └── formly_app/       # Frontend — Vite + React 18 + Blu DS
│       ├── src/
│       │   ├── pages/     # Builder, Survey, Dashboard
│       │   ├── components/# Componentes reutilizáveis
│       │   └── lib/       # API client, hooks, utils
│       └── ...
├── services/
│   └── formly/            # Backend — FastAPI
│       ├── app/
│       │   ├── api/       # Rotas
│       │   ├── models/    # SQLAlchemy
│       │   └── services/  # Lógica de negócio
│       └── ...
├── docs/                  # Documentação do projeto
└── PLANO.md               # Plano de implementação
```

## Links

- [PLANO.md](./PLANO.md) — Fases, workstreams, decisões
- [Docs no hub](https://github.com/CidLucas/projetos/tree/main/formly) — Requisitos e arquitetura
- [Google Doc (escopo)](https://docs.google.com/document/d/1V539iHGWJq-4qMA30YS7FbRCo023rwYm7rwbMkfGhEw/edit)
