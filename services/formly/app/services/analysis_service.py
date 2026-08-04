"""
Formly Analysis Service (Fase 4) — análise de respostas de um questionário via LLM.

Busca o survey (título + perguntas) e as respostas (completas e parciais) no banco,
calcula estatísticas agregadas (N total, taxa de completude, distribuições, NPS),
monta um resumo estruturado dos dados e chama a LLM (via `_get_llm` de
app.services.llm_service) para produzir um relatório em Markdown com as 9 seções
definidas na skill survey-analysis, respeitando os protocolos de recusa.
"""
import json
import logging
from statistics import mean
from typing import Any

from fastapi import HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy.orm import Session, joinedload

from app.db import SessionLocal
from app.models import Answer, Question, Response, Survey
from app.services.llm_service import _get_llm

logger = logging.getLogger(__name__)

MAX_OPEN_EXCERPTS = 20
MAX_EXCERPT_CHARS = 300

OPEN_TEXT_TYPES = {"text_short", "text_long", "audio"}
CHOICE_TYPES = {"multiple_choice", "ranking", "dyn_list"}

SYSTEM_PROMPT = """Você é um analista de pesquisa sênior especializado em questionários (surveys). Você recebe um resumo estruturado (JSON) com as respostas de um questionário do Formly e deve produzir um relatório em Markdown, em português, com EXATAMENTE as 9 seções abaixo (use os títulos indicados):

## 1. Resumo Executivo
3-5 frases com os 2-3 achados centrais, um rótulo de confiança geral e a principal ressalva sobre os dados.

## 2. Auditoria de Metodologia
N total e taxa de completude; o que foi dito vs. o que foi feito; riscos de desenho (perguntas tendenciosas, duplas, opções sobrepostas). Declare explicitamente: "essas escolhas de metodologia afetam as conclusões."

## 3. Análise por Pergunta
Para cada pergunta: distribuição (contagens e %), confiança (N < 100 = direção apenas), interpretação e o que NÃO mostra. Use tabela para 5+ perguntas homogêneas; seções para tipos mistos.

## 4. Segmentação
Distribuição por segmento quando houver dados de segmentação. Flag: segmentos com N < 30 → sem afirmações confiáveis. Destaque segmentos que divergem do padrão geral.

## 5. Respostas Abertas (Clusterização Temática)
3-7 temas; por tema: 2-3 citações (APENAS das respostas reais fornecidas, nunca inventadas), contagem aproximada de menções e valência emocional. Rotule: "clusterização assistida por IA reflete os trechos fornecidos, não a contagem completa". Temas que contradizem o padrão quantitativo costumam ser o sinal mais valioso.

## 6. Validação de Hipóteses
Para cada hipótese do briefing (se houver): status SUPORTADA / CONTRADITADA / INCONCLUSIVA / NÃO TESTADA PELA PESQUISA, evidência e confiança (Alta/Média/Baixa). Se o questionário não explicitou hipóteses, declare isso e aponte quais perguntas permitiriam testá-las.

## 7. O que os Dados NÃO Mostram (Limitações)
População não representada, perguntas não respondidas, confundidores e qual próxima pesquisa fecharia a lacuna mais importante.

## 8. Recomendações Priorizadas (top 3-5)
Cada uma: recomendação, evidência, confiança, contra-evidência (se houver) e qual pesquisa adicional a fortaleceria. Ordene por impacto × confiança.

## 9. Próximos Passos
Que artefato esta análise deve gerar (atualizar PRD, disparar follow-up, agendar entrevistas) e decisões que ela pode — e não pode — informar.

## Protocolos de recusa (obrigatórios — não engula dados fracos)
1. N total < 100 para inferência geral: reporte apenas DIREÇÃO, rotule confiança como Baixa e avise para não basear decisões de capital nisso.
2. N < 30 por segmento: declare o segmento inválido para afirmações confiáveis.
3. Pergunta tendenciosa (ex.: "Você gostaria de um recurso que economiza 10h por semana?"): reporte mas flagre como VIESADO (superestimado em 20-40 pontos percentuais).
4. NPS: "NPS é métrica de tendência, não diagnóstico. Mostra o rumo, não o que fazer."
5. Causalidade a partir de survey transversal: correlação ≠ causa; causação exige experimento (A/B) ou dados longitudinais.

## Regras de honestidade
- Ser honesto sobre o que os dados NÃO mostram vale mais do que conclusões confiantes a partir de dados fracos.
- Nunca invente citações, números ou respostas: use apenas os dados fornecidos.
- Se os dados forem insuficientes para uma seção, diga isso explicitamente em vez de preencher com suposições.
- Responda APENAS com o relatório em Markdown (as 9 seções), sem texto introdutório fora do relatório."""


