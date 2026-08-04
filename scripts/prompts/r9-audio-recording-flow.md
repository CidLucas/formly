# R9 — Fluxo completo de gravação de áudio na Landing

Repo: /home/ec2-user/formly — app em `apps/formly_app`.
Arquivo principal: `src/pages/Landing.tsx` (reescrever a lógica de gravação).
Referência visual: `scripts/reference/formly-site/index.html` (botão `.btn-audio`, `.audio-dot`, keyframes `pulse-rec`/`blink-rec`).

## Contexto

O usuário relatou: ao clicar "Gravar áudio", a gravação **para sozinha após ~2 segundos**. Causa: `Landing.tsx` linha 80 tem `window.setTimeout(stopRecording, 2000)` — comportamento herdado do mock do protótipo (que gravava 2s e navegava). O backend de transcrição (`POST /api/transcribe`, Groq Whisper) já suporta áudio de qualquer duração (limite 25MB).

O fluxo que o usuário espera:
1. Clicar "Gravar áudio" → começa a gravar
2. Aparece um **relógio/timer** marcando o tempo decorrido
3. Grava pelo tempo que quiser → clica em **parar**
4. Mostra a **transcrição** para o usuário **editar e dar OK**
5. Pede o **e-mail** do usuário
6. Passa para a próxima tela (builder)

## Tarefas — reescrever a gravação em `src/pages/Landing.tsx`

### 1. Gravação livre com limite de 2 minutos (remover o timeout de 2s)

- **Remover** `timerRef` e o `setTimeout(stopRecording, 2000)` (linha 80).
- Gravação começa no clique e **para quando o usuário clicar de novo** (toggle: botão vira "Parar" / "Gravando...").
- **LIMITE DE 2 MINUTOS (120s):** ao atingir 120s, **parar automaticamente** a gravação (como se o usuário tivesse clicado em parar) e seguir o mesmo fluxo de transcrição. Mostrar aviso breve ao usuário ("Máximo de 2 minutos atingido" — pode ser um texto inline no lugar do timer ou um alert). O timer deve mostrar o limite: ex. `1:59` → `2:00` e para.
- Manter MediaRecorder + chunks + `stopTracks()` (já existentes).

### 2. Timer visível durante a gravação

- Enquanto `recording === true`, mostrar um **cronômetro** ao lado do botão (ou no lugar do texto), no formato `0:00`, `0:07`, `1:23`...
- Implementar com `setInterval` (1s) + estado `elapsedSecs`, zerando ao iniciar.
- Estilo: fonte `var(--mono)`, cor `var(--muted)` (padrão do design system) — pode usar a classe `.mono` existente ou inline.
- O botão `.btn-audio.recording` já tem o estilo pulsante — manter.

### 3. Modal/etapa de transcrição (após parar)

Ao parar a gravação:
- Enviar o blob para `POST /api/transcribe` (função `transcribe()` já existe em `lib/api.ts`).
- Enquanto transcreve: estado "Transcrevendo..." (spinner/desabilitado).
- Mostrar uma **etapa/modal** (pode ser um card abaixo do input, ou um overlay simples — usar classes do design system, ex: `.q-card` com borda, ou overlay com `--card` background) com:
  - Texto da transcrição em um **textarea editável** (placeholder "Transcrição do áudio...")
  - Botão "OK / Continuar" (`.btn` primário wine) → usa o texto editado como intent
  - Botão "Cancelar / Refazer" (`.btn.ghost`) → descarta, volta ao estado inicial
- Ao dar OK: `goToBuilder(textoEditado)` (funcionalidade existente — salva em `sessionStorage.formly_intent` e navega para `/builder?description=...`).

### 4. Pedir e-mail antes de ir ao builder

- Antes de navegar para o builder, mostrar um campo de **e-mail** (pode estar no mesmo modal da transcrição, abaixo do textarea):
  - Input e-mail (class `.email-input` do design system, já existe no CSS)
  - Botão "Continuar" (`.btn-primary`)
  - Validar formato básico (regex simples de e-mail). Se inválido, mensagem de erro inline (class `.q-err` ou texto wine).
  - **Salvar o e-mail** em `localStorage` (chave `formly_email`) e/ou `sessionStorage` — o builder/backend poderá usar depois. Se já existir e-mail salvo, **não pedir de novo** (pular direto).
- Ordem do fluxo no modal: transcrição (editar + OK) → e-mail (se não salvo) → navegar.

### 5. Fluxo do input de texto continua igual

- Enter no input de texto continua indo direto ao builder (sem pedir e-mail? → **decidir**: se e-mail não salvo, também pedir antes de navegar, para consistência. O protótipo index→auth→builder pedia conta. Manter consistente: sempre pedir e-mail se não tiver salvo, tanto por texto quanto por áudio).

## Verificação

- `npx tsc --noEmit` → exit 0
- `npm run build` → OK
- Teste manual no browser (localhost): gravar > 10s → timer visível → parar → transcrição aparece → editar → e-mail → vai ao builder
- NÃO COMMITAR
