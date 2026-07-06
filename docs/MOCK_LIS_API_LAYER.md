# Mock LIS API Layer

## Purpose

This chunk creates safe mock LIS endpoints before connecting MediScribe AI to the real LIS.

The future LangGraph agent will not query databases directly. It will call controlled tools, and those tools will call LIS adapter endpoints like these.

## Why This Exists

The MVP is currently an AI documentation pipeline:

```txt
Audio -> STT -> Transcript -> SOAP -> Doctor review -> Save
```

To move toward an agent, we need patient and encounter context:

```txt
Agent -> LIS tools -> patient context, encounter context, labs, prior notes
```

This mock layer gives us that safely without touching production LIS data.

## Base URL

```txt
http://localhost:4000/api/v1
```

## Mock IDs

Use these for local testing:

```txt
patient-001
patient-002
encounter-001
encounter-002
```

## Endpoints

### List Mock Patients

```txt
GET /lis/patients
```

Purpose:

- local testing
- frontend patient selector later
- quick sanity check for mock data

### Get Patient Context

```txt
GET /lis/patients/:patientId
```

Example:

```txt
GET /api/v1/lis/patients/patient-001
```

Returns:

- patient ID
- MRN
- display name
- age
- sex
- DOB
- contact placeholders
- allergies
- active problems

### Get Encounter Context

```txt
GET /lis/encounters/:encounterId
```

Example:

```txt
GET /api/v1/lis/encounters/encounter-001
```

Returns:

- encounter ID
- patient ID
- status
- visit type
- provider
- location
- start time
- reason for visit

### Get Recent Labs

```txt
GET /lis/patients/:patientId/labs
```

Example:

```txt
GET /api/v1/lis/patients/patient-001/labs
```

Returns mock lab results:

- panel
- test name
- value
- unit
- reference range
- flag
- collected/resulted timestamps

### Get Prior Notes

```txt
GET /lis/patients/:patientId/notes
```

Example:

```txt
GET /api/v1/lis/patients/patient-001/notes
```

Returns prior mock clinical notes:

- note type
- author
- created timestamp
- summary
- assessment
- plan

## What This Enables Next

Next chunk should create a controlled tool layer:

```txt
getPatientContext(patientId)
getEncounterContext(encounterId)
getRecentLabs(patientId)
getPriorNotes(patientId)
```

Those tools will later be used by the LangGraph clinical agent.

## Important Rule

This layer is still mock data.

Do not connect directly to the real LIS database from agent code.

The future real integration should replace mock data behind adapter functions while keeping the same controlled API/tool contract.