def _qtype(q: Question) -> str:
    return q.type.value if hasattr(q.type, "value") else q.type


def _rstatus(r: Response) -> str:
    return r.status.value if hasattr(r.status, "value") else r.status


def _answer_exists(a: Answer) -> bool:
    return any(
        v is not None
        for v in (
            a.value_text,
            a.value_choices,
            a.scale_value,
            a.transcription,
            a.audio_url,
            a.file_url,
        )
    )


def _open_text(a: Answer) -> str | None:
    """Texto livre de uma answer (value_text ou transcription)."""
    for candidate in (a.value_text, a.transcription):
        if candidate and candidate.strip():
            return candidate.strip()
    return None


def _compute_nps(values: list[int]) -> dict[str, Any]:
    """Score NPS: Promoters 9-10, Passives 7-8, Detractors 0-6."""
    total = len(values)
    if total == 0:
        return {"promoters": 0, "passives": 0, "detractors": 0, "score": None}
    promoters = sum(1 for v in values if 9 <= v <= 10)
    passives = sum(1 for v in values if 7 <= v <= 8)
    detractors = sum(1 for v in values if v <= 6)
    score = round((promoters - detractors) / total * 100)
    return {
        "promoters": promoters,
        "passives": passives,
        "detractors": detractors,
        "score": score,
    }


def _distribution(values: list[int]) -> dict[str, int]:
    return {str(v): values.count(v) for v in sorted(set(values))}


def _question_stats(q: Question, answers: list[Answer], n_responses: int) -> dict[str, Any]:
    """Calcula estatísticas agregadas para uma pergunta."""
    qtype = _qtype(q)
    answered = [a for a in answers if _answer_exists(a)]
    stats: dict[str, Any] = {
        "position": q.position,
        "type": qtype,
        "title": q.title,
        "required": q.required,
        "answered_count": len(answered),
        "unanswered_count": n_responses - len(answered),
    }

    scale_values = [a.scale_value for a in answered if a.scale_value is not None]

    if qtype == "nps" and scale_values:
        stats["nps"] = _compute_nps(scale_values)
        stats["distribution"] = _distribution(scale_values)
    elif qtype == "scale" and scale_values:
        stats["mean"] = round(mean(scale_values), 2)
        stats["distribution"] = _distribution(scale_values)
    elif qtype == "number":
        numeric: list[float] = []
        for a in answered:
            raw = a.scale_value if a.scale_value is not None else a.value_text
            if raw is None:
                continue
            try:
                numeric.append(float(raw))
            except (TypeError, ValueError):
                continue
        if numeric:
            stats["mean"] = round(mean(numeric), 2)
    elif qtype in CHOICE_TYPES:
        counts: dict[str, int] = {}
        for a in answered:
            if a.value_choices:
                for c in a.value_choices:
                    key = str(c)
                    counts[key] = counts.get(key, 0) + 1
        if counts:
            stats["choice_counts"] = dict(sorted(counts.items(), key=lambda kv: -kv[1]))

    if qtype in OPEN_TEXT_TYPES:
        excerpts: list[str] = []
        for a in answered:
            text = _open_text(a)
            if not text:
                continue
            text = " ".join(text.split())
            if len(text) > MAX_EXCERPT_CHARS:
                text = text[:MAX_EXCERPT_CHARS] + "…"
            excerpts.append(text)
        stats["text_total"] = len(excerpts)
        stats["text_excerpts"] = excerpts[:MAX_OPEN_EXCERPTS]
        if len(excerpts) > MAX_OPEN_EXCERPTS:
            stats["text_excerpts_note"] = (
                f"Amostra de {MAX_OPEN_EXCERPTS} de {len(excerpts)} trechos; os demais foram omitidos."
            )
        if qtype == "audio":
            stats["audio_clips"] = sum(1 for a in answered if a.audio_url)
            stats["with_transcription"] = sum(1 for a in answered if a.transcription)
    elif qtype == "file_upload":
        stats["files_uploaded"] = sum(1 for a in answered if a.file_url)

    return stats


