# Post-MVP Agent Roadmap: LangGraph, LIS Tools, And Vector DB

## Purpose

This document describes how MediScribe AI should evolve after the MVP from an AI-powered documentation helper into a controlled LIS-integrated medical AI agent.

The goal is not to create a free-form chatbot. The goal is to build a safe clinical workflow agent that can use approved LIS tools, gather context, generate drafts, and keep the doctor in control.

## Current State After MVP

Current system:

```txt
Audio recording
  -> internal/private STT
  -> transcript
  -> PHI de-identification/tokenization
  -> LLM SOAP generation
  -> doctor review
  -> save note
```

This is still an AI pipeline.

It is useful, but not fully agentic because the system does not yet:

- Decide what context is required.
- Fetch patient history.
- Fetch lab results.
- Search prior notes.
- Ask follow-up questions.
- Use LIS tools.
- Maintain a multi-step workflow state.
- Decide whether doctor approval is required before an action.

## Target Agentic Vision

Future goal:

```txt
Doctor goal:
"Prepare today's encounter note for this patient."

Agent:
  -> checks patient context
  -> checks active encounter
  -> retrieves relevant labs
  -> retrieves previous notes
  -> uses current transcript
  -> drafts SOAP note
  -> identifies missing information
  -> asks doctor for confirmation
  -> saves draft/final note only after approval
```

## Why LangGraph Instead Of Plain LangChain

For healthcare, we need predictable workflow states.

Plain LangChain is useful for chains/tools, but medical workflows need:

- explicit state
- controlled transitions
- human approval checkpoints
- tool-call boundaries
- retry/error paths
- auditability

LangGraph is a better fit because it lets us model the agent as a graph/state machine.

Example:

```txt
START
  -> load_patient_context
  -> load_encounter_context
  -> load_labs
  -> load_prior_notes
  -> generate_note
  -> safety_review
  -> doctor_review
  -> save_note
  -> END
```

## LangGraph Features We Plan To Use

### 1. StateGraph

Use LangGraph `StateGraph` to define the clinical workflow.

Example state:

```ts
type ClinicalAgentState = {
  goal: string;
  patientId: string;
  encounterId: string;
  transcript?: string;
  patientContext?: PatientContext;
  encounterContext?: EncounterContext;
  labs?: LabResult[];
  priorNotes?: PriorNote[];
  generatedSoap?: SoapNote;
  missingInformation?: string[];
  requiresDoctorApproval: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  auditEvents: AgentAuditEvent[];
};
```

### 2. Nodes

Each step becomes a node.

Planned nodes:

```txt
load_patient_context
load_encounter_context
load_recent_labs
load_prior_notes
prepare_context
generate_soap_note
detect_missing_information
safety_review
wait_for_doctor_approval
save_reviewed_note
```

### 3. Conditional Edges

Use conditional routing for safe workflow decisions.

Examples:

```txt
If no active encounter:
  -> ask_doctor_or_stop

If labs unavailable:
  -> continue_without_labs

If missing information found:
  -> doctor_clarification_required

If doctor approval is not complete:
  -> do_not_save

If doctor approves:
  -> save_reviewed_note
```

### 4. Tool Calling

The agent should only call approved backend tools.

Tools should be wrappers around our LIS adapter layer.

Examples:

```ts
getPatientContext(patientId)
getActiveEncounter(encounterId)
getRecentLabResults(patientId)
getPreviousNotes(patientId)
saveDraftNote(encounterId, note)
```

The agent should not directly query MongoDB or the LIS database.

### 5. Human Interrupt / Approval

LangGraph supports pausing a graph for human input.

We should use this for doctor approval.

Flow:

```txt
generate SOAP draft
  -> safety review
  -> pause for doctor review
  -> doctor edits/approves
  -> resume graph
  -> save note
```

This is critical for healthcare.

### 6. Checkpointing

We should use checkpointing so the workflow can resume.

Use cases:

- doctor closes browser
- network disconnects
- agent waits for approval
- LIS API temporarily fails

Possible checkpoint storage:

```txt
MongoDB
```

The graph state can be stored with:

- patient ID
- encounter ID
- current node
- generated note
- approval status
- audit events

### 7. Audit Trail

Every node/tool/action should create an audit event.

Audit event example:

```json
{
  "timestamp": "2026-06-29T10:00:00.000Z",
  "node": "load_recent_labs",
  "tool": "getRecentLabResults",
  "status": "success",
  "patientId": "P123",
  "encounterId": "E456"
}
```

This is important for healthcare, LIS integration, and debugging.

## Post-MVP Roadmap Chunks

### Chunk A: MVP Stabilization

Goal:

Make the current MVP reliable for internal demo.

Tasks:

- Run full local flow.
- Improve error messages.
- Add saved notes list UI.
- Confirm local STT service works.
- Confirm PHI tokenization before SOAP generation.
- Confirm MongoDB save/retrieve.

Output:

```txt
Stable AI scribe MVP
```

### Chunk B: Mock LIS API Layer

