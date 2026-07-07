# MediScribe AI MVP Roadmap

This roadmap keeps the build chunk-by-chunk so we always know what is done, what is next, and what belongs later.

## Current Status

- Current chunk: Post-MVP Agent Roadmap
- Last completed chunk: Chunk I - Frontend Agent Flow Integration
- MVP type: AI-powered application pipeline
- Future direction: Agentic AI healthcare assistant inside LIS/EMR

## MVP Flow

```txt
Doctor Voice
  -> Audio Recording
  -> Speech-to-Text
  -> Transcript
  -> LLM SOAP Generation
  -> Doctor Review
  -> Save to Database
```

## Chunk 1: Project Setup

Status: Done

Goal: Create the base MERN-style workspace using the selected stack.

Completed:

- Root npm workspace
- `client/` frontend folder
- `server/` backend folder
- Next.js frontend setup
- TypeScript setup
- Tailwind CSS setup
- shadcn/ui-ready config
- Express backend setup
- Backend TypeScript config
- Environment examples
- Root README

Key files:

- `package.json`
- `client/package.json`
- `client/app/page.tsx`
- `client/app/layout.tsx`
- `client/app/globals.css`
- `server/package.json`
- `server/src/index.ts`
- `README.md`

## Chunk 2: Backend Foundation

Status: Done

Goal: Build a clean backend structure before adding AI features.

Planned work:

- Add backend folder structure:
  - `src/config`
  - `src/routes`
  - `src/controllers`
  - `src/middleware`
  - `src/services`
  - `src/models`
  - `src/utils`
- Add typed environment config
- Add centralized Express app setup
- Add health route
- Add API version route prefix, for example `/api/v1`
- Add global error middleware
- Add not-found middleware
- Add MongoDB connection utility
- Add server startup flow

Completed:

- Added backend folder structure:
  - `src/config`
  - `src/routes`
  - `src/controllers`
  - `src/middleware`
  - `src/services`
  - `src/models`
  - `src/utils`
- Added typed environment config
- Added centralized Express app setup
- Added root health route
- Added `/api/v1` route prefix
- Added `/api/v1/health`
- Added global error middleware
- Added not-found middleware
- Added MongoDB connection utility
- Added async server startup flow
- Verified backend TypeScript build

Expected result:

- Backend runs cleanly
- `/health` confirms server status
- `/api/v1/health` confirms API status
- MongoDB connection logic is ready but not yet required for AI flow

## Chunk 3: Frontend Foundation

Status: Done

Goal: Build the main doctor workflow screen without real recording yet.

Planned work:

- Create dashboard-style layout
- Add main scribe workspace
- Add sections for:
  - Patient context placeholder
  - Recording panel
  - Transcript panel
  - SOAP note panel
  - Save/review actions
- Add reusable UI components
- Add frontend API client helper

Completed:

- Created dashboard-style clinical workspace
- Added patient context placeholder
- Added recording panel placeholder
- Added transcript review panel
- Added editable SOAP note panel
- Added review/save action area
- Added reusable UI components:
  - `Badge`
  - `Card`
  - `Textarea`
- Added frontend API client helper
- Updated frontend env variable to `NEXT_PUBLIC_API_BASE_URL`
- Verified Next.js production build

Expected result:

- Doctor can see the full workflow UI
- Data can still be mocked at this stage

## Chunk 4: Audio Recording

Status: Done

Goal: Record doctor-patient conversation from the browser.

Planned work:

- Add microphone permission handling
- Add start/stop recording controls
- Store audio as a browser `Blob`
- Show recording timer/status
- Prepare audio upload request

Completed:

- Added browser microphone permission handling
- Added start recording control
- Added stop recording control
- Added elapsed recording timer
- Added recording status states
- Added browser audio `Blob` storage
- Added playback preview for recorded audio
- Added captured audio size display
- Added reset recording behavior
- Prepared audio state for the upload/transcription chunk
- Verified Next.js production build

Expected result:

- Doctor can record audio in the browser
- Audio can be sent to backend in the next chunk

## Chunk 5: Speech-to-Text

Status: Done

Goal: Convert recorded audio into transcript text.

Planned work:

- Add backend audio upload endpoint
- Add `multer` file handling
- Add OpenAI Whisper transcription service
- Return transcript to frontend
- Add loading and error states

Completed:

