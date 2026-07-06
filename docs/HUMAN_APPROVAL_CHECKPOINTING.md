# Human Approval And Checkpointing

## Purpose

This chunk persists LangGraph agent runs so the workflow can pause at doctor review and resume through an approval endpoint.

The agent still cannot save a final note by itself.

Save happens only after doctor approval.

## Flow

```txt
POST /clinical-agent/runs
  -> run LangGraph
  -> generate context-aware SOAP
  -> persist agent state
  -> return runId

GET /clinical-agent/runs/:runId
  -> reload persisted graph state

POST /clinical-agent/runs/:runId/approve
  -> accept doctor-approved SOAP
  -> save final reviewed note
  -> mark run approved/saved
```

## Endpoints

### Create Persisted Agent Run

```txt
POST /api/v1/clinical-agent/runs
```

Example:

```bash
curl -X POST http://localhost:4000/api/v1/clinical-agent/runs \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-001",
    "encounterId": "encounter-001",
    "transcript": "Patient reports fever and cough for three days."
  }'
```

### Get Agent Run

```txt
GET /api/v1/clinical-agent/runs/:runId
```

### Approve Agent Run

```txt
POST /api/v1/clinical-agent/runs/:runId/approve
```

If the doctor sends edited SOAP, it will be saved.

If no SOAP is sent, the generated SOAP from the run is used.

Example:

```bash
curl -X POST http://localhost:4000/api/v1/clinical-agent/runs/RUN_ID/approve \
  -H "Content-Type: application/json" \
  -d '{
    "reviewedAt": "2026-07-01T10:00:00.000Z"
  }'
```

## Persisted Data

The `AgentRun` collection stores:

- agent name
- patient ID
- encounter ID
- run status
- approval status
- full graph state
- approved SOAP
- approval timestamp
- saved note ID

## Safety Rule

The agent run can only save when status is:

```txt
doctor_review_required
```

Runs that need clarification cannot be approved/saved until a SOAP draft exists.

## Still Pending

This is checkpointing at the application/model level.

Future work can add native LangGraph checkpoint savers, deeper audit models, and frontend review/resume screens.
