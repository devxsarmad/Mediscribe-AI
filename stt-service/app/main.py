from fastapi import FastAPI, File, HTTPException, UploadFile

from app.config import settings
from app.transcriber import transcribe_audio_file

app = FastAPI(title="MediScribe Internal STT Service")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "mediscribe-stt",
        "model": settings.whisper_model,
        "device": settings.whisper_device,
        "computeType": settings.whisper_compute_type,
    }
@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Only audio files are allowed.")

    suffix = ""
    if audio.filename and "." in audio.filename:
        suffix = f".{audio.filename.rsplit('.', 1)[-1]}"

    try:
        return transcribe_audio_file(audio.file, suffix)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {error}",
        ) from error
