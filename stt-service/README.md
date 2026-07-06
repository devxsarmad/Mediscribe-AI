# MediScribe Internal STT Service

Private speech-to-text microservice for MediScribe AI.

This service is designed to run inside controlled infrastructure so raw patient audio does not need to leave our environment before transcription.

## Stack

- Python
- FastAPI
- faster-whisper

## Setup

Create a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run service:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Environment

Optional variables:

```txt
WHISPER_MODEL=base
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
```

For GPU deployments:

```txt
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
```

## Endpoints

```txt
GET  /health
POST /transcribe
```

`POST /transcribe` expects multipart form data:

```txt
audio=<file>
```

Response:

```json
{
  "transcript": "Patient reports fever and cough.",
  "language": "en",
  "durationSeconds": 12.4,
  "model": "base"
}
```

## Node Backend Config

In `server/.env`:

```txt
STT_PROVIDER=local
LOCAL_STT_URL=http://localhost:8001
```
