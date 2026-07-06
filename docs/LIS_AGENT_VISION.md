# MediScribe AI: MVP Status And LIS Agent Vision

## Purpose

This document explains where the MediScribe AI project currently stands and what is required to evolve it into a full AI agent integrated with our own LIS/EMR workflows.

The current system is a practical MVP for AI-assisted medical documentation. The long-term vision is to convert it into an agentic healthcare assistant that can safely use LIS tools, patient context, lab data, and doctor approval workflows.

## Current MVP Status

The current project is an AI-powered medical scribe pipeline.

Current flow:

```txt
Doctor voice
  -> Browser audio recording
  -> Backend transcription endpoint
  -> OpenAI Whisper/STT model
  -> Transcript
  -> LLM SOAP generation
  -> Doctor review UI
```

Current backend endpoints:

```txt
GET  /health
GET  /api/v1/health
POST /api/v1/transcriptions
POST /api/v1/soap-notes
```

Current capabilities:

- Record doctor-patient conversation from the browser.
- Send recorded audio to backend.
- Convert audio to text using OpenAI speech-to-text.
- Generate structured clinical documentation from transcript.
- Produce editable SOAP sections:
  - Subjective
  - Objective
  - Assessment
  - Plan
- Sanitize known PHI before LLM processing.
- Keep the doctor in the review loop.

Important note:

The current system is not yet an AI agent. It is a fixed AI pipeline.

## Why Current MVP Is Not Yet An Agent

The current system follows a fixed path:

```txt
Audio -> Transcript -> SOAP Note -> Doctor Review
```

It does not yet:

- Decide what information it needs.
- Call LIS tools.
- Look up patient history.
- Fetch lab results.
- Compare current symptoms with previous visits.
- Ask follow-up questions.
- Decide between multiple workflow paths.
- Maintain a multi-step reasoning loop.

An agent requires decision-making plus controlled tool usage.

## Target Agentic Vision

Future agent flow:

```txt
Doctor opens patient encounter
  -> Agent receives goal
  -> Agent checks patient context
  -> Agent fetches relevant LIS data
  -> Agent listens/transcribes conversation
  -> Agent generates note
  -> Agent checks missing clinical details
  -> Agent suggests coding/follow-up
  -> Doctor reviews and approves
  -> Agent saves final draft into LIS/EMR
```

Example agent goal:

```txt
Prepare today's clinical note for this patient encounter.
```

The agent should then decide which tools are needed:

- Get patient demographics.
- Get current encounter details.
- Get recent lab reports.
- Get previous visit notes.
- Transcribe current conversation.
- Generate SOAP note.
- Highlight missing information.
- Suggest ICD/CPT codes if allowed.
- Save only after doctor approval.

## What We Need From LIS For Agent Upgrade

To make this agent useful inside our LIS, we need controlled APIs or service functions for core LIS data.

### 1. Patient Context

Required LIS access:

- Patient by MRN or patient ID.
- Patient demographics.
- Age, gender, contact metadata if needed.
- Active encounter/visit ID.
- Assigned doctor/provider.

Example tool:

```ts
getPatientByMrn(mrn: string)
```

### 2. Encounter Context

Required LIS access:

- Current visit information.
- Department/location.
- Visit reason.
- Referring physician.
- Encounter status.

Example tool:

```ts
getActiveEncounter(patientId: string)
```

### 3. Lab Results

Required LIS access:

- Recent lab orders.
- Completed lab results.
- Abnormal flags.
- Reference ranges.
- Collection date/time.
- Report status.

Example tools:

```ts
getRecentLabResults(patientId: string)
getAbnormalLabResults(patientId: string)
```

### 4. Previous Clinical Notes Or Reports

Required LIS/EMR access:

- Previous visit summaries.
- Previous SOAP notes.
- Prior diagnoses if stored.
- Prior treatment plans if available.
- Previous lab interpretation notes.

Example tool:

```ts
getPreviousClinicalNotes(patientId: string)
```

### 5. Save Draft Note

Required LIS/EMR write access:

- Save AI-generated note as draft.
- Save doctor-reviewed note as final.
- Attach note to patient encounter.
- Store audit metadata.

Example tools:

```ts
saveDraftSoapNote(encounterId: string, note: SoapNote)
finalizeSoapNote(noteId: string, doctorId: string)
```

### 6. Coding Support

Optional future LIS/billing integration:

- ICD code search.
- CPT code search.
- Common diagnosis/procedure mapping.
- Doctor approval before saving codes.

Example tools:

```ts
suggestIcdCodes(note: SoapNote)
suggestCptCodes(note: SoapNote)
```

## Required Agent Architecture

To evolve safely, we should not let the AI directly access the database. We should create a controlled tool layer.

Recommended structure:

```txt
server/src/
  agents/
    clinical-agent.service.ts
    agent-orchestrator.ts
    agent-prompts.ts

  tools/
    patient.tool.ts
    encounter.tool.ts
    labs.tool.ts
    notes.tool.ts
    coding.tool.ts

  lis/
    patient.adapter.ts
    encounter.adapter.ts
    labs.adapter.ts
    notes.adapter.ts
    coding.adapter.ts

  audit/
    agent-audit.model.ts
    agent-audit.service.ts
```

