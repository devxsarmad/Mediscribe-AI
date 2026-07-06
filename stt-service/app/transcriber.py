import os
import tempfile
from functools import lru_cache
from typing import BinaryIO

from faster_whisper import WhisperModel

from app.config import settings


@lru_cache(maxsize=1)
def get_model() -> WhisperModel:
    return WhisperModel(
        settings.whisper_model,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
    )


def transcribe_audio_file(file: BinaryIO, suffix: str) -> dict:
    model = get_model()

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(file.read())
        temp_path = temp_file.name

    try:
        segments, info = model.transcribe(temp_path, beam_size=5)
        transcript = " ".join(segment.text.strip() for segment in segments).strip()

        return {
            "transcript": transcript,
            "language": info.language,
            "durationSeconds": info.duration,
            "model": settings.whisper_model,
        }
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
