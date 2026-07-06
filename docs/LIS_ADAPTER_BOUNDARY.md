# LIS Adapter Boundary

## Purpose

This chunk creates the boundary where real LIS integration will plug in later.

It does not connect to the real LIS yet.

Current production-safe direction:

```txt
LangGraph Agent
  -> Tool Layer
  -> LIS Adapter Interface
  -> Mock LIS Adapter
```

Future direction:

```txt
LangGraph Agent
  -> Tool Layer
  -> LIS Adapter Interface
  -> Real LIS Adapter
  -> Real LIS APIs
```

## Adapter Mode

The backend uses:

```txt
LIS_ADAPTER_MODE=mock
```

Supported values:

```txt
mock
real
```

Default is `mock`.

If `real` is enabled now, the real adapter returns `501 Not Implemented` because real LIS API contracts and credentials are not configured.

## Files

```txt
server/src/adapters/lis/lis-adapter.types.ts
server/src/adapters/lis/mock-lis.adapter.ts
server/src/adapters/lis/real-lis.adapter.ts
server/src/adapters/lis/index.ts
```

## Adapter Interface

The adapter exposes:

```ts
type LisAdapter = {
  listPatients()
  getPatient(patientId)
  getEncounter(encounterId)
  getRecentLabs(patientId)
  getPriorNotes(patientId)
}
```

## Why This Matters

The agent and tools should not know whether data comes from:

- mock data
- staging LIS
- production LIS

They should only know the approved adapter contract.

This lets us replace mock data later without rewriting LangGraph nodes or agent tools.

## What Real LIS Integration Still Needs

Before implementing the real adapter, we need:

- LIS API documentation
- authentication method
- staging credentials
- patient endpoint contract
- encounter endpoint contract
- lab results endpoint contract
- prior notes endpoint contract
- security approval
- PHI/audit requirements
- network access rules

## Important Rule

Do not let the agent directly query a LIS database.

The correct pattern is:

```txt
Agent node
  -> approved tool
  -> LIS adapter
  -> LIS API
```
