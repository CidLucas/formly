# R4 — Frontend: Builder (cards empilhados estilo protótipo)

Repo: /home/ec2-user/formly — app em `apps/formly_app`.
Referência canônica: `scripts/reference/formly-site/builder.html` (visual) + `scripts/reference/formly-site/formly-tipos-v2.html` (estados/componentes por tipo).

## Contexto

O protótipo do Builder é: header com título do questionário + botões "+ Pergunta" e "Enviar →", e abaixo CARDS empilhados, cada um com:
- `.q-header`: título da pergunta (`.q-title`) + badge de tipo (`.q-badge` — mono, uppercase, wine)
- `.q-hint` opcional
- Preview do componente de resposta (input, textarea+áudio, radio cards, checkbox, likert, NPS, ranking, matriz, upload, data, número, lista)

O protótipo NÃO tem chat IA no builder (o fluxo é: landing → builder direto). O Builder atual (feito na fase anterior) tem chat + 6 etapas — **substituir pela experiência do protótipo**, mantendo a integração com a API (criar/salvar/publicar).

## Tarefas — reescrever `src/pages/Builder.tsx`

### Layout (IDÊNTICO ao builder.html)

```
<div class="app" style max-width 560px, centralizado>
  <div class="header">
    <div class="header-title">Título do questionário (editável inline)</div>
    <div class="header-actions">
      <button class="btn-sm" onClick={addQuestion}>+ Pergunta</button>
      <button class="btn-sm primary" onClick={saveAndSend}>Enviar →</button>
    </div>
  </div>
  <div class="body" id="questions"> ... QuestionCards ... </div>
</div>
```

### QuestionCard (componente dentro do Builder ou separado)

Cada pergunta é um card `.q-card`:
- Header: `.q-title` (display, 1rem, 600) — **editável inline** (contentEditable ou input transparente) + `.q-badge` com o tipo (mono uppercase wine, ex: "TEXTO", "MÚLTIPLA [○]", "NPS", "RANKING")
- `.q-hint` opcional (itálico muted) — editável
- Preview do componente renderizado com os dados atuais (usar as classes do R1):
  - text_short → `.input-short`
  - text_long → `.textarea-long` + `.q-counter` + `.audio-divider` "ou" + `.rec-btn` (áudio companion, se config.audio_enabled)
  - multiple_choice única → `.choices` + `.choice` + `.radio-ind`
  - multiple_choice múltipla → `.choices` + `.choice` + `.check-ind`
  - scale → `.likert` (`.likert-row`, `.likert-pt`, `.likert-labels`, `.likert-neutral`, `.likert-na`)
  - nps → `.nps-row` com 11 `.nps-pt` (zonas detractor/neutral/promoter)
  - ranking → `.rank-list` com `.rank-item` (grip + num + label)
  - matrix → `.matrix-wrap` tabela (rows × cols) com `.mat-radio`
  - file_upload → `.dropzone` + file items
  - datetime → `.datetime-row` (dd/mm/aaaa + hh:mm)
  - number → `.input-num` + `.num-meta`
  - dyn_list → `.dyn-list` + `.dyn-add` + sugestões chips
  - audio → `.rec-btn` (tipo legado, depoimento)
- **Ações do card** (toolbar discreta, não no protótipo mas necessária): clicar no badge abre dropdown/menu para trocar o tipo; botões ↑ ↓ para reordenar; botão duplicar; botão excluir; toggle obrigatória. Estilo minimalista (mono, muted, hover wine) — não poluir o visual do protótipo.

### Edição de perguntas

- Clicar no título → edita inline (input estilizado sem borda, display)
- Clicar no hint → edita inline
- Múltipla escolha: clicar em "+ opção" (link mono wine) adiciona opção editável; opções são `.choice` com input transparente
- Ranking/matriz/dyn_list: editar as opções/linhas/colunas via inputs inline discretos

### Adicionar pergunta

`addQuestion()` → adiciona card novo com tipo aleatório ou texto curto padrão ("Nova pergunta" + badge). Usar lista de tipos: ['TEXTO CURTO','TEXTO LONGO','MÚLTIPLA [○]','[✓✓]','ESCALA','NPS','RANKING','MATRIZ','ARQUIVO','DATA','NÚMERO','LISTA'] — mapear para enum backend (text_short, text_long, multiple_choice(unique/multi), scale, nps, ranking, matrix, file_upload, datetime, number, dyn_list).

### Salvar + Enviar

- "Enviar →": cria/atualiza o survey na API (`surveys.create` ou `update` com {title, questions}), depois `surveys.publish(id)` → navega para `/send/{id}` (a tela de distribuição do protótipo).
- Autosave opcional: salvar quando houver mudanças (debounce 2s) se já existir id.
- Sem token (401) → redirecionar para `/auth` (com toast "Faça login para salvar").

### Estado (Zustand — manter `src/store/builderStore.ts`)

Manter a store existente (title, questions, addQuestion, updateQuestion, removeQuestion, moveQuestion) — adaptar se necessário. O modo chat/text pode ser removido ou mantido inativo; o foco é o fluxo do protótipo.

### Carregar survey existente

Se `/builder/:id` → `surveys.get(id)` → popula store (título + perguntas com tipos/opções).

### Descrição da landing

Se `sessionStorage.formly_intent` existir (vindo da landing): mostrar um banner discreto (mono, pine) no topo com a descrição e um botão "Gerar com IA" que chama `ai.skeleton(desc)` → popula as perguntas geradas. Isso mantém o valor do fluxo conversacional SEM mudar o layout do protótipo. Limpar o sessionStorage após usar.

## Regras

- Visual IDÊNTICO ao builder.html (mesmas classes, mesmos estilos — global.css R1 já tem tudo)
- Phosphor Icons apenas para ações auxiliares (setas, lixeira); nunca emoji como ícone
- TS estrito: `npx tsc --noEmit`
- NÃO COMMITAR

## Verificação

- `npx tsc --noEmit` e `npm run build` passam
- Browser: /builder mostra header + cards com previews estilizados wine/pine/paper
