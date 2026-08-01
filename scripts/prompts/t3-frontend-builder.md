# T3 — Frontend: Página Builder (Criador de Questionário)

Repo: /home/ec2-user/formly — app em `apps/formly_app` (Vite + React 18 + TS + Zustand + React Query + Phosphor Icons).
Backend em http://localhost:8000 (proxy Vite /api). Auth: token em localStorage 'formly_token' (se ausente, chamadas autenticadas falham com 401 — trate com toast).

## Contexto — já existe (NÃO recriar)

- `src/lib/api.ts` — api<T>() + surveys/ai/transcribe/publicApi/contacts (expandido na T2)
- `src/components/Shell.tsx` — topbar com logo/nav
- `src/components/QuestionCard.tsx` — card de pergunta editável (tipo, título, opções, obrigatória, config)
- `src/store/builderStore.ts` — Zustand: title, questions, mode ('chat'|'canvas'|'text'), chatMessages, ações
- Tokens CSS: --bg, --surface, --glass, --fg, --mu, --mu2, --ac, --ac-hi, --ac-grad, --urg, --att, --ok, --teal, --gb, --gb2, --r, --rl, --shadow-1, --shadow-3
- Rota já registrada: `/builder/:id?` → Builder (App.tsx)

## Objetivo

Implementar `src/pages/Builder.tsx` completo — o **fluxo contínuo de 6 etapas** do requisito página-01:
Input → Refinamento → Geração → Ajuste → Publicação → Distribuição. As 3 formas de interação (chat, manipulação direta, edição textual) COEXISTEM na mesma tela.

## Estrutura da página (layout)

```
┌──────────────────────────────────────────────────┐
│ [← Meus questionários]  [Título editável]        │
├──────────────────────────────────────────────────┤
│  ÁREA PRINCIPAL (mode-dependent)                 │
│                                                  │
│  MODO CHAT (etapas 1-2 e ajustes):               │
│  ┌────────────────────────────────────────────┐  │
│  │ 💬 O que você precisa?                     │  │
│  │ [textarea: descreva o questionário...]     │  │
│  │ [🎤 ditar]  [Enviar]                       │  │
│  │  ... mensagens do assistente (bolhas) ...  │  │
│  │ [⚡ Gerar esqueleto agora] (skip refin.)   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  MODO CANVAS (etapas 3-4, o principal):          │
│  ┌────────────────────────────────────────────┐  │
│  │ [📋 Esqueleto]  [✏️ Editar como texto]     │  │
│  │  QuestionCard × N (reordenáveis ↑↓ drag)   │  │
│  │ [+ Nova pergunta]  [🔄 Refinar com IA]      │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  MODO TEXTO (etapa 3b):                          │
│  ┌────────────────────────────────────────────┐  │
│  │ [textarea com esqueleto em texto]          │  │
│  │ [Aplicar alterações] [Cancelar]            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│ [🎨 Personalizar] [👁 Preview] [💾 Salvar] [🚀 Publicar] │
└──────────────────────────────────────────────────┘
```

## Comportamento detalhado

### 1. Etapa Input (chat)
- Ao montar com `/builder` (sem id): área central mostra o input inicial (textarea grande + botão 🎤 + Enviar).
- 🎤: usar `navigator.mediaDevices.getUserMedia` + MediaRecorder → grava → envia para `/api/transcribe` → preenche o textarea.
- Enviar → adiciona mensagem do usuário ao chat, chama `ai.refinementQuestions(description)` → exibe bolhas do assistente com as perguntas.

### 2. Etapa Refinamento (chat, 1-2 rounds)
- Input de resposta + botão "Gerar esqueleto agora" (skip).
- Após resposta do usuário: chamar `ai.skeleton(description_completa)` → recebe {title, questions} → seta store (title, questions), muda mode→'canvas', mostra toast "Esqueleto gerado".

### 3. Etapa Geração/Ajuste (canvas)
- QuestionCards renderizados da store. Reordenação: botões ↑/↓ no card (usar store.moveQuestion) — drag & drop nativo opcional (HTML5 draggable com onDragStart/onDrop).
- "✏️ Editar como texto" → mode='text'.
- "+ Nova pergunta" → adiciona card em branco (tipo text_short, título vazio).
- "🔄 Refinar com IA" → volta ao chat com contexto (chatMessages preservadas) — mensagens do assistente; ao final o usuário manda pedido, chama `ai.refine({title, questions}, mensagem)` → a lib responde com texto; MAS a T3 NÃO aplica mudanças automáticas (isso é Fase 1.5) — exibir a sugestão do assistente como texto para o usuário copiar OU exibir botão "Aplicar sugestão" apenas se a resposta contiver JSON válido com questions (parse e aplicar). Implemente o parse: se conseguir extrair {title?, questions[]} do texto, mostrar botão "Aplicar sugestão no esqueleto".

### 4. Modo texto
- Serializar store → formato texto:
```
1. Qual é o seu nome?
   tipo: text_short
   obrigatória: sim

2. Como avalia o atendimento?
   tipo: multiple_choice
   opções: Ótimo, Bom, Regular, Ruim
   obrigatória: sim
```
- Parse reverso (texto → questions): suportar `tipo:`, `obrigatória: sim/não`, `opções: a, b, c`, `min:`/`max:` (scale), `max_chars:`, `max_duration_secs:`. Aplicar → atualiza store → volta ao canvas.
- "Aplicar alterações" → parse; "Cancelar" → descarta e volta.

### 5. Barra inferior
- 🎨 Personalizar: modal simples — cor accent (input color), textos de abertura/encerramento (opcional, salvar em brand_colors via PATCH).
- 👁 Preview: modal com iframe ou renderização simples do questionário (título + perguntas read-only, estilizado como o respondente vê).
- 💾 Salvar: se não tem id → `surveys.create({title, questions})` → salva id retornado no store e na URL (`/builder/{id}`); se tem → `surveys.update(id, {title, questions})`. Toast sucesso/erro. NO CASO DE 401: toast "Token não configurado — cole na barra superior".
- 🚀 Publicar: `surveys.publish(id)` → retorna {slug, url} → abre PublishModal com `http://localhost:5173/s/{slug}`.

### 6. Carregar survey existente
- Se `/builder/:id`: `surveys.get(id)` → popula store. Se 401 → toast + mostra input de token.

## Regras

- Tokens CSS sempre (var(--...)). Phosphor Icons, nunca emoji como ícone (🎤/👁/💾/🚀 nos labels são aceitáveis só como emoji decorativo no texto, mas prefira Phosphor: Microphone, Eye, FloppyDisk, RocketLaunch).
- Estados loading/erro em toda chamada de API (spinner em botões, toast de erro).
- TS estrito: `npx tsc --noEmit` deve passar.
- NÃO COMMITAR.

## Verificação

- `cd apps/formly_app && npx tsc --noEmit` sem erros
- `npm run build` conclui
