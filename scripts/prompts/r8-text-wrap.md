# R8 — Quebra de linha em perguntas longas (sem overflow horizontal)

Repo: /home/ec2-user/formly — app em `apps/formly_app`.

## Contexto

Bug relatado pelo usuário: **quando o texto da pergunta é longo, ele não quebra linha — o conteúdo estoura o card e o usuário precisa rolar horizontalmente**, deformando o questionário.

### Causa raiz identificada

1. **`src/components/QuestionCard.tsx` (~linha 611)**: o título da pergunta é renderizado como `<input className="q-title-input">`. Um `<input>` HTML é **sempre de linha única** — texto longo não quebra, rola horizontalmente dentro do campo.
2. **`src/styles/global.css`**: `.q-label` (Survey, ~linha 130) e `.q-title` (~linha 790) não têm `overflow-wrap`/`word-break` — palavras/textos longos estouram o container.
3. Possíveis pontos secundários: `.q-hint` (~linha 136), `.q-hint-input` (~linha 822), `.option-card` / `.choice` labels, `.rank-item`, `.dyn-item` — qualquer texto de usuário pode ser longo.

## Tarefas

### 1. `src/components/QuestionCard.tsx` — trocar input do título por textarea auto-resize

- Substituir o `<input className="q-title-input" ...>` (~linha 611) por um `<textarea>` com:
  - Mesma classe `q-title-input`
  - `value={question.title}` + `onChange` igual ao atual
  - `rows={1}` e **auto-resize** simples: no onChange, ajustar `style.height = 'auto'` e depois `style.height = e.target.scrollHeight + 'px'` (ou usar `useEffect` que ajusta pelo conteúdo). Implementação mínima sem lib externa.
  - `wrap="soft"` (padrão, garantir explícito)
  - `placeholder="Pergunta sem título"` (manter)
- Verificar que o `q-header` continua alinhado (badge no topo, textarea flexível).

### 2. `src/styles/global.css` — quebra de linha em todo texto de pergunta

Adicionar em todas as classes de texto de pergunta:

```css
overflow-wrap: break-word;
word-break: break-word;
```

Aplicar em (no mínimo):
- `.q-label` (Survey)
- `.q-title` (builder, se ainda existir como texto)
- `.q-title-input` (textarea do builder)
- `.q-hint`, `.q-hint-input`
- `.q-header` — garantir `min-width: 0` no filho flexível para permitir wrap (o textarea já tem `flex: 1; min-width: 0`, confirmar)
- `.choice`, `.option-card`, `.rank-item`, `.dyn-item`, `.contact`, `.dyn-chip` (labels clicáveis — texto pode quebrar em 2 linhas sem deformar o card)
- `.matrix` labels se aplicável

Também garantir que o **body/app não crie scroll horizontal**: conferir se `.app` (max-width 560px) ou `.q-card` têm `overflow-x: hidden` ou `max-width: 100%` adequados. Adicionar `max-width: 100%` / `overflow-x: hidden` no `.q-card` se necessário (mas NÃO esconder conteúdo — o wrap deve resolver; `overflow-x: hidden` é só rede de segurança no card, não no body inteiro).

### 3. Verificação

- `npx tsc --noEmit` → exit 0
- `npm run build` → OK
- Teste manual no browser:
  - Builder: criar pergunta com título longo (ex: 2–3 frases grandes, ~150+ caracteres sem espaço) → deve quebrar em várias linhas dentro do card, SEM scroll horizontal
  - Survey (`/s/:slug`): pergunta longa → mesma quebra
- NÃO COMMITAR
