# R5 — Frontend: Survey (página de resposta com os 12 tipos)

Repo: /home/ec2-user/formly — app em `apps/formly_app`.
Referência canônica: `scripts/reference/formly-site/formly-tipos-v2.html` (componentes de resposta com TODOS os estados) + `builder.html` (variante de cards).

## Contexto

A página pública `/s/:slug` é onde o respondente responde. O protótipo define os componentes de resposta para os 12 tipos (ver formly-tipos-v2.html — cada tipo com default/focado/respondido/erro/gravando/arrastando). O Survey atual (feito antes) tem 6 tipos e dark theme — **reescrever com os 12 tipos e o design wine/pine/paper**.

O protótipo mostra dois modos de navegação:
1. **Modo etapas** (`.nav-stage`): progress bar + "etapa 1 de 3" + botões ← Voltar / Avançar → (uma pergunta por vez)
2. **Modo scroll** (`.submit-sticky`): todas visíveis + botão "Enviar respostas" sticky no rodapé
3. **Tela de abertura** (`.screen-intro`): título + descrição + "Começar"
4. **Tela de conclusão** (`.screen-done`): "obrigado" + mensagem

## Tarefas — reescrever `src/pages/Survey.tsx`

### 1. Carregamento
- `publicApi.getSurvey(slug)` → {id, title, theme, logo_url, brand_colors, questions[]}
- Loading: spinner central (mono, muted). Erro 404: tela "Questionário não encontrado".

### 2. Tela de abertura (`.screen-intro`)
- h2 = título do survey, p = descrição (se houver), meta "~ N perguntas", botão `.btn` "Começar"
- Usar config do survey se existir (intro_text). Se não, mostrar título + "N perguntas".

### 3. Modo etapas (padrão)
- Uma pergunta por vez (`.q`), progress bar no rodapé (`.nav-stage`):
  - `.progress-bar` com width = (currentIndex+1)/N
  - `.progress-info`: "● etapa X" / "○ etapa Y" (para N pequeno) ou "Etapa X de N"
  - Botões: `.btn ghost` "← Voltar" (disabled na primeira) + `.btn` "Avançar →" (última: "Enviar respostas")
- Transição simples entre perguntas (fade/slide CSS leve).

### 4. Componentes de resposta (12 tipos) — usar classes do R1

Cada pergunta é um `.q` com `.q-kind` (badge) + `.q-label` + `.q-hint` opcional + componente:

| tipo | componente (classes) | valor salvo |
|---|---|---|
| text_short | `.input-short` + `.q-counter` (x/max_chars) | value_text |
| text_long | `.textarea-long` + `.q-counter` + `.audio-divider` "ou" + `.rec-btn` (gravar áudio companion) | value_text + transcription/audio |
| multiple_choice (única) | `.choices` + `.choice` + `.radio-ind` (toggle seleção, 1 opção) | value_text |
| multiple_choice (múltipla) | `.choices` + `.choice` + `.check-ind` (toggle, várias) | value_choices |
| scale (likert) | `.likert-row` (pontos clicáveis `.likert-pt`), `.likert-labels`, `.likert-neutral`, `.likert-na` ("Não sei/N.A.") | scale_value |
| nps | `.nps-row` com 11 `.nps-pt` (0-10, zonas detractor 0-6 / neutral 7-8 / promoter 9-10), `.nps-labels` | scale_value |
| ranking | `.rank-list` com `.rank-item` (draggable, grip + num + label), `.rank-drop-zone` | value_choices (ordem) |
| matrix | `.matrix-wrap` tabela rows×cols com `.mat-radio` (1 por linha) + mobile `.matrix-cards` | value_choices ["row:col"] |
| file_upload | `.dropzone` (clique/arrastar) + `.file-item` lista | file_name (+ file_url futuro) |
| datetime | `.datetime-row` (input dd/mm/aaaa com mask + hh:mm opcional) | value_text |
| number | `.input-num` + `.num-meta` (min/max) + validação `.out-of-range` | scale_value |
| dyn_list | `.dyn-list` + `.dyn-add` + `.dyn-suggestions` chips | value_choices |
| audio (legado) | `.rec-btn` circular + timer + waveform (`.audio-waveform`, `.play-btn`, `.bars`) | transcription + audio_url |

**Áudio (texto longo + áudio):** usar a lógica do AudioRecorder existente (src/components/AudioRecorder.tsx) mas ESTILIZADO com as classes do protótipo (.rec-btn, .rec-dot, .rec-timer, .audio-waveform, .play-btn, .bars, .wave-time, .audio-rerecord, animações pulse-rec/blink-rec). Estados: vazio → digitando → gravando → texto+áudio (com waveform + regravar).

**Validação:** pergunta obrigatória sem resposta → não avança + `.q.error` + `.q-err` ("Este campo é obrigatório." / "O valor precisa ser entre X e Y."). Estados do protótipo: `.q.focused` (foco), `.q.answered` (respondida), `.q.error`.

### 5. Rascunho + envio
- Salvar rascunho em localStorage a cada avanço (`formly_draft_<slug>`): {index, answers}. Restaurar ao montar.
- Enviar: `publicApi.submitResponse(slug, {respondent_ref, answers})` — answers com {question_id, value_text?, value_choices?, scale_value?, transcription?, file_name?}
- Sucesso → `.screen-done`: "obrigado" + "Suas respostas foram enviadas. Pode fechar esta janela." + link "Criado com Formly"
- Já respondeu (flag localStorage) → mostra tela "Você já respondeu este questionário"
- Erro de rede → toast + manter respostas no localStorage + botão "Tentar novamente"

### 6. Modo scroll (configurável)
Se survey config tiver `mode: "scroll"`, renderizar todas as perguntas + `.submit-sticky` com botão "Enviar respostas". Default: etapas.

## Regras
- Classes do protótipo (R1) — visual IDÊNTICO
- Ícones: Phosphor (Microphone, ArrowLeft, ArrowRight, Play, Check); SVG do protótipo para ▶/⟳ pode ser texto mono
- TS estrito: `npx tsc --noEmit`
- NÃO COMMITAR

## Verificação
- `npx tsc --noEmit` + `npm run build`
- Browser: abrir `/s/{slug}` de um survey publicado com os 12 tipos → cada tipo renderiza corretamente com estilo wine/pine/paper
