# MediScribe AI Portfolio Finish Plan

## Goal

Finish MediScribe AI as a polished portfolio project before moving to Cortex AI.

The target is not hospital production. The target is a production-shaped, demo-ready, technically credible AI healthcare project that proves:

- MERN/Next.js product engineering
- API integration
- local/private STT design
- LangGraph agent workflow
- human-in-the-loop healthcare safety
- LIS adapter architecture
- clinical documentation automation
- ICD suggestion direction

## Chunk L: Real-Time Agent Events

Priority: Highest

Goal:

Replace frontend-simulated agent loading with real backend-driven LangGraph progress events.

Tasks:

- Emit progress events from LangGraph node execution.
- Stream graph events from backend to frontend.
- Add streaming run endpoint.
- Update frontend Generate SOAP flow to consume streamed events.
- Move the compact agent activity pill using real node events.
- Keep final agent run result compatible with doctor review/save flow.

Expected result:

```txt
Doctor sees real agent progress while the backend loads context and drafts SOAP
```

Success check:

```txt
frontend activity advances from actual backend node_started/node_completed events
```

## Chunk M: Hybrid LIS Mode Cleanup

Priority: High

Status: Done

Goal:

Make real patient API + mock clinical context feel intentional, not broken.

Tasks:

- Document hybrid LIS mode.
- Keep real LIS patient lookup behind adapter.
- Keep temporary encounter generation.
- Keep empty labs/prior notes until APIs exist.
- Add optional mock fallback if real LIS token fails.
- Remove UI wording that implies unavailable real labs/notes are being used.

Expected result:

```txt
Real LIS patients + portfolio-safe mock clinical modules
```

Success check:

```txt
doctor can select real patient
agent can run without real encounter/lab/note APIs
frontend explains context clearly
```

Implementation notes:

- Added fallback metadata for real-patient hybrid mode.
- Added mock fallback when real LIS patient API is unavailable.
- Updated frontend labels to distinguish real patient source from temporary/demo clinical context.
- Updated agent activity wording to "checking" labs/prior notes instead of implying real linked data exists.
- Full explanation: [`CHUNK_M_HYBRID_LIS_MODE.md`](./CHUNK_M_HYBRID_LIS_MODE.md)

## Chunk N: End-To-End Demo Flow

Priority: High

Status: Done

Goal:

Make one clean flow work from start to finish.

Tasks:

- Select patient.
- Record audio.
- Transcribe through local STT.
- Generate SOAP through agent run.
- Show agent activity.
- Doctor edits SOAP.
- Mark reviewed.
- Save note.
- Show success toast.
- Reset workspace.
- Confirm saved note appears on saved notes page.

Expected result:

```txt
Complete demo path for portfolio recording
```

Success check:

```txt
one full encounter can be completed without manual database/API fixes
```

Implementation notes:

- Saved agent-approved notes now keep real selected patient context instead of placeholders.
- Saved notes page now shows loading/error states and all SOAP sections.
- Demo script and success criteria are documented in [`CHUNK_N_END_TO_END_DEMO_FLOW.md`](./CHUNK_N_END_TO_END_DEMO_FLOW.md).

## Chunk O: Clinical Extraction Layer

Priority: High

Goal:

Make the agent understand the encounter before writing SOAP.

Tasks:

- Add extraction service.
- Extract chief complaint.
- Extract duration.
- Extract symptoms.
- Extract denied symptoms.
- Extract medications discussed.
- Extract follow-up instructions.
- Return strict JSON.
- Show extracted facts in UI.

Expected result:

```txt
AI first understands the conversation, then writes SOAP
```

Success check:

```txt
transcript produces structured clinical facts before SOAP
```

## Chunk P: Missing Information And Safety Review

Priority: High

Goal:

Make the agent safer and more clinically believable.

Tasks:

- Detect missing vitals.
- Detect missing objective exam findings.
- Detect unclear medication name/dose.
- Detect unsupported diagnosis.
- Detect unsupported treatment plan.
- Show warnings before doctor approval.
- Store warnings in agent state/audit.

