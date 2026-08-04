# R6 — Frontend: Send (distribuição) + Analytics (dashboard)

Repo: /home/ec2-user/formly — app em `apps/formly_app`.
Referência canônica: `scripts/reference/formly-site/send.html` (distribuição) e `scripts/reference/formly-site/analytics.html` (resultados).

## Contexto

O protótipo define 2 telas finais:
- **send.html**: "Enviar: {título}" — selecionar contatos (busca, selecionar todos, lista com checkboxes), importar CSV, mensagem opcional, botão "Enviar questionário →"
- **analytics.html**: "Pesquisa de Clima 2026" + "Exportar CSV" + 3 KPI cards (Respostas, Taxa de resposta, Tempo médio) + "Respostas por pergunta" com barras horizontais (`.bar-list`)

## Tarefas

### 1. Criar `src/pages/Send.tsx` (rota `/send/:id`)

Reproduzir EXATAMENTE o send.html (classes: `.back`, `.title`, `.section-label`, `.search`, `.select-all`, `.contact-list`, `.contact`, `.contact .check`, `.divider`, `.csv-zone`, `.msg-textarea`, `.btn-send`):
- "← Voltar" (volta para /builder/{id})
- Título "Enviar: {título do survey}" (buscar via surveys.get(id))
- "Para quem?" + input busca (filtra contatos por nome/email)
- "Todos (N)" / "Selecionados (N)" toggle
- Lista de contatos (da API GET /api/contacts) com checkboxes `.contact` — seleção visual wine
- Divider "ou" + zona CSV (upload de arquivo .csv — parse client-side simples: uma linha = um e-mail; mostrar "N contatos detectados")
- "Mensagem opcional" textarea (`.msg-textarea`)
- Botão `.btn-send` "Enviar questionário →" — em dev: mostra estado "Enviando..." e navega para `/dashboard/{id}` após 1.5s (mock de envio; integração Resend é Fase 2)
- Sem token → redireciona /auth
- Contatos: se lista vazia, mostrar estado vazio amigável ("Nenhum contato ainda — adicione via CSV ou API")

### 2. Reescrever `src/pages/Dashboard.tsx` (rota `/dashboard/:id`) — estilo analytics.html

Layout (classes do analytics.html): `.back` ("← Voltar" → /builder/{id} ou /), `.header` com `.header-title` (título do survey) + `.export-btn` "Exportar CSV", `.kpi-grid` (3 cards) + `.section-title` "Respostas por pergunta" + `.bar-list`.

- **KPIs (3 cards)** — dados de `surveys.stats(id)` + responses:
  - `Respostas` — total_responses (kpi-value wine, 2rem) + sub "de {enviados} enviados" (se houver contatos; senão omitir sub)
  - `Taxa de resposta` — completion_rate%
  - `Tempo médio` — média de time_spent_secs formatada ("4min") se disponível; senão "—"
- **Barras por pergunta** — para cada pergunta do survey (surveys.get), calcular % de respostas com valor preenchido sobre total de responses (ou agregação por opção para multiple_choice):
  - multiple_choice/scale/nps: barra por opção/valor com % (`.bar-row`, `.bar-label` = opção, `.bar-track` > `.bar-fill` width %, `.bar-val` = %)
  - text_short/text_long/dyn_list: lista de respostas (máx 5, "Ver mais") — pode usar layout de lista simples
  - ranking/matrix: mostrar contagens por item
  - audio: cards com transcrição + player (se audio_url)
- **Animação**: barras começam width:0 e animam para o valor após load (como analytics.html)
- **Export CSV**: botão → surveys.exportCsv(id) → download blob (resultados-{id}.csv). Loading "Gerando...".
- **Empty state**: sem respostas → "Nenhuma resposta ainda. Compartilhe o link para começar!" + botão copiar link público (montar http://localhost:5173/s/{slug})
- **Filtro período**: opcional (dropdown 7/30/90 dias, filtra client-side). Se simples, incluir; senão deixar fora desta rodada (o protótipo não tem filtro — manter fiel).

### 3. Registrar rotas em `src/App.tsx`

- `/send/:id` → Send
- `/dashboard/:id` → Dashboard (já existe)
- `/` → Landing, `/auth` → Auth (R3)
- `/builder/:id?` → Builder (R4), `/s/:slug` → Survey (R5)

## Regras
- Classes do protótipo (R1) — visual IDÊNTICO a send.html/analytics.html
- Phosphor Icons (Download, CaretLeft, Microphone); nunca emoji
- Números em `.mono` (font mono, tabular-nums via classe do protótipo)
- TS estrito: `npx tsc --noEmit`
- NÃO COMMITAR

## Verificação
- `npx tsc --noEmit` + `npm run build`
- Browser: /send/{id} mostra contatos selecionáveis; /dashboard/{id} mostra KPIs + barras animadas + export CSV funcionando
