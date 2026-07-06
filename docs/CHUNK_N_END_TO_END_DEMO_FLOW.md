# Chunk N: End-To-End Demo Flow

## Purpose

This chunk makes one complete MediScribe workflow clear and demo-ready.

It does not add new AI intelligence.

It makes sure the current product flow can be shown confidently:

```txt
patient selection
  -> audio recording
  -> local STT transcript
  -> streaming LangGraph SOAP generation
  -> doctor review
  -> final save
  -> saved note display
```

## Demo Flow

### 1. Start Services

Backend:

```bash
cd server
npm run dev
```

Frontend:

```bash
cd client
npm run dev
```

STT service:

```bash
cd stt-service
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

MongoDB:

```bash
mongod
```

or Docker MongoDB:

```bash
docker run -d --name mediscribe-mongo -p 27017:27017 mongo:7
```

## Expected User Journey

```txt
1. Open frontend.
2. Select a patient.
3. Click Start.
4. Speak a short doctor-patient conversation.
5. Click Stop.
6. Click Transcribe audio.
7. Review/edit transcript.
8. Click Generate SOAP draft.
9. Watch real streamed agent progress.
10. Review/edit SOAP fields.
11. Click Mark reviewed.
12. Click Save note.
13. Confirm success toast appears.
14. Open Saved notes.
15. Confirm saved note appears with patient, MRN, timestamp, and SOAP sections.
```

## Sample Demo Conversation

Use this for recording:

```txt
Patient reports headache for two days. No fever. No vomiting. The doctor advised hydration and taking medication after meals. Patient should return if symptoms worsen.
```

Expected AI behavior:

```txt
Subjective:
Patient reports headache for two days and denies fever or vomiting.

Objective:
No objective vitals or exam findings were provided in the conversation.

Assessment:
Headache, pending physician review.

Plan:
Hydration, medication after meals, return if symptoms worsen.
```

## What Was Cleaned Up In This Chunk

### Saved Note Patient Context

Previously saved agent-approved notes used placeholders:

```txt
<PATIENT>
<ID>
```

Now approval saves real selected patient context from the agent state:

```txt
patient displayName
patient MRN
patient age
visit type
```

File:

```txt
server/src/services/agent-run.service.ts
```

### Saved Notes Page

The saved notes page now shows:

- clearer loading state
- clearer error state
- patient name
- MRN
- saved timestamp
- note status
- all four SOAP sections

File:

```txt
client/app/notes/page.tsx
```

## Success Criteria

The chunk is successful when:

```txt
doctor can complete one full note from selected patient to saved record
```

Minimum required success:

```txt
select patient
transcribe audio
generate streamed SOAP
mark reviewed
save note
see note on /notes
```

## Known Dependencies

The save step requires MongoDB.

If MongoDB is disconnected:

```txt
agent run persistence and saved notes will fail
```

For portfolio independence, use local MongoDB:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/mediscribe_ai
MONGODB_REQUIRED=false
```

## What This Chunk Does Not Include

Not included yet:

- clinical extraction
- missing-info warning engine
- ICD suggestions
- deployment
- Docker Compose
- authentication/login

Those are later chunks.

