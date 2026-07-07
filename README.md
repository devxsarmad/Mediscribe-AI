# MediScribe AI

Medical Scribe AI MVP for turning doctor-patient conversations into reviewed SOAP notes that can later be saved into an LIS/EMR workflow.

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui-ready structure
- Backend: Node.js, Express.js, TypeScript
- Database: MongoDB with Mongoose
- AI services: local STT service/faster-whisper, OpenAI LLM for clinical facts, SOAP, and ICD suggestions

## Docs

Full build plan: [`ProjectOverview.md`](./docs/ProjectOverview.md)
API flow: [`API_FLOW.md`](./docs/API_FLOW.md)
MVP readiness checklist: [`MVP_READINESS.md`](./docs/MVP_READINESS.md)
Current status: [`CURRENT_STATUS.md`](./docs/CURRENT_STATUS.md)
PHI-safe AI pipeline: [`PHI_SAFE_AI_PIPELINE.md`](./docs/PHI_SAFE_AI_PIPELINE.md)
Internal STT microservice plan: [`INTERNAL_STT_MICROSERVICE_PLAN.md`](./docs/INTERNAL_STT_MICROSERVICE_PLAN.md)
Pro agent roadmap: [`pro-agent.md`](./docs/pro-agent.md)

1. Project setup
2. Backend foundation
3. Frontend foundation
4. Audio recording
5. Speech-to-text
6. SOAP generation
7. Doctor review UI
8. Storage
9. Polish and dev docs

## Project Structure

```txt
MediScribe-AI/
  package.json          Root monorepo (npm workspaces)
  package-lock.json     Single lockfile — install only from root
  node_modules/         Shared dependencies (hoisted for client + server)
  client/               Next.js app for recording, transcript review, and SOAP note editing
    app/                Next.js App Router pages and global styles
    components/ui/      shadcn/ui components
    lib/                Shared frontend utilities (e.g. cn helper)
    tailwind.config.ts  Tailwind CSS config
    components.json     shadcn/ui config
  server/               Express TypeScript API for transcription, SOAP generation, and persistence
    src/                API source code
  stt-service/          Internal Python STT service for local/private transcription
```

**Important:** This is an npm workspaces monorepo. Always run `npm install` from the project root — not inside `client/` or `server/`. That keeps one `node_modules` at the root and avoids duplicate installs.

## Local Development

Install dependencies:

```bash
npm install
```

Run both apps:

```bash
npm run dev
```

Run only the frontend:

```bash
npm run dev:client
```

Run only the backend:

```bash
npm run dev:server
```

Run internal STT service:

```bash
cd stt-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Environment

Copy the examples before running API integrations:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

The first working version will use a fixed pipeline:

```txt
Audio recording -> STT -> transcript -> LLM -> SOAP JSON -> doctor review -> database
```

## UI Flow

```txt
Start
  -> Stop
  -> Transcribe audio
  -> Generate clinical note
  -> Mark reviewed
  -> Save note
```

## API Routes

```txt
GET  /health
GET  /api/v1/health
POST /api/v1/transcriptions
POST /api/v1/soap-notes
POST /api/v1/notes
GET  /api/v1/notes
GET  /api/v1/notes/:id
```
# Mediscribe-AI
