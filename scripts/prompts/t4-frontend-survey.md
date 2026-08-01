# T4 — Frontend: Página de Resposta pública (Respondente)

Repo: /home/ec2-user/formly — app em `apps/formly_app` (Vite + React 18 + TS + Phosphor Icons).
Rota já registrada: `/s/:slug` → Survey (App.tsx). **Página pública — SEM auth, SEM Shell.**

## Contexto — já existe (NÃO recriar)

- `src/lib/api.ts` — `publicApi.getSurvey(slug)`, `publicApi.submitResponse(slug, data)`, `publicApi.partial(slug, data)`, `transcribe(file)`
- `src/components/AudioRecorder.tsx` — gravador MediaRecorder + transcrição (criado na T2)
- Tokens CSS: --bg, --surface, --glass, --fg, --mu, --mu2, --ac, --ac-hi, --urg, --att, --ok, --gb, --gb2, --r, --rl, --shadow-1, --shadow-3

## Objetivo

Implementar `src/pages/Survey.tsx` — a página pública do requisito página-02: exibe perguntas **uma por vez** (estilo Typeform), coleta respostas (texto, múltipla escolha, escala, áudio), valida obrigatórias, salva rascunho em localStorage, e envia ao final.

## Comportamento

### 1. Carregamento
- `useEffect` com slug → `publicApi.getSurvey(slug)` → {id, title, theme, logo_url, brand_colors, questions[]}.
- Loading: spinner central. Erro 404: tela "Questionário não encontrado" com link para formly.app.
- Aplica brand_colors se existir (accent color inline via CSS var no container).

### 2. Navegação (uma pergunta por vez)
- State: `currentIndex`, `answers: Record<questionId, any>`.
- Header: título + progresso "Pergunta X de N" + barra de progresso (% concluído).
- Footer: [← Anterior] [Próxima →] (última: [Enviar]). Anterior desabilitado na primeira.
- Ao avançar: valida obrigatória → se vazia, erro inline no card (borda vermelha + mensagem "Esta pergunta é obrigatória") e NÃO avança.
- Salva rascunho: a cada avanço, `localStorage.setItem('formly_draft_'+slug, JSON.stringify({index, answers}))`. Ao montar, restaura se existir.

### 3. Componentes de resposta por tipo (dentro de um card central, largura máx 640px)

| type | Render |
|---|---|
| text_short | `<input>` com maxLength config.max_chars (default 500), placeholder do config |
| text_long | `<textarea>` maxLength config.max_chars (default 5000) |
| multiple_choice | radios (config.multiple false) ou checkboxes (true), opções de config.options; se config.other → opção "Outro" com input |
| scale | radios inline de config.min..config.max (default 1-5), labels extremos config.label_min/label_max |
| audio | `<AudioRecorder onRecorded onTranscription>` — guarda blob e transcrição; resposta = {audio_url: null, transcription: texto} (upload de blob real é Fase 1 — na T4, guardar apenas transcription + flag has_audio=true; o blob pode ser enviado como base64 no campo value_text se < 1MB, senão só transcrição) |
| file_upload | input file com accept config.allowed_types; guardar nome (file_name) — upload real é Fase 1 |

### 4. Envio
- Última pergunta → botão [Enviar] → `publicApi.submitResponse(slug, {respondent_ref: uuid gerado e persistido em localStorage, answers: [...]})`.
- Cada answer: `{question_id, value_text?, value_choices?, scale_value?, transcription?, file_name?}` conforme o tipo.
- Loading no botão → sucesso: tela de encerramento (check verde animado simples via CSS, "Obrigado por responder!", mensagem de encerramento se houver; link "Criar seu próprio questionário no Formly" → formly.app).
- Erro de rede: toast "Erro ao enviar. Suas respostas foram salvas neste dispositivo." + botão "Tentar novamente".
- Após sucesso: `localStorage.removeItem('formly_draft_'+slug)` + flag `formly_done_'+slug` para evitar re-resposta (se flag existir ao montar, mostra tela "Você já respondeu este questionário").

### 5. Estilo
- Tema claro e limpo (diferente do app autenticado): fundo --bg, card --surface com borda --gb, radius --rl, texto --fg, accent --ac. Centralizado, máx 640px. Progress bar com --ac.
- Footer: "Criado com Formly" discreto (--mu).

## Regras
- Tokens CSS. Phosphor Icons (Microphone, ArrowLeft, ArrowRight, Check). Spinners CSS simples (border animation).
- TS estrito: `npx tsc --noEmit` sem erros.
- NÃO COMMITAR.

## Verificação
- `cd apps/formly_app && npx tsc --noEmit`
- `npm run build`