Status: Done

Goal:

Create mock LIS endpoints before touching real LIS.

Endpoints:

```txt
GET /api/v1/lis/patients/:patientId
GET /api/v1/lis/encounters/:encounterId
GET /api/v1/lis/patients/:patientId/labs
GET /api/v1/lis/patients/:patientId/notes
```

Output:

```txt
Agent can use fake LIS data safely
```

Implemented:

- `GET /api/v1/lis/patients`
- `GET /api/v1/lis/patients/:patientId`
- `GET /api/v1/lis/encounters/:encounterId`
- `GET /api/v1/lis/patients/:patientId/labs`
- `GET /api/v1/lis/patients/:patientId/notes`
- Mock LIS contract documentation in `docs/MOCK_LIS_API_LAYER.md`

### Chunk C: Tool Layer

Status: Done

Goal:

Create controlled tools around LIS access.

Tools:

```txt
getPatientContext
getEncounterContext
getRecentLabs
getPriorNotes
saveDraftNote
```

Current implementation:

```txt
getPatientContext
getEncounterContext
getRecentLabs
getPriorNotes
```

`saveDraftNote` is intentionally deferred until the agent approval/checkpointing flow is designed.

Output:

```txt
Approved tool registry for future agent
```

Implemented:

- Internal agent tool registry
- Tool result wrapper with audit event shape
- Developer test endpoints:
  - `GET /api/v1/agent-tools`
  - `POST /api/v1/agent-tools/:toolName/run`
- Tool layer documentation in `docs/AGENT_TOOL_LAYER.md`

### Chunk D: LangGraph Agent Skeleton

Status: Done

Goal:

Create basic graph workflow.

Initial graph:

```txt
START
  -> load_patient_context
  -> load_encounter_context
  -> generate_note
  -> doctor_review_required
  -> END
```

Output:

```txt
Agent workflow exists, but still simple
```

Implemented:

- Clinical agent state type
- Deterministic graph-shaped workflow service
- Approved tool calls for patient, encounter, labs, and prior notes
- Prepared context bundle
- Tool audit events stored in returned state
- Doctor-review-required stop status
- `POST /api/v1/clinical-agent/run`
- Skeleton documentation in `docs/CLINICAL_AGENT_SKELETON.md`
- Real `@langchain/langgraph` `StateGraph` implementation

Note:

The current LangGraph is intentionally deterministic. Dynamic LLM-based routing should come later after safety, approval, and audit boundaries are stronger.

### Chunk E: Context-Aware Agent

Status: Done

Goal:

Agent uses LIS context.

Add nodes:

```txt
load_recent_labs
load_prior_notes
prepare_context
detect_missing_information
generate_context_aware_soap
```

Output:

```txt
Agent generates better notes using patient context
```

Implemented:

- Context-aware SOAP generation node inside LangGraph
- Minimized LIS context passed to the LLM
- Conditional routing after `prepare_context`:
  - transcript present -> `generate_context_aware_soap`
  - transcript missing -> `doctor_clarification_required`
- Graph still stops before final save and requires doctor review
- `POST /api/v1/clinical-agent/run` now returns `generatedSoap` when transcript is present

### Chunk F: Human Approval And Checkpointing

Status: Done

Goal:

Pause/resume agent workflow around doctor review.

Tasks:

- Save graph state.
- Add approval status.
- Resume after doctor action.
- Save only after approval.

Output:

```txt
Human-in-the-loop clinical agent
```

Implemented:

- `AgentRun` MongoDB model for persisted graph state
- `POST /api/v1/clinical-agent/runs`
- `GET /api/v1/clinical-agent/runs/:runId`
- `POST /api/v1/clinical-agent/runs/:runId/approve`
- Save final note only after approval
- Link saved note ID back to the agent run
- Documentation in `docs/HUMAN_APPROVAL_CHECKPOINTING.md`

### Chunk G: Audit Trail

Status: Done

Goal:

Log every agent decision and tool call.

Tasks:

- Add agent audit model.
- Log graph nodes.
- Log tool calls.
- Log doctor approval.
- Log final save.

Output:

```txt
Auditable healthcare agent workflow
```

Implemented:

- `AgentAudit` MongoDB model
- Persistent audit events for run creation, tool calls, graph completion, doctor review requirement, approval, and note save
- `GET /api/v1/clinical-agent/runs/:runId/audit`
- Documentation in `docs/AGENT_AUDIT_TRAIL.md`

### Chunk H: LIS Adapter Boundary

Status: Done

Goal:

Create the adapter boundary where real LIS integration can plug in later.

Adapters:

```txt
lis-adapter.types.ts
mock-lis.adapter.ts
real-lis.adapter.ts
index.ts
```

Output:

```txt
Agent tools depend on a LIS adapter interface instead of mock data directly
```

Implemented:

- `LisAdapter` interface
- `mockLisAdapter`
- guarded `realLisAdapter` placeholder
- `LIS_ADAPTER_MODE=mock | real`
- adapter resolver used by LIS service
- documentation in `docs/LIS_ADAPTER_BOUNDARY.md`

