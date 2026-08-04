---
name: survey-analysis
description: >
  Analisa as respostas de um questionário do Formly depois que a coleta
  terminou e as estatísticas estão prontas — transforma números em insights
  acionáveis com honestidade estatística. Produz: resumo executivo, auditoria
  de metodologia, análise por pergunta, segmentação, clusterização de
  respostas abertas, validação de hipóteses, limitações ("o que os dados NÃO
  mostram") e recomendações priorizadas. Use quando o dashboard/skills já tem
  as respostas e o dono quer o relatório. Complementa survey-metrics
  (que define o que o dashboard mostra); esta skill interpreta.
---

# Survey Analysis — Interpretar respostas com honestidade

O princípio central: **ser honesto sobre o que os dados NÃO mostram vale mais
do que conclusões confiantes a partir de dados fracos.** Uma afirmação de 90%
de confiança com 47 respostas de um questionário com pergunta tendenciosa é
pior do que nenhuma afirmação.

## Inputs

- Respostas brutas (linhas com `answers`) — preferível; permitem cross-tab e
  detecção de viés que agregados escondem
- Estatísticas do dashboard (survey-metrics) quando respostas brutas são
  volumosas demais
- Contexto do desenho: hipótese que motivou o questionário, público-alvo,
  método de recrutamento
- (Opcional) dados comparativos: ondas anteriores, benchmarks de mercado

## O que produzir (estrutura do relatório)

### 1. Resumo executivo (3-5 frases)
Os 2-3 achados centrais; rótulo de confiança; a principal ressalva sobre os dados.

### 2. Auditoria de metodologia (o que foi dito vs. o que foi feito)
- N (taxa de resposta: X% dos convites)
- Método de recrutamento (painel, e-mail, in-app, link público) → viés de seleção
- Quem respondeu vs. quem foi convidado (segmentos super/sub-representados)
- Riscos de desenho: perguntas tendenciosas, duplas, opções sobrepostas

Declarar explicitamente: "essas escolhas de metodologia afetam as conclusões."

### 3. Análise por pergunta
Para cada pergunta: distribuição (contagens e %), confiança (N < 100 = direção
apenas; margem de erro aproximada), interpretação, o que NÃO mostra, e
segmentação quando disponível. Tabela para 5+ perguntas homogêneas; seções para
tipos mistos.

### 4. Segmentação
- Distribuição por segmento (novos vs. antigos, por plano, etc.)
- Flag: segmentos com N < 30 → sem afirmações confiáveis
- Segmentos que divergem do padrão geral (sinal de priorização)

### 5. Respostas abertas (clusterização temática)
- 3-7 temas; por tema: 2-3 citações (apenas das respostas reais, nunca inventadas),
  contagem de menções (aproximada), valência emocional
- **Temas que contradizem o padrão quantitativo** costumam ser o sinal mais valioso
- Rotular: clusterização assistida por IA reflete os trechos fornecidos, não contagem completa

### 6. Validação de hipóteses
Para cada hipótese do briefing:
- Status: `SUPORTADA` / `CONTRADITADA` / `INCONCLUSIVA` / `NÃO TESTADA PELA PESQUISA`
- Evidência (qual pergunta/tema)
- Confiança: Alta / Média / Baixa (baseada em amostra, metodologia, força do sinal)

Hipótese que o questionário não testou (pergunta ausente ou mal formulada) é
rotulada explicitamente como "não testada por esta pesquisa".

### 7. O que os dados NÃO mostram (limitações)
- População não representada (ex.: só power users; nada sobre novos usuários)
- Perguntas não respondidas (ex.: sabemos o que querem, não o que pagariam)
- Confundidores (ex.: amostra recrutada por e-mail após uma queda de serviço →
  satisfação deprimida)
- Próxima pesquisa que fecharia a lacuna mais importante

### 8. Recomendações priorizadas (top 3-5)
Cada uma: recomendação, evidência que a sustenta, confiança, contra-evidência
(se houver), e qual pesquisa adicional a fortaleceria. Ordenar por impacto × confiança.

### 9. Próximos passos
- Que artefato esta análise deve gerar (atualizar PRD, disparar follow-up,
  agendar entrevistas para aprofundar um tema)
- Decisões que esta análise pode informar — e as que não pode

## Protocolos de recusa (não engolir dados fracos)

1. **Amostra insuficiente** (N total < 100 para inferência geral; < 30 por
   segmento): reportar direção, rotular confiança Baixa, e avisar para não
   basear decisões de capital nisso.
2. **Pergunta tendenciosa** (ex.: "Você gostaria de um recurso que economiza
   10h por semana?"): reportar mas flagrar como VIESADO (superestimado em
   20-40 pontos percentuais).
3. **Viés de recrutamento** (amostra só de power users): não generalizar.
4. **NPS como única entrada para decisão estratégica**: "NPS é métrica de
   tendência, não diagnóstico. Mostra o rumo, não o que fazer." (ver survey-metrics)
5. **Causalidade a partir de survey transversal**: correlação ≠ causa; causação
   exige experimento (A/B) ou dados longitudinais.

## Formato da resposta

Markdown estruturado com as 9 seções — o mesmo formato que a função
`analyze_responses()` do backend deve retornar (Fase 4), pronto para ser
exibido no dashboard do Formly como relatório.

## Relação com as outras skills

- `survey-metrics` → define o que o dashboard calcula (esta skill consome)
- `survey-refine` → forneceu a hipótese original (esta skill valida)
- `survey-design` → explica os tipos de pergunta (esta skill interpreta cada tipo)