def _build_summary(
    survey: Survey, questions: list[Question], responses: list[Response]
) -> dict[str, Any]:
    """Monta o resumo estruturado (JSON) enviado à LLM."""
    total = len(responses)
    complete = sum(1 for r in responses if _rstatus(r) == "complete")
    survey_status = survey.status.value if hasattr(survey.status, "value") else survey.status
    q_stats = []
    for q in questions:
        q_answers = [a for r in responses for a in r.answers if a.question_id == q.id]
        q_stats.append(_question_stats(q, q_answers, total))
    return {
        "survey": {
            "id": str(survey.id),
            "title": survey.title,
            "slug": survey.slug,
            "status": survey_status,
            "published_at": survey.published_at.isoformat() if survey.published_at else None,
        },
        "n_total": total,
        "n_complete": complete,
        "n_partial": total - complete,
        "completion_rate": round(complete / total * 100, 1) if total else 0,
        "questions": q_stats,
    }


def analyze_responses(survey_id: str, user_id: str, db: Session | None = None) -> dict:
    """
    Analisa as respostas de um questionário via LLM e retorna relatório em Markdown.

    Args:
        survey_id: ID do questionário (UUID como str).
        user_id: ID do dono do questionário (valida ownership).
        db: Sessão SQLAlchemy opcional; se None, abre uma sessão própria.

    Returns:
        dict com {"report": "<markdown com as 9 seções>"}.

    Raises:
        HTTPException 404: questionário não encontrado ou de outro usuário.
        HTTPException 400: questionário sem nenhuma resposta.
    """
    own_session = db is None
    if db is None:
        db = SessionLocal()
    try:
        survey = (
            db.query(Survey)
            .filter(Survey.id == survey_id, Survey.user_id == user_id)
            .first()
        )
        if not survey:
            raise HTTPException(status_code=404, detail="Questionário não encontrado")

        questions = sorted(survey.questions, key=lambda q: q.position)
        responses = (
            db.query(Response)
            .options(joinedload(Response.answers))
            .filter(Response.survey_id == survey_id)
            .order_by(Response.started_at)
            .all()
        )
        if not responses:
            raise HTTPException(
                status_code=400,
                detail="Este questionário ainda não tem respostas para analisar.",
            )

        summary = _build_summary(survey, questions, responses)
        human_content = (
            f"Abaixo está um resumo estruturado (JSON) das respostas do questionário "
            f"\"{survey.title}\".\n"
            "As amostras de respostas abertas podem estar truncadas. Use APENAS os "
            "trechos fornecidos como citações — nunca invente respostas.\n\n"
            + json.dumps(summary, ensure_ascii=False, indent=2)
        )

        llm = _get_llm()
        response = llm.invoke(
            [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=human_content),
            ]
        )
        report = response.content if hasattr(response, "content") else str(response)
        return {"report": str(report)}
    finally:
        if own_session:
            db.close()