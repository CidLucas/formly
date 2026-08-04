"""
Formly LLM Service — wrapper sobre blu_llm_service para uso específico do Formly.

Usa DeepSeek Flash (via blu_llm_service) para:
- Gerar esqueleto de questionário a partir de descrição do usuário
- Refinar questionário via chat de ajuste
- (Fase 4) Analisar respostas e gerar insights
"""
import json
import logging
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

BUILDER_SYSTEM_PROMPT = """Você é um assistente especializado em criar questionários profissionais.

Seu trabalho é gerar um questionário estruturado baseado na descrição do usuário.

Regras:
1. Gere entre 3 e 15 perguntas, conforme solicitado
2. Use tipos variados: text_short, text_long, multiple_choice, scale, nps, ranking, matrix, file_upload, datetime, number, dyn_list
3. Para múltipla escolha, sempre sugira opções relevantes
4. Para escala, use 1-5 como padrão
5. Perguntas de áudio são opcionais — só inclua se o usuário pedir ou fizer sentido; nesse caso use text_long com "audio_enabled": true ou o tipo legado audio (depoimentos)
6. Toda pergunta deve ser clara, objetiva e em português

Responda APENAS com JSON no formato:
{
  "title": "Título do questionário",
  "questions": [
    {
      "type": "text_short|text_long|multiple_choice|audio|scale|nps|ranking|matrix|file_upload|datetime|number|dyn_list",
      "title": "Texto da pergunta",
      "required": true|false,
      "config": {
        // type-specific config
      }
    }
  ]
}

Config por tipo:
- text_short: {"max_chars": 500, "placeholder": "..."}
- text_long: {"max_chars": 400, "placeholder": "...", "audio_enabled": true} — audio_enabled true quando fizer sentido
- multiple_choice: {"options": ["Opção A", "Opção B"], "multiple": false}
- audio: {"max_duration_secs": 60, "follow_up_enabled": false}
- scale: {"min": 1, "max": 5, "labels": ["Discordo", "Concordo"], "na_option": true}
- nps: {"min": 0, "max": 10}
- ranking: {"options": ["Item A", "Item B", ...]}
- matrix: {"rows": ["Linha 1", ...], "columns": ["Ruim", "Bom", "Ótimo"]}
- file_upload: {"allowed_types": ["pdf", "docx", "png"], "max_size_mb": 10}
- datetime: {"include_time": true}
- number: {"min": 1, "max": 500}
- dyn_list: {"suggestions": ["Sugestão 1", ...], "placeholder": "Nome do item"}
"""

REFINEMENT_SYSTEM_PROMPT = """Você é um assistente que ajuda a refinar questionários existentes.

O usuário vai pedir ajustes em um questionário já criado. Você deve:
1. Entender o que ele quer mudar
2. Sugerir a alteração específica (qual pergunta, qual campo)
3. Manter o tom profissional e útil

Contexto do questionário atual será fornecido como JSON.

Responda com uma sugestão clara e acionável. Se a alteração for trivial (ex: "troca o texto da pergunta 3"), apenas confirme e descreva a mudança."""


def _get_llm() -> BaseChatModel:
    """Retorna cliente DeepSeek Flash via blu_llm_service."""
    try:
        from blu_llm_service.client import get_model, LLMProvider, ModelTier
        return get_model(
            provider=LLMProvider.DEEPSEEK,
            model_name="deepseek-v4-flash",
            temperature=0.7,
        )
    except ImportError:
        logger.warning("blu_llm_service não disponível, usando fallback")
        raise


def generate_survey_skeleton(description: str) -> dict[str, Any]:
    """
    Gera esqueleto de questionário a partir de descrição em texto livre.

    Args:
        description: Descrição do que o usuário quer (ex: "pesquisa de clima com 5 perguntas")

    Returns:
        dict com 'title' e 'questions' (lista de perguntas com type, title, required, config)
    """
    llm = _get_llm()
    messages = [
        SystemMessage(content=BUILDER_SYSTEM_PROMPT),
        HumanMessage(content=description),
    ]
    response = llm.invoke(messages)
    content = response.content if hasattr(response, 'content') else str(response)

    # Extrai JSON da resposta (pode vir com markdown ```json ... ```)
    content = content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    return json.loads(content)


def chat_refinement(survey_json: dict, user_message: str) -> str:
    """
    Refina questionário existente baseado em mensagem do usuário.

    Args:
        survey_json: Questionário atual como dict
        user_message: O que o usuário quer mudar

    Returns:
        Resposta do assistente com a sugestão de alteração
    """
    llm = _get_llm()
    context = json.dumps(survey_json, indent=2, ensure_ascii=False)
    messages = [
        SystemMessage(content=REFINEMENT_SYSTEM_PROMPT),
        HumanMessage(content=f"Questionário atual:\n{context}\n\nPedido do usuário: {user_message}"),
    ]
    response = llm.invoke(messages)
    return response.content if hasattr(response, 'content') else str(response)


def generate_refinement_questions(description: str) -> list[str]:
    """
    Gera perguntas de refinamento (etapa 2 do builder).

    Args:
        description: Descrição inicial do usuário

    Returns:
        Lista com 1-2 perguntas para afinar o escopo
    """
    llm = _get_llm()
    messages = [
        SystemMessage(content="""Você é um assistente que ajuda a refinar briefings de questionários.
Baseado na descrição do usuário, faça 1-2 perguntas curtas para afinar o escopo antes de gerar o questionário.
Foque em: público-alvo, número de perguntas, se quer áudio, tom da pesquisa.
Responda APENAS com as perguntas, uma por linha, sem numeração."""),
        HumanMessage(content=description),
    ]
    response = llm.invoke(messages)
    content = response.content if hasattr(response, 'content') else str(response)
    return [q.strip("- ").strip() for q in content.strip().split("\n") if q.strip()]
