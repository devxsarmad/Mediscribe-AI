# Chunk M: Hybrid LIS Mode Cleanup

## Purpose

This document explains the hybrid LIS mode used in MediScribe AI.

After the layoff, direct company database access is not available and should not be required for a portfolio project.

The correct architecture is:

```txt
Agent -> approved tools -> LIS adapter -> available APIs
```

The agent should never connect directly to a LIS database.

## Current Hybrid Mode

Current available real integration:

```txt
Real LIS dev patient API
```

Unavailable real integrations:

```txt
encounters
labs
prior notes
save note back to LIS
```

So the current portfolio-safe mode is:

```txt
Patients: real LIS dev API
Encounter: temporary current encounter
Labs: empty until API exists
Prior notes: empty until API exists
Final note save: MongoDB portfolio database
```

This is intentional.

It lets us show real API integration without pretending we have private company infrastructure.

## Backend Behavior

File:

```txt
server/src/adapters/lis/real-lis.adapter.ts
```

### Patient Lookup

When `LIS_ADAPTER_MODE=real`, the real adapter calls:

```txt
GET {LIS_API_BASE_URL}/patients?paginate=true&per_page=50&page=1&search=&organization_id=
```

Auth headers:

```txt
Authorization: Bearer <LIS_AUTH_TOKEN>
auth-token: <LIS_AUTH_TOKEN>
```

The adapter maps LIS patient fields into our internal shape:

```ts
type LisPatient = {
  id: string;
  mrn: string;
  displayName: string;
  age: number;
  sex: "female" | "male" | "other" | "unknown";
  dateOfBirth: string;
  phone: string;
  address: string;
  allergies: string[];
  activeProblems: string[];
};
```

### Temporary Encounter

Because the real encounter API is not available, the adapter creates a temporary current encounter:

```txt
encounterId = current:{patientId}
```

This gives LangGraph enough context to continue the workflow without requiring real encounter API access.

### Labs And Prior Notes

Because real lab/prior-note APIs are not available, the adapter returns:

```txt
labs: []
priorNotes: []
```

The agent and audit messages now say these were checked, not loaded.

This avoids misleading language.

## Fallback Behavior

New env variable:

```txt
LIS_REAL_PATIENT_FALLBACK_TO_MOCK=true
```

When enabled:

```txt
real LIS patient API fails
  -> adapter falls back to mock patients
  -> frontend still works for demo
```

This helps if:

- LIS token expires
- dev LIS API is unavailable
- internet is down
- the portfolio demo needs to run without company API access

## Metadata Returned To Frontend

`GET /api/v1/lis/patients` can now include metadata:

```json
{
  "patients": [],
  "meta": {
    "patientSource": "real_lis",
    "clinicalContextSource": "temporary",
    "mode": "real_patient_hybrid",
    "note": "Patients come from the real LIS dev API. Encounter, labs, and prior notes use portfolio-safe placeholders until those APIs are available."
  }
}
```

Possible modes:

```txt
real_patient_hybrid
mock
```

Possible patient sources:

```txt
real_lis
mock
```

Possible clinical context sources:

```txt
temporary
mock
real_lis
```

## Frontend Behavior

File:

```txt
client/app/page.tsx
```

The patient card now shows:

```txt
Real LIS patient
```

or:

```txt
Demo patient
```

The encounter card now shows context source:

```txt
Draft encounter context
```

or:

```txt
Demo clinical context
```

This makes the hybrid mode visible without exposing engineering details to the doctor workflow.

## Agent Activity Wording Cleanup

Old labels:

```txt
Reading recent labs
Comparing prior notes
```

These implied real labs/prior notes always exist.

New labels:

```txt
Checking lab context
Checking prior note context
```

This is more accurate because the agent checks those tool slots, but there may be no linked data yet.

## Current Agent Flow In Hybrid Mode

```txt
Doctor selects patient
  -> patient comes from real LIS API if available
  -> temporary encounter is created
  -> lab context is checked
  -> prior note context is checked
  -> transcript + available context goes to SOAP generation
  -> doctor reviews
  -> final note saves to MongoDB
```

## Why This Is Good Portfolio Architecture

This is honest and production-shaped:

- Real external API integration exists.
- The agent uses adapter boundaries.
- Missing company APIs do not block the project.
- Mock/temporary context is clearly labeled.
- The same interface can support real labs/notes later.
- No direct LIS database access is required.

## Future Upgrade

If real APIs become available later, only the adapter needs to change:

```txt
real-lis.adapter.ts
  -> getEncounter()
  -> getRecentLabs()
  -> getPriorNotes()
  -> saveNote()
```

LangGraph, frontend, and agent tools can stay mostly the same.

