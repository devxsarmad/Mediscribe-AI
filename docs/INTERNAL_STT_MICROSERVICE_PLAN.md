# Internal STT Microservice Plan

## Goal

Move audio transcription into our own controlled infrastructure so raw patient audio does not need to go directly to an external STT API.

## Target Flow

```txt
Browser audio
  -> Node/Express backend
  -> Internal STT service
  -> raw transcript inside our infrastructure
  -> PHI de-identification/tokenization
  -> LLM receives de-identified transcript only
  -> SOAP draft
  -> doctor review
  -> save to MongoDB / future LIS
```

## Implemented Now

Node backend can switch STT providers by env:

```txt
STT_PROVIDER=local
LOCAL_STT_URL=http://localhost:8001
```

Implemented files:

```txt
server/src/services/local-stt.service.ts
server/src/services/transcription.service.ts
server/src/config/env.ts
server/.env.example
```

Internal STT service scaffold:

```txt
stt-service/
  app/main.py
  app/transcriber.py
  app/config.py
  requirements.txt
  README.md
```

## Internal STT API

```txt
GET  /health
POST /transcribe
```

`POST /transcribe` expects:

```txt
multipart/form-data
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

## Run STT Service

```bash
cd stt-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Run Node Backend With Local STT

In `server/.env`:

```txt
STT_PROVIDER=local
LOCAL_STT_URL=http://localhost:8001
```

Then:

```bash
npm run dev:server
```

## Remaining Production Work

- Dockerize STT service.
- Add auth between Node backend and STT service.
- Add request size limits and timeout policy.
- Add temp file cleanup monitoring.
- Add PHI token map encrypted persistence.
- Replace demo patient context with LIS encounter context.
- Add deployment plan for CPU/GPU infrastructure.
