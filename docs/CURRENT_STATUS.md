# MediScribe AI Current Status

## Current Position

MediScribe AI is no longer just a basic MVP. It is now a healthcare AI scribe prototype with an agent-style backend architecture.

The goal from here is to finish it as a portfolio-ready project that can run independently without relying on private company database access.

## What Works Now

### Frontend

- Next.js app
- TypeScript
- Tailwind UI
- Doctor workspace UI
- Audio recording
- Transcript review
- SOAP review/edit fields
- Doctor approval actions
- Saved notes page
- Agent activity UI driven by backend stream events
- Real LIS patient selector

### Backend

- Express.js with TypeScript
- REST API structure
- Local STT integration
- SOAP generation service
- MongoDB persistence layer
- Agent run persistence layer
- Audit trail model/service
- Controlled agent tool layer
- LangGraph clinical agent workflow
- Human approval checkpoint
- LIS adapter architecture
- Streaming LangGraph progress events

### STT Service

- FastAPI internal STT microservice
- Faster Whisper transcription
- Runs locally on port `8001`
- Keeps raw patient audio away from external STT APIs

### LIS Integration

Current real LIS integration:

```txt
Real LIS dev API
  -> patient list
  -> selected patient context
```

Current hybrid mode:

```txt
Real LIS patients
Mock/temporary encounter
Empty labs
Empty prior notes
MongoDB save for portfolio
```

This is intentional for portfolio because we do not have access to private LIS database or full internal APIs.

The app now labels this mode explicitly:

```txt
Real LIS patient
Draft encounter context
```

If the real LIS patient API is unavailable, the backend can fall back to mock patients when:

```txt
LIS_REAL_PATIENT_FALLBACK_TO_MOCK=true
```

## What Is Not Available

We do not have direct company LIS database access.

We also do not currently have confirmed real API contracts for:

- encounters
- labs
- prior notes
- save note back to LIS
- ICD/CPT reference endpoints

This is acceptable. The project should present itself as an API-first LIS adapter architecture with partial real dev API integration.

## Correct Portfolio Positioning

Use this wording:

```txt
MediScribe AI is a production-shaped medical scribing agent prototype built with Next.js, Express, MongoDB, local STT, OpenAI, and LangGraph. It integrates with a real dev LIS patient API through an adapter layer while mocking unavailable clinical modules behind the same contract.
```

## Current Runtime Dependency Direction

For portfolio independence:

```txt
Frontend: local Next.js
Backend: local Express API
STT: local FastAPI/Faster Whisper
Database: local MongoDB or Docker MongoDB
AI: OpenAI API key when available
LIS: real dev patient API if token works, fallback mock mode if not
```

## Immediate Problem To Solve

MongoDB Atlas is no longer reliable because IP access can fail.

Recommended portfolio setup:

```txt
Use local MongoDB or Docker MongoDB
```

This removes dependency on company or Atlas network access.

## Current Flow Target

```txt
Select LIS patient
  -> record audio
  -> local STT transcript
  -> clinical agent run
  -> stream backend agent progress
  -> load selected patient context
  -> generate SOAP draft
  -> doctor edits/reviews
  -> approve run
  -> save final note to MongoDB
  -> audit events stored
```

## Current Status Label

```txt
Post-MVP, portfolio productionization phase
```