- Added backend audio upload endpoint at `POST /api/v1/transcriptions`
- Added `multer` file handling with in-memory storage and audio validation
- Added OpenAI transcription service using configured model
- Added frontend `transcribeAudio()` API helper with multipart upload
- Added Transcribe button after recording stops
- Added loading state while transcription runs
- Added error state for failed uploads or missing API key
- Populated transcript panel from API response
- Verified Next.js production build

Expected result:

- Recorded audio becomes raw transcript text

## Chunk 6: SOAP Generation

Status: Done

Goal: Convert transcript into structured SOAP notes.

Planned work:

- Add backend SOAP generation endpoint
- Add LLM service
- Create medical documentation prompt
- Return structured JSON:
  - `subjective`
  - `objective`
  - `assessment`
  - `plan`
- Add basic validation for AI response shape

Completed:

- Added backend SOAP generation endpoint at `POST /api/v1/soap-notes`
- Added OpenAI chat completion service with medical scribe prompt
- Added JSON response validation for required SOAP fields
- Added PHI tokenization/de-identification before any LLM analysis
- Added de-identified clinical extraction output:
  - `clinicalSummary`
  - `symptoms`
  - `medications`
- Mapped AI output into physician-review SOAP fields without diagnoses or treatment advice
- Added `OPENAI_SOAP_MODEL` environment config
- Added frontend `generateSoapNote()` API helper
- Wired Generate SOAP button with loading and error states
- Populated editable SOAP fields from API response
- Verified client and server production builds

Expected result:

- Transcript becomes editable SOAP note JSON

## Chunk 7: Doctor Review UI

Status: Done

Goal: Let the doctor review and edit AI output before saving.

Planned work:

- Add editable SOAP fields
- Add transcript review area
- Add approve/save button
- Add reset/regenerate action
- Add UI states for draft, generated, reviewed, and saved

Completed:

- Kept transcript review area editable
- Kept SOAP fields editable
- Added review workflow state:
  - draft
  - generated
  - reviewed
  - ready-to-save
- Added Mark reviewed behavior
- Added review timestamp display
- Added review error/status messaging
- Gated Save note action behind doctor review
- Reset review state when transcript or SOAP fields are edited
- Preserved regenerate SOAP action through the Generate clinical note button
- Verified Next.js production build

Expected result:

- Doctor stays in control of the final note

## Chunk 8: Storage

Status: Done

Goal: Save finalized documentation to MongoDB.

Planned work:

- Add Mongoose note model
- Add save note endpoint
- Store:
  - Patient placeholder data
  - Transcript
  - SOAP note
  - Status
  - Timestamps
- Add list/retrieve endpoints for saved notes

Completed:

- Added Mongoose note model
- Added save reviewed note endpoint at `POST /api/v1/notes`
- Added saved notes list endpoint at `GET /api/v1/notes`
- Added saved note detail endpoint at `GET /api/v1/notes/:id`
- Stored patient placeholder data
- Stored transcript
- Stored SOAP note
- Stored status
- Stored review timestamp and save timestamp
- Stored source metadata:
  - audio captured
  - transcription model
  - SOAP model
- Wired frontend Save note action to backend persistence
- Added save loading, error, and saved-note ID states
- Verified backend TypeScript with `--noEmit`
- Verified Next.js production build

Expected result:

- Final reviewed SOAP notes are stored in database

## Chunk 9: Polish And MVP Readiness

Status: Done

Goal: Make the MVP usable and understandable for demo/development.

Planned work:

- Improve loading states
- Improve error messages
- Add empty states
- Add `.env` documentation
- Add API route documentation
- Add basic validation
- Add final smoke test checklist

Completed:

- Added `MVP_READINESS.md`
- Added environment setup notes
- Added API route documentation
- Added frontend demo flow
- Added MVP smoke test checklist
- Added current safety boundaries
- Added MVP completion criteria
- Updated README links
- Updated README API route summary
- Verified client and server checks

Expected result:

- MVP is ready for demo and future agentic upgrades

## Future Agentic AI Upgrade

Not part of this MVP.

Later additions:

- Patient history lookup tool
- Lab result fetching tool
- ICD/CPT code suggestions
- Prescription/follow-up suggestions
- Agent decision loop
- Tool calling
- Multi-agent clinical workflow
- LIS/EMR integration layer

## Next Move

MVP chunks are complete.

Recommended next task:

Run the full local demo with real `OPENAI_API_KEY` and `MONGODB_URI`, then continue pro-agent planning from `pro-agent.md`.
