# Agent Tool Layer

## Purpose

This chunk creates the controlled tool layer that the future clinical agent will use.

The agent should not directly query MongoDB, the mock LIS service, or the real LIS database.

Instead, the agent should call approved tools:

```txt
Agent -> Tool Registry -> LIS Adapter/Mock LIS -> Result + Audit Event
```

## Why This Matters

Healthcare agent behavior must be controlled and auditable.

The tool layer gives us:

- approved tool names
- strict inputs
- predictable outputs
- a place to add auth later
- a place to add audit logging later
- a stable contract before LangGraph is introduced

## Current Tools

### getPatientContext

Input:

```json
{
  "patientId": "patient-001"
}
```

Returns:

- demographics
- MRN
- allergies
- active problems

### getEncounterContext

Input:

```json
{
  "encounterId": "encounter-001"
}
```

Returns:

- encounter status
- visit type
- provider
- location
- reason for visit

### getRecentLabs

Input:

```json
{
  "patientId": "patient-001"
}
```

Returns:

- recent mock lab results
- panel/test/value/reference range/flag

### getPriorNotes

Input:

```json
{
  "patientId": "patient-001"
}
```

Returns:

- prior note summaries
- prior assessments
- prior plans

## Developer Test Endpoints

List approved tools:

```txt
GET /api/v1/agent-tools
```

Run an approved tool:

```txt
POST /api/v1/agent-tools/:toolName/run
```

Example:

```txt
POST /api/v1/agent-tools/getPatientContext/run
```

Body:

```json
{
  "patientId": "patient-001"
}
```

## Tool Result Shape

Each tool returns:

```json
{
  "tool": "getPatientContext",
  "data": {},
  "auditEvent": {
    "timestamp": "ISO timestamp",
    "tool": "getPatientContext",
    "status": "success",
    "patientId": "patient-001",
    "message": "Loaded patient context from mock LIS."
  }
}
```

## Important Rule

These tools currently read from mock LIS data.

Later, the same tool names should call real LIS adapters behind the scenes.

The LangGraph agent should depend on this tool contract, not the mock data implementation.

## Next Chunk

Next chunk should be the **LangGraph Agent Skeleton**:

```txt
START
  -> load_patient_context
  -> load_encounter_context
  -> load_recent_labs
  -> load_prior_notes
  -> prepare_context
  -> END
```

At first, the graph should only load context and return state.

It should not save notes automatically.
