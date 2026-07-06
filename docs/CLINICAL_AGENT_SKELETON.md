# Clinical Agent Skeleton

## Purpose

This chunk creates the first LangGraph-based agent-style orchestrator for MediScribe AI.

It is intentionally deterministic and safe:

- no autonomous saving
- no free-form tool selection
- no doctor-facing UI change
- no direct database/LIS access by the agent

The skeleton uses `@langchain/langgraph`, calls our approved tool layer, and returns a clinical context state.

## Current Flow

```txt
START
  -> load_patient_context
  -> load_encounter_context
  -> load_recent_labs
  -> load_prior_notes
  -> prepare_context
  -> if transcript exists: generate_context_aware_soap
  -> if transcript missing: doctor_clarification_required
  -> doctor_review_required
  -> END
```

## Why Deterministic First

In healthcare, the first agent version should be predictable.

Before allowing dynamic LLM decisions, we prove that:

- agent state shape works
- tool calls work
- audit events are captured
- patient/encounter/lab/prior note context can be bundled
- the workflow stops before any save action

## Test Endpoint

Run the clinical agent skeleton:

```txt
POST /api/v1/clinical-agent/run
```

Example:

```bash
curl -X POST http://localhost:4000/api/v1/clinical-agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-001",
    "encounterId": "encounter-001",
    "transcript": "Patient reports fever and cough for three days."
  }'
```

## Output

The endpoint returns:

- agent name
- status
- full state
- completed nodes
- loaded patient context
- loaded encounter context
- loaded labs
- loaded prior notes
- prepared context summaries
- missing information list
- generated SOAP draft when a transcript is present
- audit events from tool calls

## Current State Shape

```ts
type ClinicalAgentState = {
  goal: string;
  patientId: string;
  encounterId: string;
  transcript: string;
  patientContext?: LisPatient;
  encounterContext?: LisEncounter;
  labs: LisLabResult[];
  priorNotes: LisPriorNote[];
  preparedContext?: ClinicalAgentPreparedContext;
  generatedSoap: SoapNote | null;
  missingInformation: string[];
  requiresDoctorApproval: true;
  approvalStatus: "pending";
  currentNode: ClinicalAgentNode;
  completedNodes: ClinicalAgentNode[];
  auditEvents: AgentToolAuditEvent[];
};
```

## LangGraph Implementation

The server now installs:

```txt
@langchain/langgraph
@langchain/core
```

The workflow is implemented as a real LangGraph `StateGraph` with:

- `Annotation.Root`
- explicit node functions
- `START` / `END` edges
- reducers for `completedNodes`
- reducers for `auditEvents`

The current graph is still deterministic. That is intentional for healthcare safety.

## Controlled Decision Point

The graph now has one controlled conditional edge after `prepare_context`:

```txt
If transcript exists:
  -> generate_context_aware_soap
  -> doctor_review_required

If transcript is missing:
  -> doctor_clarification_required
  -> END
```

This is the first step toward agentic behavior.

The LLM does not choose arbitrary tools or endpoints. LangGraph controls the route.

## Next Step

Chunk F should add human approval and checkpointing:

```txt
generated SOAP draft
  -> save graph state
  -> pause for doctor review
  -> resume after approval
  -> save only after approval
```

Still no automatic final save.