### Tool Layer

The agent should only call approved tools.

Examples:

```ts
getPatientContext()
getRecentLabs()
getPreviousNotes()
saveDraftNote()
```

This protects the LIS from uncontrolled AI behavior.

### LIS Adapter Layer

The LIS adapter hides internal database/API details from the agent.

Benefits:

- Easier integration with current LIS.
- Easier to replace mock data with real LIS APIs.
- Safer permissions.
- Better testing.

### Agent Orchestrator

The orchestrator manages the multi-step workflow.

Responsibilities:

- Receive user goal.
- Decide which tools are needed.
- Call tools safely.
- Combine transcript, patient data, labs, and history.
- Generate output.
- Ask doctor for missing information.
- Wait for approval before saving.

## AI Techniques Needed For A Strong Agent

### 1. Tool Calling

The model should be able to call approved backend tools, such as:

```txt
get patient history
get lab results
save note draft
suggest ICD codes
```

### 2. Structured Outputs

AI responses should be strict JSON, not free text.

Example:

```json
{
  "subjective": "",
  "objective": "",
  "assessment": "",
  "plan": "",
  "missingInformation": [],
  "suggestedFollowUp": []
}
```

### 3. Retrieval-Augmented Generation

For LIS context, the agent should retrieve relevant data before generating notes.

Useful context:

- Recent abnormal labs.
- Previous diagnoses.
- Previous reports.
- Recent prescriptions.
- Current encounter details.

### 4. Guardrails

Healthcare agent must have strict boundaries:

- Do not finalize diagnosis without doctor review.
- Do not save final notes without doctor approval.
- Do not invent exam findings.
- Do not invent lab values.
- Do not expose unnecessary PHI.
- Do not act outside the active patient encounter.

### 5. Human-In-The-Loop Approval

Doctor approval is mandatory.

Agent can:

- Draft.
- Summarize.
- Suggest.
- Highlight missing data.
- Save draft.

Agent should not:

- Finalize clinical decisions alone.
- Submit billing codes without review.
- Modify LIS records without approval.

### 6. Audit Trail

Every agent action should be logged.

Audit log should include:

- User/doctor ID.
- Patient ID.
- Encounter ID.
- Transcript ID.
- Tools called.
- Data retrieved.
- AI output.
- Doctor edits.
- Approval timestamp.
- Final saved note.

## Suggested Development Roadmap

### Phase 1: Complete Current MVP

Goal:

Finish a working medical scribe app.

Required:

- Doctor review workflow.
- Save final SOAP note to MongoDB.
- Store transcript and SOAP note.
- Add note status:
  - draft
  - generated
  - reviewed
  - saved
- Add basic API validation.

### Phase 2: LIS Mock Integration

Goal:

Simulate LIS data before touching production LIS.

Required:

- Mock patient API.
- Mock lab results API.
- Mock prior notes API.
- Mock save-note API.

This lets us design the agent safely.

### Phase 3: Tool-Based Agent Foundation

Goal:

Create agent that can call approved tools.

Required:

- Tool registry.
- Agent orchestrator.
- Tool calling loop.
- Structured output.
- Human approval gate.

### Phase 4: Real LIS Integration

Goal:

Connect agent tools to actual LIS APIs/database.

Required:

- LIS authentication.
- Role-based permissions.
- Patient/encounter APIs.
- Lab results APIs.
- Note save APIs.
- Audit logging.
- Security review.

### Phase 5: Advanced Clinical Agent

Goal:

Agent assists with richer workflows.

Possible features:

- Missing information detection.
- Follow-up recommendation drafts.
- Lab trend summaries.
- ICD/CPT suggestions.
- Patient history summaries.
- Multi-agent workflows:
  - scribe agent
  - lab summarizer agent
  - coding assistant agent
  - review/checking agent

## Security And Compliance Concerns

Before production use, we need to address:

- PHI handling policy.
- OpenAI/API data processing agreement.
- HIPAA or local healthcare compliance requirements.
- Encryption at rest.
- Encryption in transit.
- Role-based access control.
- Audit logs.
- Data retention rules.
- Doctor approval requirements.
- Prompt injection protection.
- LIS permission boundaries.

Detailed PHI-safe AI architecture is documented in [`PHI_SAFE_AI_PIPELINE.md`](./PHI_SAFE_AI_PIPELINE.md).

## Main Concern For Seniors

The MVP proves that we can convert conversation into structured clinical documentation.

The next strategic decision is how much LIS access the future agent should have.

For a safe agent, we need:

- Controlled LIS APIs.
- Clear permission model.
- Tool-based architecture.
- Human approval gates.
- Full audit trail.
- Clinical safety rules.

Without these, the system should remain a fixed AI documentation pipeline.

With these, it can evolve into a real LIS-integrated medical AI agent.

## Recommended Next Technical Step

Finish the current MVP first:

```txt
Doctor review -> Save note to database -> Audit-ready note record
```

Then start agent foundation:

```txt
Mock LIS tools -> Agent orchestrator -> Human approval -> Real LIS adapters
```

This gives us a safe path from AI scribe MVP to our own LIS healthcare agent.
