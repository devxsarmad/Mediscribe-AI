# MediScribe AI MVP Readiness

This document is the final developer/demo checklist for the current MVP.

## Current MVP Flow

```txt
Start recording
  -> Stop recording
  -> Transcribe audio
  -> Review/edit transcript
  -> Generate clinical note
  -> Review/edit SOAP note
  -> Mark reviewed
  -> Save note
```

## Environment Setup

Create frontend env:

```bash
cp client/.env.example client/.env
```

Required frontend variable:

```txt
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Create backend env:

```bash
cp server/.env.example server/.env
```

Required backend variables:

```txt
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/mediscribe_ai?retryWrites=true&w=majority
OPENAI_API_KEY=replace-with-your-openai-api-key
OPENAI_TRANSCRIPTION_MODEL=whisper-1
OPENAI_SOAP_MODEL=gpt-4o-mini
```

Notes:

- `OPENAI_API_KEY` is required for transcription and SOAP generation.
- `MONGODB_URI` is required for saving reviewed notes.
- Browser microphone access usually requires `localhost` or HTTPS.

## Run Locally

Install dependencies from the project root:

```bash
npm install
```

Run backend:

```bash
npm run dev:server
```

Run frontend:

```bash
npm run dev:client
```

Or run both:

```bash
npm run dev
```

## API Routes

### Health

```txt
GET /health
GET /api/v1/health
```

Purpose:

- Confirm backend server is running.

### Transcription

```txt
POST /api/v1/transcriptions
```

Request:

- `multipart/form-data`
- field name: `audio`
- file type: audio

Response:

```json
{
  "transcript": "Patient reports fever and cough...",
  "model": "whisper-1",
  "source": {
    "filename": "recording.webm",
    "mimeType": "audio/webm",
    "size": 12345
  }
}
```

### SOAP Generation

```txt
POST /api/v1/soap-notes
```

Request:

```json
{
  "transcript": "Patient reports fever and cough for three days.",
  "phiContext": {
    "names": ["Example Patient"],
    "ids": ["MS-10294"],
    "ages": ["34"]
  }
}
```

Response:

```json
{
  "clinical": {
    "clinicalSummary": "",
    "symptoms": [],
    "medications": []
  },
  "soap": {
    "subjective": "",
    "objective": "",
    "assessment": "",
    "plan": ""
  },
  "sanitizedTranscript": "",
  "deidentifiedTranscript": "",
  "phiTokens": [],
  "model": "gpt-4o-mini"
}
```

### Notes Storage

```txt
POST /api/v1/notes
GET  /api/v1/notes
GET  /api/v1/notes/:id
```

Purpose:

- Save reviewed notes.
- List saved notes.
- Retrieve one saved note.

Save request:

```json
{
  "patientContext": {
    "patientLabel": "<PATIENT>",
    "mrnLabel": "<ID>",
    "ageRange": "30-39",
    "visitType": "Primary care"
  },
  "transcript": "Conversation transcript",
  "soap": {
    "subjective": "",
    "objective": "",
    "assessment": "",
    "plan": ""
  },
  "reviewedAt": "2026-06-23T10:00:00.000Z",
  "source": {
    "audioCaptured": true,
    "transcriptionModel": "whisper-1",
    "soapModel": "gpt-4o-mini"
  }
}
```

## MVP Smoke Test

Use this checklist before demo:

1. Start backend with `npm run dev:server`.
2. Start frontend with `npm run dev:client`.
3. Open frontend URL in browser.
4. Click `Start`.
5. Allow microphone permission.
6. Speak a short test sentence.
7. Click `Stop`.
8. Confirm audio playback appears.
9. Click `Transcribe audio`.
10. Confirm transcript appears.
11. Edit transcript if needed.
12. Click `Generate clinical note`.
13. Confirm SOAP fields populate.
14. Edit SOAP note if needed.
15. Click `Mark reviewed`.
16. Confirm review timestamp appears.
17. Click `Save note`.
18. Confirm saved note ID appears.
19. Confirm note exists in MongoDB.

## Current Safety Boundaries

The MVP intentionally keeps doctor review mandatory.

Current guardrails:

- PHI tokenization/de-identification before SOAP generation.
- AI does not directly finalize notes.
- Save is gated behind doctor review.
- SOAP output remains editable.
- Backend rejects missing transcript/SOAP input.

Current limitations:

- No authentication yet.
- No role-based access control yet.
- No production audit trail yet.
- No LIS patient lookup yet.
- No real patient/encounter IDs yet.
- No ICD/CPT suggestions yet.
- No agentic tool calling yet.

## MVP Completion Criteria

The MVP is complete when:

- Audio records successfully.
- Audio transcribes successfully.
- Transcript generates SOAP note.
- Doctor can edit transcript and SOAP note.
- Doctor can mark note reviewed.
- Reviewed note saves to MongoDB.
- Saved note can be retrieved through API.
- Project docs explain setup and demo flow.

## After MVP

Next phase should move toward LIS integration:

```txt
Mock LIS tools
  -> Patient lookup
  -> Lab result lookup
  -> Prior notes lookup
  -> Agent orchestrator
  -> Human approval gate
  -> Real LIS adapters
```
