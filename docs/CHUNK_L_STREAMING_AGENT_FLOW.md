# Chunk L: Streaming Agent Flow Code Changes

## Purpose

This document explains the code flow added in Chunk L.

The goal was to replace frontend-simulated agent loading with real backend-driven LangGraph progress events.

Before this chunk:

```txt
Frontend clicked Generate SOAP
  -> frontend called one API
  -> backend ran whole LangGraph silently
  -> frontend showed fake/simulated loading steps
  -> backend returned final SOAP result
```

After this chunk:

```txt
Frontend clicks Generate SOAP
  -> frontend calls streaming agent API
  -> backend starts LangGraph
  -> backend emits real node progress events
  -> frontend updates activity UI from real events
  -> backend returns final agent run
  -> frontend fills SOAP note
```

## Main Answer

Yes, SOAP generation from the UI now uses the streaming API:

```txt
POST /api/v1/clinical-agent/runs/stream
```

Inside that request, LangGraph runs the clinical agent workflow.

The stream sends progress events while LangGraph nodes execute.

## High-Level Flow

```txt
Doctor clicks Generate SOAP draft
  -> client/app/page.tsx
  -> createClinicalAgentRunStream()
  -> POST /api/v1/clinical-agent/runs/stream
  -> createClinicalAgentRunStream controller
  -> createAgentRun()
  -> runClinicalAgentGraph()
  -> LangGraph nodes execute
  -> backend writes stream events
  -> frontend reads stream chunks
  -> frontend updates agent activity pill
  -> final agent run returns
  -> SOAP fields populate
```

## Frontend Entry Point

File:

```txt
client/app/page.tsx
```

Function:

```ts
handleGenerateSoap()
```

Old behavior:

```ts
const result = await createClinicalAgentRun({
  patientId,
  encounterId,
  transcript,
});
```

New behavior:

```ts
const result = await createClinicalAgentRunStream(
  {
    patientId: selectedPatient.id,
    encounterId: activeEncounterId,
    transcript: transcript.trim(),
  },
  handleAgentProgress,
);
```

This means the frontend no longer waits blindly for the final SOAP result.

It receives progress events while the backend is still working.

## Frontend Stream Reader

File:

```txt
client/lib/api.ts
```

Function:

```ts
createClinicalAgentRunStream()
```

Responsibilities:

- POST to `/api/v1/clinical-agent/runs/stream`
- read `response.body` as a stream
- decode chunks using `TextDecoder`
- parse server-sent-event style blocks
- call `onEvent()` for each agent progress event
- return the final `ClinicalAgentRun`

Stream event parser:

```ts
parseStreamBlock()
```

Expected event types from backend:

```txt
agent_event
agent_run
done
error
```

## Frontend Progress Handler

File:

```txt
client/app/page.tsx
```

Function:

```ts
handleAgentProgress(event)
```

It updates these states:

```ts
agentActiveNode
agentCompletedNodes
agentActivityIndex
agentStatusVisible
```

Meaning:

- `agentActiveNode`: current backend node running
- `agentCompletedNodes`: nodes finished by backend
- `agentActivityIndex`: which UI step is highlighted
- `agentStatusVisible`: whether compact agent activity pill is visible

## Frontend UI Behavior

The compact activity pill now reflects real backend progress.

Example UI states:

```txt
Reviewing patient chart...
Checking current visit...
Reading recent labs...
Comparing prior notes...
Preparing clinical context...
Drafting SOAP note...
Context gathered - SOAP draft ready
```

These labels map to backend LangGraph nodes:

```txt
load_patient_context           -> Reviewing patient chart
load_encounter_context         -> Checking current visit
load_recent_labs               -> Reading recent labs
load_prior_notes               -> Comparing prior notes
prepare_context                -> Preparing clinical context
generate_context_aware_soap    -> Drafting SOAP note
```

## Backend Route

File:

```txt
server/src/routes/clinical-agent.routes.ts
```

New route:

```ts
clinicalAgentRouter.post(
  "/clinical-agent/runs/stream",
  asyncHandler(createClinicalAgentRunStream),
);
```

Full API path:

```txt
POST /api/v1/clinical-agent/runs/stream
```

## Backend Controller

File:

```txt
server/src/controllers/clinical-agent.controller.ts
```

