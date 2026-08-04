---
name: survey-metrics
description: >
  Define quais métricas o dashboard do Formly deve calcular e como apresentá-las,
  alinhadas às melhores práticas de pesquisa (NPS, CSAT, CES, SUS, taxa de
  resposta, completude) com limites honestos de significância estatística.
  Use ao especificar/implementar o dashboard de um questionário, ao interpretar
  números brutos, ou ao decidir o que exibir para o dono do questionário.
  Inclui o spec técnico (campos de stats, endpoints, componentes) para
  implementação no backend e frontend.
---

# Survey Metrics — O que medir e como apresentar no dashboard

Cada número no dashboard deve ajudar o dono do questionário a tomar uma
decisão. Números sem contexto (benchmark, N, limite de confiança) são ruído.

## Camadas de métricas

### 1. Participação (saúde da coleta)

| Métrica | Fórmula | Sinal de alerta |
|---|---|---|
| Taxa de resposta | respostas ÷ convites | < 10% (e-mail); < 20% (in-app) |
| Taxa de completude | completas ÷ iniciadas | < 50%: questionário longo/difícil |
| Parciais | iniciadas − completas | Muitas parciais: pergunta no meio bloqueia? |
| Tempo médio de resposta | média de `time_spent_secs` | Suspeito se muito curto (< 30s p/ 10 perguntas) |
| Respostas em áudio | contagem `audio_responses` | Mostra adoção do diferencial do Formly |

### 2. Sentimento (o que os respondentes acham)

**NPS** (`nps`)
- Fórmula: Promoters (9-10) − Detractors (0-6) como %; Passives (7-8) não entram
- Ex.: 50% promoters, 20% detractors → NPS = +30 (faixa −100 a +100)
- Benchmark: +30 é bom; > +50 excelente; B2B SaaS típico +20 a +40; abaixo de 0 é crítico
- ⚠️ NPS é métrica de tendência, não diagnóstico — não traduz sozinho em
  recomendação de feature. Sempre parear com a pergunta aberta "por quê?"
- Exibir: score, distribuição (promoters/passives/detractors), tendência se houver onda anterior

**CSAT** (satisfação)
- Pergunta tipo "Qual sua satisfação com X?" em escala 1-5 (ou 1-10)
- Fórmula: % de respostas nos topos (4-5 de 5, ou 9-10 de 10)
- Benchmark: 80%+ é bom; 60-80% médio; < 60% ruim
- Uso: transacional (pós-compra, pós-suporte), não de longo prazo

**CES** (esforço)
- Pergunta: "Quão fácil foi fazer X?" — escala 1 (muito difícil) a 5/7 (muito fácil)
- Fórmula: % nos topos da escala (fácil)
- Benchmark: > 70% "fácil" é bom; esforço correlaciona com churn e recompra
- Uso: CX/UX transacional (checkout, onboarding, suporte)

**Distribuições Likert/scale**
- Sempre mostrar a **distribuição completa** (barras), não só a média
- Média esconde bimodalidade (metade ama, metade odeia = média neutra)
- Exibir N de cada pergunta junto da distribuição

### 3. Usabilidade (quando aplicável)

**SUS** (System Usability Scale)
- 10 perguntas fixas em escala Likert 1-5 (alternando positivo/negativo), usar verbatim
- Score 0-100: fórmula padrão (soma com inversões: itens ímpares −1, pares 5−)
- Benchmark: 68 = média; > 80 = bom; > 90 = excelente
- Exibir: score global + N

## Regras de significância (honestidade estatística)

- **N < 100**: os números indicam **direção**, não significância — rotular
  explicitamente ("indicativo")
- **N < 30 por segmento**: não fazer afirmações por segmento
- Margem de erro aproximada p/ referência (95% conf): ~±10% com N=100, ~±7%
  com N=200, ~±5% com N=385 — rotular como aproximado, não calcular precisão
- Sempre exibir N (total e por pergunta) ao lado de cada métrica
- Diferenças entre grupos só são reais se > margem de erro combinada
- Nunca afirmar causalidade a partir de survey transversal (correlação ≠ causa)

## Apresentação no dashboard

- **Topo**: KPIs de participação (respostas, completude, taxa) + NPS/CSAT/CES
  quando o questionário tiver as perguntas correspondentes
- **Por pergunta**: distribuição em barras; matriz em heatmap; NPS com
  decomposição; ranking com ordem média; abertas com contagem e amostra de citações
- **Aviso de N baixo**: badge "dados insuficientes" quando N < 30 (ou < 100 p/ conclusões)
- **Export CSV**: incluir os novos campos por tipo (já coberto no backend)

---

## Spec técnico para implementação (backend + frontend)

### Backend — `GET /api/surveys/{id}/stats`

Campos a adicionar ao payload atual (`total_responses`, `complete`, `partial`,
`completion_rate`, `audio_responses`, `avg_scale`):

```jsonc
{
  // já existentes…
  "avg_time_secs": 142.3,
  "response_rate": 0.23,               // respostas ÷ contatos com envio
  "nps": { "score": 30, "promoters": 50, "passives": 30, "detractors": 20, "n": 120 }, // se houver pergunta nps
  "csat": { "pct_top": 0.81, "scale": 5, "n": 118 },      // se houver pergunta scale de satisfação (detectar por título/config)
  "by_question": [
    {
      "question_id": "…",
      "type": "nps",
      "title": "…",
      "n": 120,
      "distribution": { "0": 2, "1": 1, "…": "…", "10": 15 },
      "avg": 8.1,
      "nps_score": 30,                 // só para tipo nps
      "top2_pct": null                 // só para scale: % nos 2 topos
    }
  ],
  "low_n_warning": true                // true se alguma métrica com n < 30
}
```

- Detectar perguntas CSAT/CES **heurística simples**: tipo `scale` cujo título
  contenha "satisf" (CSAT) ou "fácil/esforço" (CES); tipo `nps` explícito
- **NÃO calcular NPS/CSAT quando a pergunta não existe no questionário** — null
- Cálculo server-side (não no front) — o front consome e renderiza

### Backend — endpoint de análise (Fase 4, ver survey-analysis)

`POST /api/ai/analyze` — recebe `{survey_id}` (ou survey + responses), retorna
relatório em markdown estruturado. Implementado como função nova
`analyze_responses()` em `llm_service.py` (1 função = 1 prompt).

### Frontend — Dashboard.tsx

- **KPI row**: manter cards atuais + adicionar NPS/CSAT/CES cards (condicional,
  só quando o dado existir) + tempo médio
- **Por pergunta**: para `nps` → barras 0-10 com corte promotores/passivos/detratores;
  para `scale` → barras 1-5 com distribuição completa; para `matrix` → heatmap
  linhas × colunas; para `ranking`/`dyn_list` → ordem média dos itens; para
  abertas → lista com contagem + expansão de citações
- **Badge "dados insuficientes"** quando `low_n_warning` ou n < 30 na pergunta
- **Export**: manter CSV; considerar export de distribuições agregadas

### Critérios de aceite

- [ ] Stats retorna `by_question` com distribuição por tipo
- [ ] NPS calculado corretamente (0-6/7-8/9-10) apenas quando há pergunta nps
- [ ] Dashboard mostra distribuição completa (não só média) por pergunta
- [ ] Badge de N insuficiente aparece quando n < 30
- [ ] `POST /ai/analyze` responde com relatório estruturado
