# R11 — Botão enviar sticky no rodapé do Builder + Tela de Preview

Repo: /home/ec2-user/formly — app em `apps/formly_app`.
Arquivos: `src/pages/Builder.tsx`, `src/App.tsx`, `src/pages/Preview.tsx` (novo).
Referência: `scripts/reference/formly-site/builder.html` + `formly-tipos-v2.html`.

## Contexto — 2 problemas do usuário

1. **Não há botão de enviar na parte debaixo da página de edição do form.** O builder só tem "Enviar →" no header (topo). Em forms longos, o usuário rola até o fim e não encontra o envio.
2. **Antes de mandar para os respondentes, devemos dar a opção de um preview.** Não existe tela de preview hoje — o fluxo vai direto de builder → send.

## Tarefa 1 — Botão sticky no rodapé do Builder

Em `Builder.tsx`, adicionar um **rodapé fixo/sticky** com botão "Enviar →" que aparece quando o usuário rola (ou sempre):

- Estrutura: `<div className="submit-sticky">` — posição fixed/sticky no rodapé, fundo `--card` com borda top `--line`, sombra suave
- Conteúdo: botão `.btn-sm primary` "Enviar →" (mesmo handler `saveAndSend`) + contador "N perguntas"
- **Não cobrir o conteúdo:** adicionar `padding-bottom` no `.body` (ex: 80px) para o último card não ficar escondido atrás do rodapé
- Comportamento: sempre visível OU só após scroll > 200px (escolher sempre visível — mais simples e previsível)
- CSS: classe `.submit-sticky` no `global.css` (ou inline style) — seguir design system (wine, radius, shadow)

## Tarefa 2 — Tela de Preview

### 2.1 Criar `src/pages/Preview.tsx`
Rota `/preview/:id` — renderiza o questionário **como o respondente vê** (reutilizar a lógica visual do `Survey.tsx`, sem envio real):

- Carrega `surveys.get(id)` (autenticado)
- Renderiza: título, perguntas com os componentes de resposta (12 tipos) — pode reutilizar os componentes do `Survey.tsx` (exportar `QuestionRenderer` se necessário, ou duplicar o render básico)
- Estado local de respostas (não envia para a API — ou envia para `/responses/partial` sem commit)
- **Botões no topo:** "← Voltar" (para `/builder/{id}`) e "Confirmar e enviar →" (para `/send/{id}`)
- Sem barra de progresso/envio — é só visual

### 2.2 Atualizar `App.tsx`
- Adicionar rota `/preview/:id` → Preview

### 2.3 Atualizar `Builder.tsx`
- No rodapé sticky, além de "Enviar →", adicionar botão "Preview" (`.btn-sm` ghost) → `navigate('/preview/{id}')`
- Se o survey ainda não tem id (não salvo), salvar primeiro (autosave/create) e então navegar

## Verificação
- `npx tsc --noEmit` → exit 0
- Manual: builder com 5+ perguntas → rolar até o fim → botão "Enviar" visível no rodapé; clicar "Preview" → vê o form como respondente → "Confirmar e enviar" → vai para /send/{id}
- NÃO COMMITAR
