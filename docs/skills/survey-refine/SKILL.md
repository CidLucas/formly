---
name: survey-refine
description: >
  Gera perguntas de refinamento para o criador de questionários do Formly.
  Use quando o usuário descreve um questionário/pesquisa em texto livre e
  precisamos afinar o contexto ANTES de gerar o esqueleto — objetivo,
  público-alvo, hipótese, canal de distribuição, duração e formato das
  respostas. Também use para avaliar se o pedido deveria ser um survey ou
  uma pesquisa qualitativa (entrevistas). Complementa survey-design.
---

# Survey Refine — Afinar o briefing antes de gerar o questionário

O objetivo desta fase é **reduzir a ambiguidade do briefing** com poucas
perguntas de alto impacto, não bombardear o usuário. Regra prática: no máximo
**3–5 perguntas**, priorizadas pelo que mais muda o desenho do questionário.

## Antes de perguntar: survey ou entrevista?

Surveys medem prevalência, frequência e atitude **em escala**. Entrevistas
exploram problemas que você ainda não conhece. Pergunte a si mesmo:

- O usuário quer saber **quantos** compartilham uma opinião/necessidade? → survey
- O usuário quer **descobrir problemas novos** que não sabe que existem? → sugira
  entrevistas (5–14 participantes) em vez de survey
- O usuário quer medir **mudança ao longo do tempo** (satisfação, NPS)? → survey
  repetível, com pergunta idêntica a cada onda

Se for entrevista, avise explicitamente: "Surveys confirmam e quantificam;
entrevistas exploram e revelam."

## Dimensões de refinamento (priorizadas)

Faça perguntas nesta ordem de impacto. Só avance para a próxima dimensão se a
resposta mudar materialmente o questionário.

### 1. Objetivo e decisão
- "O que você quer decidir ou melhorar com os resultados desta pesquisa?"
- "Qual a pergunta central que o questionário precisa responder?"
- Se não houver decisão clara: ajude a formular UMA hipótese testável no
  formato: *"Acreditamos que [mudança] para [usuários] vai [resultado], medido
  por [métrica]."* Uma hipótese por questionário.

### 2. Público-alvo e segmentação
- "Quem vai responder? (clientes atuais, leads, funcionários, público geral)"
- "Você precisa comparar grupos depois? (ex.: novos vs. antigos, por plano)"
  → Se sim, planeje perguntas demográficas/segmento e avise que segmentos com
  menos de 30 respostas não geram conclusões confiáveis.
- "Como os respondentes serão recrutados?" (e-mail, dentro do produto, link
  público) → define viés de seleção e benchmark de taxa de resposta esperada.

### 3. Escopo do questionário
- "Quantas perguntas você imagina? (ideal: 5–10, máximo 15)"
- "Quanto tempo os respondentes podem gastar? (ideal: < 5 minutos; acima de
  10–15 perguntas a qualidade despenca)"
- "O tom é formal ou mais leve?"

### 4. Formato das respostas
- "Quer respostas em áudio/depoimento em alguma pergunta?" (diferencial do
  Formly — só incluir se fizer sentido; respondentes em áudio demoram mais)
- "Precisa de upload de arquivo, data, número, ou lista dinâmica?" (casos de
  uso específicos, não usar por padrão)
- "Há perguntas abertas? (1–2 no máximo, no final do questionário)"

### 5. Restrições de análise
- "Os resultados serão públicos ou internos?"
- "Precisa de anonimato?" → informar no texto de introdução do questionário.

## Como apresentar as perguntas

- Envie as perguntas como **lista curta, uma por linha**, sem numeração
  obrigatória (o backend `generate_refinement_questions` já separa por linha).
- Ao receber as respostas, **resuma o briefing estruturado** (objetivo,
  público, escopo, formato) e confirme antes de gerar o esqueleto.
- Nunca gere o esqueleto com briefing ambíguo se a ambiguidade mudar o desenho.

## Erros a evitar

- Fazer perguntas demais (fatiga o usuário antes de começar).
- Perguntas que já têm resposta implícita na descrição (ler o briefing primeiro).
- Perguntas tendenciosas ("você quer uma pesquisa de satisfação?" quando o
  usuário ainda não disse).
- Perguntar sobre detalhes que não mudam o desenho (ex.: cor do tema).

## Saída da fase

Briefing estruturado com: **objetivo/hipótese, público, segmentação, nº de
perguntas, duração, formato (áudio?), perguntas abertas, anonimato** — pronto
para a fase de design (skill `survey-design`).

## Relação com o backend

Implementado como `generate_refinement_questions(description)` em
`services/formly/app/services/llm_service.py` (rota `POST /ai/refinement-questions`).
O prompt do sistema desta função deve incorporar este guia.
