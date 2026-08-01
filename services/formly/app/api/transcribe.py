import os
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from groq import Groq

router = APIRouter()

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

@router.post("")
async def transcribe(
    file: UploadFile | None = File(None),
    language: str = Form("pt"),
):
    """Transcreve áudio (webm/mp3/ogg/wav) usando Whisper via Groq."""
    if file is None or not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo de áudio é obrigatório (campo 'file')")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Arquivo muito grande (máx. 25MB)")

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY não configurada no servidor")

    filename = file.filename or "audio.webm"
    mimetype = file.content_type or "audio/webm"

    client = Groq(api_key=api_key)
    try:
        transcription = client.audio.transcriptions.create(
            model="whisper-large-v3-turbo",
            file=(filename, file_bytes, mimetype),
            language=language,
        )
    except Exception:
        raise HTTPException(status_code=502, detail="Falha ao transcrever o áudio. Tente novamente.")

    result = {"text": transcription.text}
    duration = getattr(transcription, "duration", None)
    if duration is not None:
        result["duration_secs"] = duration
    return result