Expected result:

```txt
Doctor sees what AI is unsure about
```

Success check:

```txt
AI does not invent missing information silently
```

## Chunk Q: ICD Code Suggestions

Priority: High

Goal:

Add senior-requested coding intelligence.

Tasks:

- Add ICD suggestion service.
- Use transcript, extracted facts, SOAP, and patient context.
- Suggest top ICD candidates.
- Include code, description, confidence, evidence, and warnings.
- Require doctor/billing review.
- Do not auto-save codes.
- Show suggestions in UI after SOAP generation.

Expected result:

```txt
Agent suggests explainable ICD codes from clinical context
```

Success check:

```txt
headache/cough/etc. transcript produces relevant ICD suggestions with evidence
```

## Chunk R: Portfolio Documentation Polish

Priority: High

Goal:

Make the repository understandable to recruiters/seniors.

Tasks:

- Rewrite README for portfolio.
- Add architecture diagram.
- Add feature list.
- Add local setup commands.
- Add demo script.
- Add screenshots section.
- Add limitations section.
- Add HIPAA/compliance note.
- Add roadmap to Cortex AI later.

Expected result:

```txt
Repo explains the project without you being present
```

Success check:

```txt
someone can read README and understand why this project is impressive
```

## Chunk S: Environment And Secret Cleanup

Priority: High

Goal:

Make the project safe to share.

Tasks:

- Ensure `.env` files are ignored.
- Remove any hardcoded tokens.
- Keep only placeholders in `.env.example`.
- Add `.env.example` comments.
- Rotate any token that may have been exposed.
- Add `SECURITY_NOTES.md`.

Expected result:

```txt
No private credentials in public project files
```

Success check:

```txt
repo can be pushed publicly without leaking secrets
```

## Chunk T: Demo Mode

Priority: Medium

Goal:

Make the app usable even without paid OpenAI quota or real LIS token.

Tasks:

- Add `AI_PROVIDER=mock | openai`.
- Add mock SOAP generation.
- Add mock ICD suggestions.
- Add `LIS_ADAPTER_MODE=mock | real`.
- Add clear UI label for demo mode.

Expected result:

```txt
Project demo works even when external services are unavailable
```

Success check:

```txt
fresh clone can run a convincing demo without paid APIs
```

## Chunk U: Deployment Or Docker

Priority: Medium

Goal:

Make the project easy to run outside your machine.

Options:

- Docker Compose for backend, frontend, Mongo, STT
- or deployment docs for Vercel + Render/Railway + local STT note

Recommended first:

```txt
Docker Compose for local portfolio demo
```

Expected result:

```txt
one-command local infrastructure
```

Success check:

```txt
docker compose up starts Mongo/backend/STT/frontend or clearly documents any manual step
```

## Chunk V: CV And Portfolio Story

Priority: Medium

Goal:

Make MediScribe read strongly on CV/GitHub/LinkedIn.

Tasks:

- Write 3-4 CV bullets.
- Write GitHub project description.
- Write LinkedIn project post.
- Record demo video script.
- Prepare interview explanation.

Expected result:

```txt
Project becomes job-search material
```

Success check:

```txt
you can explain architecture, tradeoffs, AI workflow, and safety boundaries in 2 minutes
```

## Recommended Execution Order

```txt
L. Real-Time Agent Events
M. Hybrid LIS Mode Cleanup
N. End-To-End Demo Flow
O. Clinical Extraction Layer
P. Missing Information And Safety Review
Q. ICD Code Suggestions
R. Portfolio Documentation Polish
S. Environment And Secret Cleanup
T. Demo Mode
U. Deployment Or Docker
V. CV And Portfolio Story
```

## What We Should Do Next

Start with:

```txt
Chunk L: Real-Time Agent Events
```

Reason:

This makes the product feel like a real agent quickly. Runtime polish is still needed later, but the first priority is making the scribing workflow behave the way we originally envisioned.
