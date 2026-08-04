# R3 — Frontend: Landing + Auth (telas 1 e 2 do protótipo)

Repo: /home/ec2-user/formly — app em `apps/formly_app` (Vite + React 18 + TS + react-router-dom + Phosphor Icons).
Referência canônica (visual IDÊNTICO): `scripts/reference/formly-site/index.html` (landing) e `scripts/reference/formly-site/auth.html` (auth).

## Contexto

Design system wine/pine/paper já reescrito em `src/styles/global.css` (task R1). Classes disponíveis: `.landing`, `.logo`, `.question`, `.input-wrap`, `.input-main`, `.or-divider`, `.btn-audio`, `.audio-dot`, `.auth`, `.title`, `.subtitle`, `.btn-google`, `.divider`, `.email-form`, `.email-input`, `.btn-primary`.

Rotas atuais (App.tsx):
- `/` → Builder
- `/builder/:id?` → Builder
- `/s/:slug` → Survey
- `/dashboard/:id` → Dashboard

## Tarefas

### 1. Criar `src/pages/Landing.tsx`

Reproduzir EXATAMENTE o `index.html` do protótipo (classes .landing/.logo/.question/.input-wrap/.input-main/.or-divider/.btn-audio/.audio-dot):
- Logo "formly" (wine, display 700, 2rem)
- "Precisa de um questionário?" (display 1.4rem)
- Input grande (class .input-main), placeholder "Me fala qual, ou grave um áudio...", autofocus
- Divider "ou"
- Botão pill "Gravar áudio" com dot pulsante (class .btn-audio, .recording com @keyframes pulse-rec)
- Enter no input → navega para `/builder?description=<texto>` (guardar a descrição em sessionStorage 'formly_intent' e navegar para /builder)
- Botão gravar: usa MediaRecorder (se disponível) → grava 2s+ → envia para `/api/transcribe` → texto transcrito vai para sessionStorage → navega para /builder. Se navigator.mediaDevices indisponível, fallback: alerta "Gravação não suportada neste navegador".
- Estilo: body centralizado (o protótipo usa flex center full-height — aplicar via style inline no container ou classe).

### 2. Criar `src/pages/Auth.tsx`

Reproduzir EXATAMENTE o `auth.html`:
- Logo "formly" + título "Só mais uma coisa" + subtítulo "Crie uma conta rapidinho para salvar seu questionário."
- Botão "Continuar com Google" (class .btn-google com SVG do Google do protótipo) → em dev: chama `/api/dev/login` → salva token no localStorage → navega para /builder
- Divider "ou"
- Form e-mail (class .email-form/.email-input/.btn-primary) → mesma lógica: dev login → salvar token → /builder
- Nota: como o Supabase Auth ainda não está configurado, ambos os botões usam o dev login em dev. Deixar comentário claro no código indicando onde plugar Supabase OAuth depois.

### 3. Atualizar `src/App.tsx`

Rotas:
- `/` → Landing
- `/auth` → Auth
- `/builder` e `/builder/:id?` → Builder
- `/s/:slug` → Survey
- `/dashboard/:id` → Dashboard
- `/send/:id` → Send (pode ser criado depois — se não existir ainda, deixar rota comentada ou placeholder leve)

### 4. Atualizar `src/components/Shell.tsx` (se usado pelo Builder)

O protótipo do builder NÃO tem topbar estilo app — é o header "Pesquisa de Clima 2026" com "+ Pergunta" e "Enviar →". O Shell atual (topbar Formly + nav + banner token) pode ser simplificado ou mantido apenas como wrapper do Builder se não conflitar. **Decisão:** o Builder passa a usar o layout do protótipo (header próprio), o Shell deixa de ser usado nas páginas principais — pode permanecer no código mas sem ser renderizado em Builder/Landing/Auth. Não remover arquivo (pode ser útil depois).

## Regras

- Tokens CSS e classes do global.css novo (nunca hex hardcoded inline — usar var(--wine) etc. quando possível; as classes do protótipo já têm os valores).
- Phosphor Icons para ícones auxiliares; SVG do Google copiado do auth.html.
- TS estrito: `npx tsc --noEmit` passa.
- NÃO COMMITAR.

## Verificação

- `cd apps/formly_app && npx tsc --noEmit`
- `npm run build`
- Teste manual via browser: abrir http://localhost:5173/ → landing visível com logo/input/botão áudio → digitar texto → Enter → vai para /builder com a descrição preenchida no chat.
