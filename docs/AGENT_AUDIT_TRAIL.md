# Agent Audit Trail

## Purpose

This chunk makes agent activity queryable outside the large persisted graph state.

Healthcare/LIS workflows need to answer:

- Which patient/encounter did the agent access?
- Which tools were called?
- Was a SOAP draft generated?
- Did the doctor approve it?
- Was the final note saved?

## Audit Model

The `AgentAudit` collection stores:

- run ID
- patient ID
- encounter ID
- event type
- graph node
- tool name
- status
- message
- metadata
- timestamps

## Event Types

```txt
run_created
tool_call
graph_completed
doctor_review_required
doctor_clarification_required
run_approved
note_saved
```

## Endpoint

Get audit events for an agent run:

```txt
GET /api/v1/clinical-agent/runs/:runId/audit
```

Example:

```bash
curl http://localhost:4000/api/v1/clinical-agent/runs/RUN_ID/audit
```

## When Events Are Created

### On Agent Run Creation

The system stores:

- `run_created`
- one `tool_call` per tool event
- `graph_completed`
- `doctor_review_required` or `doctor_clarification_required`

### On Doctor Approval

The system stores:

- `run_approved`
- `note_saved`

## Important Notes

This is backend/admin infrastructure.

It is not meant for the doctor workspace UI yet.

Later, with real auth, audit events should also include:

- user ID
- role
- organization/facility
- request IP/session metadata
- real LIS correlation IDs
