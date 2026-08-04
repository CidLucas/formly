# R7 — Remover entrada manual de JWT (TokenBar) do fluxo

Repo: /home/ec2-user/formly — app em `apps/formly_app`.

## Contexto

O protótipo canônico (`scripts/reference/formly-site/*.html`) **NÃO tem entrada de JWT em nenhuma tela**. O fluxo é:

```
landing (/) → auth (/auth) → builder (/builder) → send (/send/:id) → analytics (/dashboard/:id)
```

A tela `Auth.tsx` (feita no R3) já resolve autenticação em dev: os botões "Continuar com Google" e o form de e-mail chamam `POST /api/dev/login`, salvam o token em `localStorage.formly_token` e navegam para `/builder`. O `Builder.tsx` (feito no R4) **ainda renderiza um TokenBar** — uma barra amarela "Modo dev — token não configurado" com input para colar JWT + botões "Salvar" / "Gerar token dev" / "Gerar com IA" / "Dispensar". Isso NÃO existe no protótipo e o usuário pediu explicitamente para remover.

## Tarefas

### 1. `src/pages/Builder.tsx` — remover TokenBar e integrar auth silenciosa

- **Remover** o componente `TokenBar` (definição ~linhas 57–170) e sua renderização (`<TokenBar />` ~linha 331).
- **Substituir** por auth silenciosa em dev:
  - Ao montar (`useEffect` no início), se `localStorage.formly_token` não existe:
    - Tentar `POST /api/dev/login` (backend em dev). Se OK → salvar token no localStorage → seguir normalmente.
    - Se falhar (backend offline) → `navigate('/auth')` (tela do protótipo, que também tenta dev login).
  - No handler de 401 (já existente ~linha 290): manter `navigate('/auth')`.
- Não deixar nenhum input de JWT visível. O token é sempre obtido via dev login automático (em dev) — o protótipo não mostra nada disso.
- Manter o restante do Builder intacto (header, cards, autosave, intent banner de `sessionStorage.formly_intent`, botões "+ Pergunta" / "Enviar →").

### 2. `src/pages/App.tsx` — conferir rotas (não deve mudar nada, só confirmar)

Rotas esperadas (já existentes):
- `/` → Landing, `/auth` → Auth, `/builder` e `/builder/:id?` → Builder
- `/s/:slug` → Survey, `/send/:id` → Send, `/dashboard/:id` → Dashboard

### 3. Verificação

- `npx tsc --noEmit` → exit 0
- `npm run build` → OK
- `grep -rn "TokenBar\|Cole seu JWT\|Gerar token dev" src/` → **zero ocorrências**
- Fluxo manual: `/` → digitar → Enter → deve chegar no builder **sem nenhuma barra de token visível**
- NÃO COMMITAR