Function:

```ts
createClinicalAgentRunStream()
```

Responsibilities:

- set response headers for stream
- call `createAgentRun()`
- pass an `onProgress` callback
- write each progress event into the response stream
- write final agent run into the stream
- close the stream

Stream headers:

```ts
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
```

Backend writes events like:

```txt
event: agent_event
data: {"type":"node_started","node":"load_patient_context",...}

event: agent_run
data: {...finalAgentRun}

event: done
data: {"status":"done"}
```

## Agent Run Service

File:

```txt
server/src/services/agent-run.service.ts
```

Function:

```ts
createAgentRun(input, options)
```

New addition:

```ts
type CreateAgentRunOptions = {
  onProgress?: (event: ClinicalAgentProgressEvent) => void | Promise<void>;
};
```

The service passes `onProgress` into:

```ts
runClinicalAgentGraph(agentInput, {
  onProgress: options.onProgress,
});
```

This keeps persistence behavior the same:

- create agent run in MongoDB
- create audit events
- save tool audit events
- return serialized run

The difference is that progress events can now be streamed while graph execution is happening.

## LangGraph Service

File:

```txt
server/src/services/clinical-agent.service.ts
```

Main function:

```ts
runClinicalAgentGraph(input, options)
```

New option:

```ts
options.onProgress
```

The graph still uses LangGraph:

```ts
new StateGraph(ClinicalAgentAnnotation)
```

Nodes:

```txt
start
load_patient_context
load_encounter_context
load_recent_labs
load_prior_notes
prepare_context
generate_context_aware_soap
doctor_review_required
end
```

## How Progress Events Are Emitted

New helper:

```ts
createProgressNode()
```

This wraps each LangGraph node.

For every node:

```txt
emit node_started
run actual node logic
emit node_completed
return node update to LangGraph
```

Example:

```txt
node_started: load_patient_context
actual loadPatientContextNode() executes
node_completed: load_patient_context
```

That means frontend activity is now tied to real backend execution.

## Event Types

Backend emits:

```ts
type ClinicalAgentProgressEvent = {
  type:
    | "graph_started"
    | "node_started"
    | "node_completed"
    | "graph_completed";
  node?: ClinicalAgentNode;
  message: string;
  timestamp: string;
  completedNodes?: ClinicalAgentNode[];
};
```

## Current Important Limitation

This is streaming over a single POST request.

It is not yet:

```txt
POST creates run immediately
GET /events subscribes later
background worker continues independently
```

Current implementation:

```txt
POST /runs/stream stays open
backend runs graph inside the same request
frontend reads events until final run arrives
```

This is good for our current portfolio flow because:

- simpler than WebSockets
- simpler than background workers
- real backend progress is still visible
- no fake frontend timer
- works naturally when doctor clicks Generate SOAP

Future production upgrade:

```txt
POST /runs
  -> create pending run
  -> return runId

GET /runs/:runId/events
  -> subscribe to SSE events

worker
  -> runs graph in background
  -> stores events
  -> pushes updates
```

## What Stayed The Same

Doctor review flow stayed the same:

```txt
SOAP generated
  -> doctor edits
  -> Mark reviewed
  -> Save note
  -> approveClinicalAgentRun()
```

Approval still uses:

```txt
POST /api/v1/clinical-agent/runs/:runId/approve
```

The final agent run still gets saved and audited.

## Current Final Flow

```txt
1. Doctor selects LIS patient
2. Doctor records audio
3. Frontend sends audio to local STT
4. Transcript appears
5. Doctor clicks Generate SOAP draft
6. Frontend calls /clinical-agent/runs/stream
7. Backend starts LangGraph
8. Backend streams real node progress
9. Frontend updates activity pill
10. Backend returns final AgentRun
11. Frontend fills SOAP fields
12. Doctor edits SOAP
13. Doctor marks reviewed
14. Frontend approves agent run
15. Backend saves final note and audit events
```

## Why This Matters

This makes MediScribe feel more like an agent because the UI now reflects actual backend reasoning/workflow steps.

It is no longer just:

```txt
loading...
```

It is:

```txt
I am loading patient context.
I am checking the encounter.
I am looking for labs.
I am preparing context.
I am drafting SOAP.
```

That is closer to the agentic experience we wanted.

