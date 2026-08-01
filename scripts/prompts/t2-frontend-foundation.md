# T2 — Frontend: fundação (api client + shell + componentes compartilhados)

Repo: /home/ec2-user/formly — app em `apps/formly_app` (Vite + React 18 + TS + Zustand + React Query + Phosphor Icons).
Node 22 disponível. Rode `npm install` em apps/formly_app se node_modules não existir.

## Contexto

O frontend atual é todo stub (páginas Builder/Survey/Dashboard com "Em construção").
A stack segue o padrão Blu V3: Vite + React 18, tokens CSS em `src/styles/global.css`, Zustand para estado global, React Query para server state, Phosphor Icons (`@phosphor-icons/react`), react-router-dom.

Tokens já definidos em global.css: --bg, --surface, --glass, --fg, --mu, --mu2, --ac, --ac-hi, --ac-grad, --urg, --att, --ok, --teal, --gb, --gb2, --r (8px), --rl (12px), --font-body, --font-mono, --shadow-1, --shadow-3, --odim, --adim, --udim, --adm2.

API base: `VITE_API_URL || '/api'` com proxy Vite → localhost:8000 (já configurado no vite.config.ts).

## Tarefas

### 1. Expandir `src/lib/api.ts`

Manter a função `api<T>()` existente. Adicionar suporte a token Bearer: se `localStorage.getItem('formly_token')` existir, incluir `Authorization: Bearer <token>` nos headers (exceto nas chamadas públicas).

Adicionar aos objetos existentes:

```ts
surveys.exportCsv: (id: string) => fetch com o token, retorna blob
ai: {
  skeleton: (description: string) => POST /ai/skeleton {description}
  refinementQuestions: (description: string) => POST /ai/refinement-questions {description}
  refine: (survey: any, message: string) => POST /ai/refine {survey, message}
}
transcribe: (file: File) => FormData com campo 'file' → POST /transcribe (sem auth), retorna {text}
publicApi.partial: (slug: string, data: any) => POST /public/surveys/{slug}/responses/partial
```

Tipos: criar `export interface Question { id?: string; type: string; title: string; required: boolean; config: Record<string, any> }` e `export interface SurveyData { id?: string; title: string; questions: Question[]; status?: string; slug?: string; theme?: string; brand_colors?: any }`.

### 2. Criar `src/components/Shell.tsx`

Layout base do app autenticado: topbar com logo "Formly", nav (Meus questionários / Criar novo), e área de conteúdo (children). Estilo com tokens CSS (glass panels, --ac para accent). Usar Phosphor icons (House, Plus, ChartBar). Sem auth real por enquanto: ler token de localStorage; se não existir, mostrar banner discreto "Modo dev — token não configurado" com input para colar token (salva em localStorage).

### 3. Criar `src/components/QuestionCard.tsx`

Card de pergunta para o builder. Props: `question: Question`, `onChange(q: Question)`, `onRemove()`, `onDuplicate()`, `dragHandleProps` (para reordenação via HTML5 drag or botões ↑↓).
Conteúdo:
- Header: badge com número, select de tipo (text_short, text_long, multiple_choice, audio, scale, file_upload), toggle "Obrigatória", menu de ações (duplicar/excluir, ↑/↓).
- Input do título (edição inline).
- Se multiple_choice: lista de opções editáveis (input + botão remover) e botão "+ Adicionar opção"; checkbox "Permitir múltipla seleção" (config.multiple).
- Se scale: inputs min/max (1-5 ou 1-10) e labels opcionais (label_min, label_max).
- Se audio: config.max_duration_secs (default 60) e toggle follow_up_enabled.
- Se text_short/text_long: config.max_chars (default 500/5000).
- Estilo: panel glass com borda --gb, radius --rl.

### 4. Criar `src/components/AudioRecorder.tsx`

Gravador de áudio com MediaRecorder API. Props: `onRecorded(blob: Blob)`, `onTranscription(text: string)`, `maxDurationSecs?: number`.
- Botão circular 🎤 (usar Phosphor Microphone) — grava/para; timer mm:ss; waveform fake (barras animadas com divs) durante gravação.
- Após parar: preview com <audio controls>, botão "Regravar", botão "Enviar e transcrever".
- Envia via `transcribe(file)` da api.ts; mostra status "Transcrevendo..." → "Transcrição concluída"; chama onTranscription com o texto.
- Fallback: se transcrição falhar, mostra aviso amarelo e chama onTranscription('') — o áudio continua salvo.
- Estilo com tokens (--urg para gravando, --ok para concluído).

### 5. Criar `src/components/PublishModal.tsx`

Modal de publicação. Props: `open`, `onClose()`, `surveyUrl: string` (ex: http://localhost:5173/s/abc123), `slug: string`.
- Banner verde "✅ Questionário publicado com sucesso!"
- Input readonly com o link + botão Copiar (navigator.clipboard)
- QR code: usar lib `qrcode.react` — ADICIONAR como dependência (`npm install qrcode.react`) — render <QRCodeSVG value={surveyUrl} />
- Botão "Abrir em nova aba" (window.open)
- Abas: Link | Distribuir. Aba Distribuir: lista de contatos da API (GET /api/contacts) com checkboxes, busca por nome/email, botão "Copiar link" e "Enviar por WhatsApp" (wa.me com texto).

### 6. Criar `src/store/builderStore.ts` (Zustand)

Estado do builder: `title`, `questions: Question[]`, `mode: 'chat' | 'canvas' | 'text'`, `chatMessages: {role: 'user'|'assistant', content: string}[]`, ações: `setTitle`, `setQuestions`, `setMode`, `addQuestion`, `updateQuestion`, `removeQuestion`, `moveQuestion(index, dir)`, `addChatMessage`, `reset`.

## Regras

- Sempre usar tokens CSS (var(--...)), nunca hex hardcoded.
- Nunca usar emoji como ícone de UI — usar Phosphor Icons.
- Componentes com estilo inline consistente com o design system (glass, radius --rl, font 13px body).
- TypeScript estrito: `npm run build` (tsc -b && vite build) deve passar.
- NÃO COMMITAR. Apenas criar/editar arquivos.

## Verificação

- `cd apps/formly_app && npx tsc --noEmit` sem erros
- `npm run build` conclui sem erro
