# PLANO.md — Formly

> **Versão:** v0.1 — 2026-07-30
> **Fase atual:** Fase 0 — Setup & Fundação
> **Docs de referência:** [Hub de projetos](https://github.com/CidLucas/projetos/tree/main/formly)

---

## 🗺 Visão geral

O plano está organizado em **4 workstreams paralelos** que convergem nas fases. Cada workstream tem seu próprio ritmo, mas todos são necessários para o produto funcionar.

```
WORKSTREAM A: Frontend (Next.js)
WORKSTREAM B: Backend + Banco (FastAPI + PostgreSQL)
WORKSTREAM C: IA / Áudio (Groq, LLM)
WORKSTREAM D: Infra / DevOps (Vercel, Railway, CI/CD)
```

---

## 📅 Fases

### ⏳ FASE 0 — Fundação (2-3 semanas)

**Objetivo:** Setup dos repositórios, schema do banco, protótipo fim-a-fim mínimo. Provar que o conceito funciona.

| # | O quê | Workstream | Status |
|---|---|---|---|
| 0.1 | Criar repo `CidLucas/formly` | D | ✅ |
| 0.2 | Bootstrap Vite + React 18 + Blu DS tokens | A | 🔴 |
| 0.3 | Bootstrap FastAPI + estrutura de pastas | B | 🔴 |
| 0.4 | Setup Supabase (projeto + banco + auth) | B + D | 🔴 |
| 0.5 | Rodar migration inicial (schema: surveys, questions) | B | 🔴 |
| 0.6 | Criar página do builder estática (sem chat ainda) | A | 🔴 |
| 0.7 | Criar página pública do questionário (renderizar perguntas) | A | 🔴 |
| 0.8 | Implementar POST /api/surveys (salvar questionário) | B | 🔴 |
| 0.9 | Implementar GET /api/public/surveys/:slug (servir questionário) | B | 🔴 |
| 0.10 | Implementar POST /api/public/surveys/:slug/responses (salvar respostas) | B | 🔴 |
| 0.11 | Criar dashboard simples (lista de respostas) | A | 🔴 |
| 0.12 | Deploy no Vercel + Railway | D | 🔴 |
| 0.13 | **Teste de custo:** 100+ transcrições Groq → medir R$/resposta | C | 🔴 |

**Gate Fase 0 → Fase 1:**
- [ ] Questionário criado no builder → salvo no banco
- [ ] Respondente acessa link → vê perguntas → envia respostas
- [ ] Criador vê respostas no dashboard
- [ ] Custo de transcrição validado (viável financeiramente)

---

### ⏳ FASE 1 — MVP com Identidade (4-6 semanas)

**Objetivo:** Builder conversacional (chat + editor), design system, brand kit, publicação funcional.

| # | O quê | Workstream | Status |
|---|---|---|---|
| 1.1 | **Builder híbrido:** chat panel + canvas lado a lado | A | 🔴 |
| 1.2 | Assistente de criação (LLM): input → refinamento → geração de esqueleto | C | 🔴 |
| 1.3 | Cards de pergunta com drag & drop, edição inline | A | 🔴 |
| 1.4 | Edição textual do esqueleto (parse reverso) | A | 🔴 |
| 1.5 | Chat de ajuste (IA contextualizada no esqueleto) | C | 🔴 |
| 1.6 | **Design System:** 3-4 temas visuais pré-construídos | A | 🔴 |
| 1.7 | Brand kit: upload de logo + cores do criador | A | 🔴 |
| 1.8 | **Áudio como resposta:** gravador + upload S3 + transcrição Groq | A + C | 🔴 |
| 1.9 | Áudio como input do criador (ditar pergunta) | C | 🔴 |
| 1.10 | Preview do questionário (desktop + mobile) | A | 🔴 |
| 1.11 | **Publicação:** gerar link público + QR code | A + B | 🔴 |
| 1.12 | Dashboard aprimorado: agrupamento por pergunta, gráficos | A | 🔴 |
| 1.13 | Exportação CSV | B | 🔴 |

**Gate Fase 1 → Fase 2:**
- [ ] Criador monta questionário conversando com IA + editando direto
- [ ] Respondente responde com texto e áudio (transcrição funcionando)
- [ ] Questionário publicado é página web funcional com tema
- [ ] Dashboard mostra dados agregados

---

### ⏳ FASE 2 — Lançamento Beta (3-4 semanas)

**Objetivo:** Onboarding, cobrança, domínio próprio, primeiros usuários.

| # | O quê | Workstream | Status |
|---|---|---|---|
| 2.1 | Onboarding: fluxo guiado de primeiro questionário | A | 🔴 |
| 2.2 | Planos (Free / Pro) + limites (questionários, respostas) | B | 🔴 |
| 2.3 | Integração Stripe (checkout + portal) | B + D | 🔴 |
| 2.4 | Domínio próprio: formly.app | D | 🔴 |
| 2.5 | Landing page institucional | A | 🔴 |
| 2.6 | Gerenciador de contatos (CRUD + CSV) | A + B | 🔴 |
| 2.7 | Distribuição: envio de link por e-mail (Resend) | A + B | 🔴 |

**Gate Fase 2 → Fase 3:**
- [ ] Usuário consegue se cadastrar, assinar Pro, criar questionário, distribuir
- [ ] Cobrança funcionando (Stripe)
- [ ] Domínio próprio no ar

---

### ⏳ FASE 3 — Agentes Inteligentes (4-6 semanas)

**Objetivo:** Agente de follow-up nas respostas, agente de validação no criador, distribuição avançada.

| # | O quê | Workstream | Status |
|---|---|---|---|
| 3.1 | Agente de follow-up: detecta resposta incompleta → pergunta mais | C | 🔴 |
| 3.2 | Agente de validação: ao criar questionário, sugere perguntas complementares | C | 🔴 |
| 3.3 | Distribuição avançada: WhatsApp, SMS | A + B | 🔴 |
| 3.4 | Templates de questionário (galeria curada) | A + B | 🔴 |

---

### ⏳ FASE 4 — Análise & Monetização (4-6 semanas)

**Objetivo:** Relatórios de IA, análise estatística, upsell.

| # | O quê | Workstream | Status |
|---|---|---|---|
| 4.1 | Relatórios IA: agente analisa respostas → documento de insights | C | 🔴 |
| 4.2 | Análise estatística: correlações, tendências, segmentações | C | 🔴 |
| 4.3 | Add-on por pesquisa: cobrança avulsa R$ 29-49 | B + D | 🔴 |
| 4.4 | Embed: questionário embutível em sites (iframe/script) | A | 🔴 |

---

## 🧵 Workstreams (visão contínua)

### Workstream A — Frontend

```
Fase 0:           Fase 1:              Fase 2:           Fase 3-4:
───────           ───────              ───────           ────────
Setup Next.js ──→ Builder híbrido ──→ Onboarding ──→ Templates
Páginas static   Chat + Canvas        Landing page      Embed
                  Temas + Brand kit    Contatos          Melhorias UX
                  Preview + Publish    Distribuição
                  Dashboard v2
```

### Workstream B — Backend + Banco

```
Fase 0:           Fase 1:              Fase 2:           Fase 3-4:
───────           ───────              ───────           ────────
Setup FastAPI ──→ CRUD surveys ──→ Planos/limites ──→ Distribuição avançada
Schema inicial    API pública         Stripe             Templates API
Migration         Transcrição API     Contatos API       Add-on IA
Deploy            Export CSV          Resend (e-mail)
```

### Workstream C — IA / Áudio

```
Fase 0:           Fase 1:              Fase 2:           Fase 3-4:
───────           ───────              ───────           ────────
Teste custo ────→ Assistente IA ──→ (pausa) ──────→ Follow-up agente
Groq              Chat de ajuste                       Validação agente
                  Áudio respondente                    Relatórios IA
                  Áudio criador                        Estatística
```

### Workstream D — Infra / DevOps

```
Fase 0:           Fase 1:              Fase 2:           Fase 3-4:
───────           ───────              ───────           ────────
Setup repo    ──→ CI/CD ──────────→ Domínio ──────→ Escala
Supabase          Vercel + Railway     formly.app         Monitoramento
                  S3 setup             Stripe setup
```

---

## ⚡ Decisões pendentes (precisam ser resolvidas)

| # | Decisão | Impacto | Bloqueia |
|---|---|---|---|
| D3 | ✅ Blu DS (CSS tokens) | Lucas — 2026-07-30 |
| D4 | ✅ Componentes custom com Blu DS + Zustand + React Query (padrão Blu V3) | Lucas — 2026-07-30 |
| D5 | **Hospedagem S3:** AWS S3 ou Cloudflare R2? | Custo, latência, egress | Fase 1 |
| D6 | ✅ DeepSeek Flash (LLM padrão) | Lucas — 2026-07-30 |
| D7 | **Precificação final:** valores Free/Pro/Business | Stripe, landing page | Após Fase 0 |
| D8 | ✅ Resend (e-mail transacional) | Lucas — 2026-07-30 |
| D9 | ✅ Monorepo: `apps/formly_app` + `services/formly` | Lucas — 2026-07-30 |

---

## 🎯 Próximos passos imediatos (esta semana)

1. [ ] **Lucas** — ~~D3 e D4~~ ✅ decididos: Blu DS + componentes custom (padrão Blu V3)
2. [ ] **Lucas** — decidir D9 (monorepo ou polyrepo?)
3. [ ] **Hermes** — bootstrap frontend com Vite + React 18 + Blu DS tokens
4. [ ] **Hermes** — bootstrap backend com FastAPI + SQLAlchemy
5. [ ] **Hermes** — criar projeto Supabase + migration inicial
6. [ ] **Hermes** — implementar CRUD surveys + página pública mínima

---

## 📊 Progresso

| Fase | Tasks | Concluídas | Progresso |
|---|---|---|---|
| Fase 0 | 13 | 1 | 8% |
| Fase 1 | 13 | 0 | 0% |
| Fase 2 | 7 | 0 | 0% |
| Fase 3 | 4 | 0 | 0% |
| Fase 4 | 4 | 0 | 0% |
| **Total** | **41** | **1** | **2%** |
