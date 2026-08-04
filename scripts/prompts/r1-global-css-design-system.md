# R1 — Design System: reescrever global.css para o DNA wine/pine/paper

Repo: /home/ec2-user/formly — app em `apps/formly_app`.
Arquivo a reescrever COMPLETAMENTE: `apps/formly_app/src/styles/global.css`

## Contexto

O protótipo modelado (canônico, aprovado pelo cliente) usa um design system próprio:
- Tema **claro, papel**
- Paleta **vinho (wine)** + **verde pinho (pine)**
- Tipografia **Georgia (serif) para corpo, Helvetica Neue (display) para títulos, SF Mono para mono**
- Bordas 1.5px, radius 6px (pequeno) / 12px (card)

A referência visual canônica está em `scripts/reference/formly-site/`:
- `formly-tipos-v2.html` — todos os 12 tipos de pergunta com TODOS os estados (default, focado, respondido, erro, gravando, arrastando...)
- `builder.html`, `index.html`, `auth.html`, `send.html`, `analytics.html` — as 5 telas

## Tarefa

Reescrever `apps/formly_app/src/styles/global.css` para implementar EXATAMENTE o design system do protótipo. O CSS deve usar as MESMAS classes e tokens do protótipo (não inventar novos nomes).

### Tokens (copiar do formly-tipos-v2.html e dos htmls das telas — usar os mesmos nomes)

```css
:root {
  --wine: #7A2E3F; --wine-soft: #F5E8EB; --wine-dark: #5C1E2C;
  --pine: #3B5B52; --pine-soft: #E8F0ED;
  --paper: #E7E6E0; --paper-2: #F3F2EE; --card: #FCFBF8;
  --muted: #6E6D66; --line: #C9C7BE; --ink: #1a1a1a;
  --display: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --body: Georgia, 'Times New Roman', Times, serif;
  --mono: 'SF Mono', 'Fira Code', monospace;
  --radius-sm: 6px; --radius: 12px;
  --shadow: 0 1px 3px rgba(0,0,0,.06);
  --ease: cubic-bezier(.4,0,.2,1);
  --fast: 150ms;
}
```

### Classes obrigatórias (extrair TODAS do formly-tipos-v2.html — abrir o arquivo e copiar)

Estrutura de pergunta `.q`:
- `.q` (card da pergunta), `.q-kind` (badge tipo, mono, uppercase, wine), `.q-label` (título, display), `.q-hint` (itálico, muted), `.q-err` (erro), `.q-counter` (contador), `.q.focused` / `.q.answered` / `.q.error` (estados)
- `.type-section`, `.type-header`, `.type-id`, `.type-name`, `.type-usage` (cabeçalho de seção do protótipo — usar no builder)

Inputs:
- `.input-short` (input texto), `.textarea-long` (textarea), `.input-num` (número com min/max), `.out-of-range`

Múltipla escolha:
- `.choices`, `.choice` (card clicável), `.choice.selected`, `.radio-ind` (círculo), `.check-ind` (quadrado)
- `.option-card` (variante do builder.html — radio-dot/checkbox-dot)

Escala likert:
- `.likert`, `.likert-row`, `.likert-line`, `.likert-pt`, `.likert-pt.selected`, `.likert-labels`, `.likert-neutral`, `.likert-na`

NPS:
- `.nps-row`, `.nps-pt`, `.nps-zone-detractor` (0-6), `.nps-zone-neutral` (7-8), `.nps-zone-promoter` (9-10), `.nps-pt.selected`, `.nps-labels`

Ranking:
- `.rank-list`, `.rank-item`, `.rank-item.dragging`, `.rank-grip`, `.rank-num`, `.rank-label`, `.rank-drop-zone`, `.rank-drop-zone.active`

Matriz:
- `.matrix-wrap`, `.matrix`, `.mat-radio`, `.mat-radio.selected`, `.matrix-cards`, `.mat-card`, `.mat-card-label`, `.mat-card-opts`

Upload:
- `.dropzone`, `.dropzone.drag`, `.dz-icon`, `.dz-text`, `.file-item`, `.file-ext`, `.file-name`, `.file-size`, `.file-del`, `.file-progress`, `.file-progress>i`

Data/hora:
- `.datetime-row`, `.time-toggle`

Lista dinâmica:
- `.dyn-list`, `.dyn-item`, `.dyn-item.dragging`, `.dyn-grip`, `.dyn-num`, `.dyn-del`, `.dyn-add`, `.dyn-suggestions`, `.dyn-sug-label`, `.dyn-sug-chips`, `.dyn-chip`, `.dyn-drop-zone`

Áudio (texto longo + áudio):
- `.audio-divider` ("ou"), `.rec-btn`, `.rec-btn.recording`, `.rec-dot`, `.rec-timer`, `.audio-hint`, `.audio-waveform`, `.play-btn`, `.bars`, `.wave-time`, `.audio-rerecord`
- animações: `@keyframes pulse-rec` (rec-btn.recording), `@keyframes blink-rec` (rec-dot)

Navegação etapas:
- `.nav-stage`, `.progress-bar`, `.progress-bar>i`, `.progress-info`, `.progress-info span.on`, `.nav-buttons`, `.spacer`
- scroll: `.submit-sticky`

Botões:
- `.btn`, `.btn.ghost`, `.btn:disabled`, `.btn-sm`, `.btn-sm.primary` (do builder.html)

Telas:
- `.screen-intro`, `.screen-done` (abertura/conclusão), `.eyebrow`
- `.section-divider` (label de seção verde pinho)

Shell/landing (do index.html/auth.html):
- `.landing`, `.logo` (wine, display 700, -0.03em), `.question`, `.input-wrap`, `.input-main`, `.or-divider`, `.btn-audio`, `.btn-audio.recording`, `.audio-dot`
- `.auth`, `.title`, `.subtitle`, `.btn-google`, `.divider`, `.email-form`, `.email-input`, `.btn-primary`

Analytics (do analytics.html):
- `.kpi-grid`, `.kpi-card`, `.kpi-value`, `.kpi-label`, `.kpi-sub`, `.section-title`, `.bar-list`, `.bar-row`, `.bar-label`, `.bar-track`, `.bar-fill`, `.bar-val`

Send (do send.html):
- `.back`, `.title`, `.section-label`, `.search`, `.select-all`, `.contact-list`, `.contact`, `.contact.selected`, `.contact .check`, `.divider`, `.csv-zone`, `.msg-textarea`, `.btn-send`

**IMPORTANTE:** abra `scripts/reference/formly-site/formly-tipos-v2.html` e os htmls das telas e COPIE os valores exatos de cada regra (cores, padding, radius, fontes, transições). Não invente valores. O objetivo é o app React ficar visualmente IDÊNTICO ao protótipo.

### Regras globais

- `body`: font-family var(--body), color #1a1a1a, background var(--paper)
- `h1,h2,h3`: font-family var(--display), weight 600, letter-spacing -0.02em
- `.mono`: font-family var(--mono)
- Reset box-sizing
- Media queries mobile 420px/600px do protótipo

## Critérios

- [ ] Todos os tokens e classes acima existem em global.css
- [ ] Valores copiados EXATAMENTE do protótipo (verificar hex: #7A2E3F, #3B5B52, #E7E6E0, #FCFBF8, #C9C7BE, #6E6D66, #1a1a1a)
- [ ] `npx tsc --noEmit` continua passando (CSS não afeta, mas confirmar)
- [ ] NÃO COMMITAR
