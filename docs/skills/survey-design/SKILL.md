---
name: survey-design
description: >
  Projeta o questionário em si no Formly — escolhe os tipos de pergunta
  certos entre os 12 suportados, estrutura a ordem, escreve perguntas sem
  viés e valida o desenho. Use depois da fase de refino (survey-refine),
  quando o briefing já está claro, para montar o esqueleto de perguntas.
  Também use ao revisar/editar um questionário existente no builder.
---

# Survey Design — Montar o questionário no Formly

Esta skill transforma o briefing (objetivo, público, escopo) em um
questionário bem desenhado usando os **12 tipos de pergunta do Formly**.
O princípio: cada pergunta existe para responder uma decisão — se não há
decisão, não há pergunta.

## Os 12 tipos do Formly e quando usar cada um

| Tipo | Config JSONB | Use para | Cuidado |
|---|---|---|---|
| `text_short` | `{"max_chars": 500}` | Dados curtos: nome, e-mail, cidade, uma frase | Não use para respostas longas |
| `text_long` | `{"max_chars": 400, "audio_enabled": true}` | Explicações, histórias, sugestões | 1-2 por questionário; cansa o respondente |
| `multiple_choice` (única) | `{"options": [...], "multiple": false}` | Escolha mutuamente exclusiva | Opções exaustivas; incluir "Outro" se preciso |
| `multiple_choice` (múltipla) | `{"options": [...], "multiple": true}` | Várias opções aplicáveis | Não use para ranking (não captura ordem) |
| `scale` (Likert) | `{"min": 1, "max": 5, "labels": [...], "na_option": true}` | Atitude, concordância, satisfação | Sempre rotular extremos; consistência de direção |
| `nps` | `{"min": 0, "max": 10}` | Recomendação (0-10) — métrica comparável | Não use como medida completa de satisfação |
| `ranking` | `{"options": [...]}` | Ordenar preferências | Máx. 5-7 itens (cognitivamente caro) |
| `matrix` | `{"rows": [...], "columns": [...]}` | Múltiplos itens com mesma escala | Máx. ~5 linhas; itens similares entre si |
| `file_upload` | `{"allowed_types": [...], "max_size_mb": 10}` | Anexos, currículos, documentos | Só quando a entrega de arquivo é o objetivo |
| `datetime` | `{"include_time": true}` | Data e/ou hora | Use com formato claro (ex.: 15/08/2026) |
| `number` | `{"min": 1, "max": 500}` | Valores numéricos (idade, quantidade, preço) | Defina min/max reais |
| `dyn_list` | `{"suggestions": [...], "placeholder": "..."}` | Lista de itens definidos pelo respondente | Útil para etapas, nomes, itens personalizados |
| `audio` (legado) | `{"max_duration_secs": 60}` | Depoimentos em áudio | Opt-in; respostas em áudio demoram mais e são caras de transcrever/analisar |

### Regras de seleção por objetivo de pesquisa

- **Medir prevalência** (quantos pensam X): `multiple_choice` única
- **Medir atitude/intensidade**: `scale` (Likert) — nunca sim/não quando a intensidade importa
- **Medir recomendação/lealdade**: `nps` (0-10), sempre com pergunta aberta de follow-up
- **Medir usabilidade percebida**: SUS — 10 perguntas `scale` fixas (ver survey-metrics)
- **Ordenar prioridades**: `ranking` (poucos itens)
- **Capturar contexto/razões**: `text_long` (1-2 no fim) ou `audio`
- **Perfis/segmentação**: `multiple_choice` demográficas no início (curtas)

## Estrutura e ordem do questionário

1. **Introdução** — objetivo ("Estamos melhorando X e queremos sua opinião"),
   tempo estimado ("~3 minutos"), anonimato se aplicável. Sem linguagem que
   sugira a resposta "certa".
2. **Perguntas de perfil/segmentação** — curtas, no início (só se a análise
   por segmento for planejada).
3. **Perguntas comportamentais** (o que o usuário faz) — antes das atitudinais.
4. **Perguntas atitudinais/satisfação** — depois do contexto comportamental.
5. **Perguntas abertas** — no fim (exigem mais esforço; não devem fadigar o
   respondente antes das questões centrais).
6. **Encerramento** — agradecimento + caminho opcional de follow-up.

## Escrita de perguntas

### Erros a evitar (viés de instrumento)

- **Leading**: "O quanto você gosta do nosso produto?" → "Como você descreveria
  sua experiência com nosso produto?"
- **Dupla** (double-barreled): "O checkout é fácil e agradável?" → dividir em duas
- **Linguagem carregada**: "O quanto você está satisfeito com nosso envio rápido?"
  → remover "rápido"
- **Sobrecarga de memória**: "Nos últimos 12 meses, quantas vezes…" → períodos curtos
- **Jargão**: usar os termos do usuário, não nomes internos de produto
- **Negação dupla** e opções sobrepostas (ex.: faixas de idade 25-30 / 30-35)
- **Forçar resposta binária** em assunto não-binário — incluir ponto médio/NA

### Fazer certo

- Uma pergunta por pergunta
- Linguagem específica e comportamental
- Opções mutuamente exclusivas e coletivamente exaustivas
- Neutro — não sugerir resposta preferida

## Escalas

### Likert (`scale`)
- 5 pontos é o padrão do Formly e mais fácil para o respondente; 7 pontos dá
  mais granularidade
- Sempre incluir ponto médio (a menos que a questão seja genuinamente binária)
- Rotular os extremos ("1 = Discordo totalmente, 5 = Concordo totalmente")
- Direção consistente em todo o questionário
- `na_option: true` quando "não se aplica" é legítimo

### NPS (`nps`)
- 0-10; Promoters 9-10, Passives 7-8, Detractors 0-6
- NPS = %Promoters − %Detractors (ver survey-metrics para cálculo e análise)
- Sempre acompanhar de pergunta aberta: "Por quê?"

## Amostragem e viés (para o briefing)

- ~385 respostas para margem de erro ±5% (95% de confiança) em população grande
- Amostra deve espelhar o perfil da população estudada
- Quem responde difere de quem não responde (viés de resposta) — reconhecer
- Manter < 5 minutos; qualidade despenca acima de 10-15 perguntas

## Validação antes de publicar

- **Piloto**: testar com 3-5 pessoas antes de enviar (pré-teste cognitivo revela
  perguntas confusas)
- Para cada pergunta: "que decisão esta pergunta vai ajudar a tomar?"
- Para cada pergunta: ela é necessária? Remover o que não muda decisão
- Verificar: opções exaustivas? Escalas rotuladas? Ordem correta (comportamental
  → atitudinal → aberta)?
- Confirmar que os tipos usados correspondem aos dados que o dashboard
  conseguirá apresentar (ver survey-metrics)

## Saída da fase

Questionário JSON Formly completo: `title` + lista de `questions`
(`type`, `title`, `required`, `config`) — pronto para salvar no builder.
