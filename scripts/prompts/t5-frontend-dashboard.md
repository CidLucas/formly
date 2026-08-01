# T5 — Frontend: Dashboard de Resultados

Repo: /home/ec2-user/formly — app em `apps/formly_app` (Vite + React 18 + TS + Zustand + React Query + Phosphor Icons).
Rota já registrada: `/dashboard/:id` → Dashboard (App.tsx). **Página autenticada (usa Shell).**

## Contexto — já existe (NÃO recriar)

- `src/lib/api.ts` — `surveys.get(id)`, `surveys.stats(id)`, `surveys.responses(id, params)`, `surveys.exportCsv(id)`
- `src/components/Shell.tsx` — topbar
- Backend: `GET /api/surveys/{id}/stats` → {total_responses, complete, partial, completion_rate, audio_responses, avg_scale}
- `GET /api/surveys/{id}/responses?page=1&per_page=50&status=` → {data: [{id, status, started_at, completed_at, answers: [{question_id, value_text, value_choices, scale_value, audio_url, transcription, file_url, file_name}]}], total, page, per_page}
- `GET /api/surveys/{id}/export?format=csv` → CSV com BOM
- Tokens CSS: --bg, --surface, --glass, --fg, --mu, --mu2, --ac, --ac-hi, --ac-grad, --urg, --att, --ok, --teal, --gb, --gb2, --r, --rl, --shadow-1, --shadow-3

## Objetivo

Implementar `src/pages/Dashboard.tsx` — requisito página-03: cards KPI, gráficos por pergunta, lista de respostas com players de áudio, filtro por período (client-side sobre started_at/completed_at) e exportação CSV.

## Estrutura

```
┌──────────────────────────────────────────────────┐
│ [← Voltar]  Resultados: {título}   [7d ▾] [CSV]  │
├──────────────────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│ │ 243    │ │ 87%    │ │ 12     │ │ 4.2/5  │      │
│ │Respostas│ │Conclusão│ │Áudios  │ │Nota méd│     │
│ └────────┘ └────────┘ └────────┘ └────────┘      │
├──────────────────────────────────────────────────┤
│  Gráficos por pergunta (cards)                   │
│  - multiple_choice: barras horizontais com %+n   │
│  - scale: distribuição (barras por valor)        │
│  - text_short/text_long: lista de respostas      │
│  - audio: cards com transcrição + player         │
├──────────────────────────────────────────────────┤
│  Exportação: [📥 Exportar CSV]                   │
└──────────────────────────────────────────────────┘
```

## Comportamento

### 1. Carregamento
- `useParams` id → React Query: `surveys.get(id)` (título), `surveys.stats(id)` (KPIs), `surveys.responses(id, 'per_page=200')` (respostas).
- Loading skeletons (divs com shimmer simples), erro → mensagem + retry.

### 2. KPIs (4 cards)
total_responses, completion_rate (%), audio_responses, avg_scale (mostrar "—" se null). Números em fonte mono (`var(--mono)`, tabular-nums).

### 3. Gráficos por pergunta
Para cada pergunta do survey (de `surveys.get`), agrega das respostas:
- **multiple_choice**: para cada opção, count + % → barra horizontal (div com width %, cor --ac ou paleta [--ac, --teal, --att, --urg, --blue2]). Ordena por count desc. Mostra "N respostas" no total.
- **scale**: count por valor min..max → barras.
- **text_short/text_long**: lista (máx 5 visíveis, "Ver mais" expande) com valor_text, data do completed_at formatada pt-BR.
- **audio**: cards com transcription (se houver), player `<audio controls src=audio_url>` se audio_url existir, senão badge "Áudio (transcrição)" — sem player se não há URL.

### 4. Filtro de período
Dropdown: 7 dias / 30 dias / 90 dias / Todo. Filtra responses client-side pela data (started_at ou completed_at). Ao mudar, KPIs e gráficos recalculam do conjunto filtrado.

### 5. Export CSV
Botão → `surveys.exportCsv(id)` → download do blob (URL.createObjectURL + link download `resultados-{id}.csv`). Loading no botão ("Gerando..."), toast ao concluir. Se 401 → toast token.

### 6. Empty state
Se total == 0: "Nenhuma resposta ainda. Compartilhe o link para começar!" + botão copiar link público (monta `http://localhost:5173/s/{slug}` se slug existir no survey).

## Regras
- Tokens CSS. Phosphor Icons (Download, ChartBar, CaretLeft, Microphone). Mono para números. NUNCA emoji como ícone de UI.
- TS estrito: `npx tsc --noEmit`.
- NÃO COMMITAR.

## Verificação
- `cd apps/formly_app && npx tsc --noEmit`
- `npm run build`
