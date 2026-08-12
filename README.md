# Formly — este repositório é legado

> **O desenvolvimento do Formly acontece no monorepo:**
> **[CidLucas/monorepo → `produtos/formly`](https://github.com/CidLucas/monorepo/tree/main/produtos/formly)**

Este repositório está **arquivado** (somente leitura) desde 2026-08-12.

## Por quê

O deploy do Formly roda do monorepo — `produtos/formly`, a partir da `main` —
desde a migração. O que está aqui parou em 2026-08-04 e diverge do que está no
ar em pontos que enganam quem lê:

- tem um `dev-login` que **não existe mais** (removido em 2026-08-06: era um
  emissor de token HS256 dentro de um serviço que só deveria verificar
  assinatura do Supabase);
- as rotas são as antigas — o produto atual tem `/painel`, `/s/:slug`,
  `/dashboard/:id`, cota de plano, briefing por IA e Supabase próprio;
- a estrutura é outra (`apps/formly_app` + `services/formly`).

Duas fontes de verdade custaram uma auditoria de produto navegando os dois
repositórios para descobrir qual era a versão real — com o deploy à frente e o
repositório de referência atrás. Um contribuidor novo clonaria o errado.

## Onde está cada coisa agora

| O que era daqui | Onde está |
|---|---|
| `apps/formly_app` | [`produtos/formly/frontend`](https://github.com/CidLucas/monorepo/tree/main/produtos/formly/frontend) |
| `services/formly` | [`produtos/formly/src/formly`](https://github.com/CidLucas/monorepo/tree/main/produtos/formly/src/formly) |
| `docs/`, `PLANO.md` | [`produtos/formly/docs`](https://github.com/CidLucas/monorepo/tree/main/produtos/formly/docs) |
| Issues e dívida técnica | [Issues do monorepo](https://github.com/CidLucas/monorepo/issues) |

O histórico de commits fica aqui, intacto — é por isso que o repositório foi
arquivado em vez de apagado.

Referência: [issue #135](https://github.com/CidLucas/monorepo/issues/135).