Real LIS integration is still pending real API contracts, auth, credentials, and security approval.

### Chunk I: Frontend Agent Flow Integration

Status: Done

Goal:

Connect the doctor workspace UI to the persisted LangGraph agent run lifecycle.

Flow:

```txt
Doctor records audio
  -> local STT creates transcript
  -> frontend creates clinical agent run
  -> LangGraph loads LIS context and drafts SOAP
  -> doctor edits and marks reviewed
  -> frontend approves the same run
  -> backend saves final note and keeps audit/checkpoint trail
```

Implemented:

- Frontend API helpers for:
  - `POST /api/v1/clinical-agent/runs`
  - `GET /api/v1/clinical-agent/runs/:runId`
  - `POST /api/v1/clinical-agent/runs/:runId/approve`
- Generate SOAP action now creates a persisted clinical agent run
- Save note action now approves that run instead of directly saving a note
- Edited doctor SOAP content is sent as the approved final note
- Workspace resets after successful save and shows a success toast

Why this matters:

The UI now follows the same human-in-the-loop agent boundary as the backend. The doctor is still in control, but every generated draft, approval, save, and audit event belongs to one traceable agent run.

## Vector DB: Do We Need It?

Yes, but not immediately.

Structured LIS data should come from normal APIs first.

Examples:

```txt
patient demographics -> LIS patient API
recent lab results -> LIS lab API
current encounter -> LIS encounter API
```

A vector DB becomes useful when we need semantic search over unstructured or long-form data.

## Vector DB Use Cases

### 1. Search Prior Clinical Notes

Use case:

Doctor wants context from previous visits.

Flow:

```txt
prior notes
  -> chunk notes
  -> embed chunks
  -> store in vector DB
  -> agent searches relevant prior context
  -> include retrieved snippets in note generation
```

Example query:

```txt
"previous respiratory complaints and treatments"
```

### 2. Search Lab Report History

Use case:

Find relevant historical lab interpretations.

Example:

```txt
"recent abnormal CBC trends"
```

### 3. Search Doctor Templates

Use case:

Doctors have preferred note styles/templates.

Vector DB can retrieve:

- SOAP templates
- specialty templates
- doctor-specific phrasing
- LIS report templates

### 4. Search SOPs And Clinical Protocols

Use case:

Retrieve internal workflow guidance.

Examples:

- lab workflow SOPs
- specimen handling instructions
- reporting guidelines
- LIS module documentation

### 5. Search ICD/CPT Reference Content

Use case:

Support coding suggestions.

Important:

Coding suggestions must remain doctor/biller-reviewable.

## Recommended Vector DB Options

### Option 1: MongoDB Atlas Vector Search

Best if we continue using MongoDB Atlas.

Pros:

- Same database vendor.
- Easier operational setup.
- Good for MVP-to-production transition.

Cons:

- Atlas dependency.
- Needs privacy/compliance review for production PHI.

### Option 2: Qdrant

Good for private/on-prem deployments.

Pros:

- Open-source.
- Can run locally/private.
- Good performance.

Cons:

- Extra service to deploy.

### Option 3: pgvector

Good if company already uses PostgreSQL.

Pros:

- Simple if Postgres exists.

Cons:

- Less aligned if our app data remains MongoDB.

## Recommended Vector DB Choice

For LIS/privacy direction:

```txt
Qdrant for private/on-prem deployments
```

For fast internal prototype:

```txt
MongoDB Atlas Vector Search
```

## Future Flow With Vector DB

```txt
Doctor starts encounter
  -> agent gets patient/encounter from LIS tools
  -> agent searches vector DB for relevant prior notes/templates
  -> agent gets recent labs from LIS tools
  -> agent combines current transcript + retrieved context
  -> agent generates SOAP draft
  -> safety review
  -> doctor approval
  -> save to LIS
```

## Important Safety Rules For Vector Retrieval

Retrieved context must:

- belong to the same patient or permitted population
- respect user role permissions
- be cited internally in audit logs
- not override current doctor review
- not be treated as guaranteed truth without source metadata

The agent should know:

```txt
retrieved context is supporting evidence, not final clinical decision
```

## Recommended Order

Do not start with vector DB.

Recommended order:

```txt
1. Stabilize MVP
2. Mock LIS API layer
3. Tool layer
4. LangGraph agent skeleton
5. Human approval/checkpointing
6. Audit trail
7. Real LIS adapter
8. Vector DB for prior notes/templates
```

## Final Target Architecture

```txt
Next.js UI
  -> Node/Express API
  -> LangGraph Clinical Agent
  -> Tool Registry
  -> LIS Adapters
  -> MongoDB Audit/State
  -> Vector DB Retrieval
  -> Local STT
  -> PHI Tokenization
  -> LLM
  -> Doctor Approval
  -> LIS Save
```

This is how we move from an AI documentation helper to a controlled, auditable LIS-integrated medical AI agent.
