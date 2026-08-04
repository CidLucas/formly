# R10 — Ranking com botões ↑↓ + drag melhorado (Survey)

Repo: /home/ec2-user/formly — app em `apps/formly_app`.
Arquivo: `src/pages/Survey.tsx` (componente `RankingQuestion`, ~linha 453).

## Contexto

O usuário relatou: **o ranking não permite reordenar** na página pública do respondente (`/s/{slug}`). Causa: o componente usa HTML5 drag & drop nativo (`draggable` + onDragStart/onDrop) que:
- **Não funciona em telas touch/mobile** (a maioria dos respondentes vai usar celular)
- Não tem `e.dataTransfer.setData()` no dragstart (alguns browsers exigem)
- Não tem fallback de acessibilidade

## Tarefa

Reescrever o `RankingQuestion` para **drag & drop + botões de reordenar**:

### 1. Botões ↑/↓ (universal, funciona em touch)
- Cada `.rank-item` ganha 2 botões pequenos: **↑** e **↓** (mono, muted, hover wine)
- ↑ move o item uma posição acima; ↓ move uma abaixo; desabilitados nas bordas
- Clicar chama `onChange` com a nova ordem (mesmo formato: `string[]`)

### 2. Manter drag & drop para desktop
- Manter `draggable` nos `.rank-item` mas adicionar `e.dataTransfer.setData('text/plain', String(i))` no dragstart (obrigatório em alguns browsers)
- Garantir que os `.rank-drop-zone` funcionem como hoje
- Ícone `.rank-grip` (⠿) continua como affordance visual de drag

### 3. Estado
- A ordem inicial continua: `value` se tiver mesmo tamanho de options, senão `options`
- O `onChange(next)` atualiza o valor salvo no answer (formato `value_choices`)

### 4. Visual
- Botões ↑↓: `.rank-move` (novo) — flex, gap 4, lado direito do item; ou reutilizar `.btn-sm` (existe no CSS)
- Garantir `touch-action: manipulation` nos botões (evita zoom no duplo toque)
- Responsivo mobile (max-width 600px): botões não quebram o layout

## Verificação
- `npx tsc --noEmit` → exit 0
- Teste manual: responder um survey com ranking → reordenar via ↑↓ (mobile) e drag (desktop) → o valor salvo reflete a nova ordem
- NÃO COMMITAR
