# MediScribe Pro Agent Roadmap

## Purpose

This document explains what is left after the current MVP and what we need to add to make MediScribe AI feel like a professional LIS-integrated medical scribing agent.

The target is not a generic chatbot.

The target is a controlled clinical workflow agent that can:

- listen to a doctor-patient encounter
- create a clean transcript
- retrieve useful LIS context
- decide what clinical context is needed
- draft a structured note
- identify missing information
- ask for doctor approval
- save only approved documentation
- keep a full audit trail

## Where We Stand Now

Current system:

```txt
Doctor audio
  -> local/private STT service
  -> transcript
  -> LangGraph clinical agent run
  -> mock LIS context retrieval
  -> context-aware SOAP draft
  -> doctor review
  -> approve agent run
  -> save note
  -> audit trail
```

We already have important agent foundations:

- Local STT microservice boundary
- Express TypeScript backend
- MongoDB persistence
- Mock LIS data layer
- LIS adapter boundary
- Approved tool layer
- LangGraph workflow
- Human approval checkpoint
- Agent run persistence
- Audit trail
- Frontend agent activity view

This is stronger than a simple AI documentation helper, but it is still not a full pro-level medical scribing agent.

## What Is Still Missing

### 1. Real LIS Integration

Current state:

```txt
Agent -> tool layer -> mock LIS adapter
```

Pro state:

```txt
Agent -> tool layer -> real LIS adapter -> LIS APIs/database/services
```

Required from LIS/team:

- patient lookup contract
- encounter lookup contract
- lab result contract
- prior notes contract
- save note contract
- authentication method
- role/permission rules
- audit requirements
- PHI handling policy

Important rule:

The agent should never directly query the LIS database. It should call approved backend tools only.

## AI Techniques To Add

### 1. Real-Time Agent Progress Streaming

Current frontend shows simulated agent progress while the backend request is running.

Pro version should stream real backend events.

Possible approach:

```txt
Frontend starts agent run
  -> backend creates run
  -> frontend subscribes to run events
  -> LangGraph emits node/tool progress
  -> frontend shows live activity
```

Implementation options:

- Server-Sent Events for one-way progress updates
- WebSocket for richer live interaction
- polling as simplest fallback

Why it matters:

Doctors can see what the agent is doing:

- reviewing patient chart
- checking current visit
- reading labs
- comparing prior notes
- drafting SOAP
- waiting for review

This makes the product feel transparent and trustworthy.

### 2. Dynamic Tool Selection

Current agent flow is mostly fixed:

```txt
load patient
load encounter
load labs
load prior notes
generate SOAP
```

Pro agent should decide which tools are needed based on the case.

Example:

```txt
If transcript mentions diabetes:
  -> retrieve recent A1c/glucose labs

If transcript mentions medication refill:
  -> retrieve medication history

If transcript mentions prior diagnosis:
  -> retrieve relevant prior notes

If no labs are relevant:
  -> skip labs
```

How to build:

- Keep LangGraph as the controller.
- Add a routing node that classifies intent and required context.
- Let the LLM propose tool needs, but validate against an approved allowlist.
- Never allow arbitrary tool names or direct database access.

Safe pattern:

```txt
LLM suggests:
  "Need recent labs"

Backend validates:
  allowed tool = getRecentLabs

LangGraph executes:
  getRecentLabs(patientId)
```

### 3. Clinical Intent Extraction

Before generating SOAP, the agent should extract structured clinical facts.

Example output:

```json
{
  "chiefComplaint": "headache",
  "duration": "2 days",
  "symptomsDenied": ["fever"],
  "medicationsDiscussed": ["medicine after meals"],
  "followUpNeeded": false,
  "missingInfo": ["vitals", "exam findings"]
}
```

Why it matters:

- SOAP generation becomes more consistent.
- The agent can detect missing details.
- The UI can show what the AI understood before note generation.
- It reduces hallucination risk.

### 4. Missing Information Detection

The agent should identify what the doctor may need to confirm.

Examples:

- no vitals mentioned
- no physical exam findings
- medication name missing
- dosage missing
- duration unclear
- allergy not confirmed
- assessment is too uncertain

Output in UI:

```txt
Needs doctor confirmation:
- Medication name not captured.
- No objective exam findings were mentioned.
- Follow-up timing was not specified.
```

Important:

The agent should not invent missing information. It should ask for confirmation.

### 5. Clinical Safety Review Node

Before showing or saving the note, add a safety review node.

Checks:

- Does SOAP contain unsupported claims?
- Did the assessment include a diagnosis not supported by transcript/context?
- Did the plan include treatment not mentioned or approved?
- Are there contradictions between transcript and note?
- Are allergies considered?
- Is PHI handled correctly?

Flow:

```txt
generate SOAP
  -> safety review
  -> if issues found, flag for doctor
  -> doctor edits/approves
  -> save
```

This can use a smaller LLM prompt, rules, or both.

### 6. RAG With Vector Database

Vector DB should not replace LIS APIs.

Use normal LIS APIs for structured data:

- demographics
- encounters
- lab values
- orders
- provider
- accession/sample data

Use vector DB for semantic retrieval:

- prior notes
- long histories
- clinical templates
- doctor-specific note styles
- facility documentation policies
- similar past encounters

Future flow:

```txt
Transcript
  -> clinical intent extraction
  -> retrieve structured LIS context
  -> vector search relevant prior notes/templates
  -> generate SOAP with citations/internal references
  -> safety review
  -> doctor approval
```

Recommended first option:

```txt
MongoDB Atlas Vector Search
```

Reason:

We already use MongoDB, so this keeps the architecture simpler.

Production note:

Embedding PHI or clinical notes requires privacy/compliance review.

### 7. Better STT: Diarization And Medical Vocabulary

Current local STT gives a transcript, but pro scribing needs better conversation structure.

Needed upgrades:

- speaker diarization
- doctor/patient turn separation
- medical vocabulary tuning
- punctuation cleanup
- silence handling
- confidence scores
- transcript correction UI

Ideal transcript:

```txt
Doctor: How long have you had the headache?
Patient: Two days.
Doctor: Any fever?
Patient: No fever.
Doctor: Take the medicine after meals.
```

Why it matters:

SOAP quality improves when the agent knows who said what.

### 8. Specialty-Specific Note Templates

SOAP is a good MVP format, but real healthcare workflows vary.

Future templates:

- primary care note
- pathology/lab consult note
- molecular LIS note
- radiology-style impression
- discharge summary
- follow-up note
- pre-op/post-op note

The agent should select or receive a template based on encounter type.

Flow:

```txt
encounter.visitType
  -> select documentation template
  -> generate structured note
  -> doctor edits
  -> save
```

### 9. Coding Assistance

Senior concern:

Can the LLM suggest ICD codes by checking the patient's history, current encounter, transcript, labs, and generated note?

Yes, that is a valid future feature.

The safer wording is:

```txt
The agent can suggest possible ICD/CPT codes with evidence and confidence,
but the doctor or billing team must approve them before they are saved.
```

The LLM should not simply read the final SOAP note and guess codes. A better pro-level flow is context-based coding assistance.

Recommended coding context:

- current encounter reason
- current transcript
- generated SOAP note
- patient active problems
- prior diagnoses
- relevant lab results
- prior notes
- procedures/orders from LIS
- provider specialty
- facility coding rules if available

Flow:

```txt
Current transcript
  -> clinical extraction
  -> retrieve patient history
  -> retrieve active problems/prior diagnoses
  -> retrieve labs/procedures/orders
  -> generate SOAP draft
  -> coding suggestion node
  -> ICD/CPT suggestions with supporting evidence
  -> doctor/billing review
  -> approved codes saved
```

Suggested LLM output shape:

```json
{
  "icdSuggestions": [
    {
      "code": "R51.9",
      "description": "Headache, unspecified",
      "confidence": "medium",
      "evidence": [
        "Patient reported headache for two days",
        "No fever reported"
      ],
      "requiresReview": true
    }
  ],
  "cptSuggestions": [],
  "warnings": [
    "No physical exam findings were documented.",
    "Medication name was not captured."
  ]
}
```

What makes this agentic:

- The agent decides which clinical context is needed for coding.
- The agent calls approved LIS tools to gather that context.
- The agent compares current symptoms with historical problems.
- The agent explains why a code is suggested.
- The agent flags missing evidence instead of inventing it.

Flow:

```txt
SOAP draft + encounter context
  -> coding suggestion agent
  -> ICD/CPT suggestions with reason
  -> doctor/billing review
  -> approved codes saved
```

Safety rule:

Coding suggestions must be explainable, evidence-linked, confidence-scored, and approval-gated.

Important guardrails:

- Do not auto-save ICD/CPT codes.
- Do not treat suggestions as final diagnosis.
- Do not suggest codes unsupported by transcript, history, labs, or note.
- Show why each code was suggested.
- Show missing evidence or uncertainty.
- Keep audit logs for every coding suggestion.
- Let doctor/billing staff accept, edit, or reject each suggestion.

Recommended first implementation:

```txt
ICD suggestion only
  -> use current SOAP + transcript + patient active problems
  -> return top 3 possible ICD codes
  -> include evidence and warnings
  -> no auto-save
```

After that:

```txt
Add CPT suggestions
  -> requires procedure/order/visit-level context
  -> needs stronger billing review
```

### 10. Multi-Agent Review

Once the core agent is stable, split responsibilities.

Possible agents:

- Scribe Agent: drafts SOAP note
- Context Agent: retrieves LIS/chart context
- Safety Agent: checks unsupported claims
- Coding Agent: suggests ICD/CPT
- Review Agent: compares final note with transcript

Recommended architecture:

```txt
LangGraph Orchestrator
  -> Context Agent
  -> Scribe Agent
  -> Safety Agent
  -> Doctor Approval
  -> Coding Agent
  -> Save
```

Do not start with multi-agent complexity too early. Add it only when each role has a clear value.

### 11. Evaluation And Quality Scoring

A pro scribing agent needs measurable quality.

Create test encounters with expected outputs.

Evaluate:

- transcript accuracy
- SOAP completeness
- hallucination rate
- missing information detection
- correct lab usage
- unsupported diagnosis detection
- doctor edit distance
- time saved per note

Useful metrics:

```txt
AI draft accepted with minor edits
AI draft rejected
doctor edit percentage
average time to save note
missing-info warnings accepted
unsupported-claim warnings found
```

This is how we prove the product is improving.

### 12. Learning From Doctor Edits

Doctor edits are valuable feedback.

Future feedback loop:

```txt
AI draft
  -> doctor edits
  -> save final note
  -> compare draft vs final
  -> learn style/preferences
```

Use cases:

- preferred wording
- specialty templates
- common plan phrasing
- provider-specific documentation style

Important:

Do not automatically fine-tune on PHI data without compliance approval.

Safer first step:

- store edit analytics
- summarize non-PHI style preferences
- improve prompts/templates

## Priority-Based Pro Agent Chunks

The goal is not to build every advanced feature at once. The order should follow product value, safety, and dependency readiness.

Recommended priority:

```txt
P0: Make the current scribe output more clinically useful
P1: Add senior-requested coding intelligence
P2: Make the workflow visibly and technically agentic
P3: Connect to real LIS safely
P4: Add long-term memory, multi-agent review, and optimization
```

## P0: Core Scribing Quality

These chunks improve the actual medical scribe experience first. They should come before advanced autonomy because doctors will judge the product mainly by note quality, missing-info handling, and review efficiency.

### P0 Chunk 1: Clinical Extraction Layer

Goal:

Extract structured facts before SOAP generation.

Build:

- extraction prompt/schema
- JSON validation
- chief complaint extraction
- symptom/duration extraction
- medication extraction
- negative findings extraction
- missing information detector
- UI summary of extracted facts

Output:

```txt
Agent understands the encounter before writing the note
```

Why this is high priority:

SOAP quality depends on whether the agent correctly understood the conversation. This also prepares the data needed for ICD suggestions.

### P0 Chunk 2: Missing Information Detection

Goal:

Tell the doctor what is missing before the note is approved.

Build:

- missing vitals check
- missing exam findings check
- unclear medication/dosage check
- unclear duration/severity check
- unclear assessment/plan check
- doctor-facing warning panel

Output:

```txt
Doctor sees what must be confirmed instead of AI inventing details
```

Why this is high priority:

This makes the agent safer and more clinically useful immediately.

### P0 Chunk 3: Safety Review Node

Goal:

Catch unsupported or risky note content before doctor approval.

Build:

- transcript-vs-note checker
- context-vs-note checker
- allergy/medication caution checks
- unsupported diagnosis warning
- unsupported treatment warning
- warning UI

Output:

```txt
Doctor gets safer AI drafts with clear warnings
```

Why this is high priority:

Medical scribing is high-trust. The agent should flag uncertainty instead of sounding overconfident.

## P1: Coding Intelligence

This is important because seniors are asking for ICD suggestions. We should support it, but with strong guardrails.

### P1 Chunk 4: ICD Code Suggestions

Goal:

Suggest ICD codes from current encounter context and patient history.

Build:

- ICD suggestion tool
- context pack using transcript, extracted clinical facts, generated SOAP, active problems, prior diagnoses, relevant labs, and prior notes
- top 3 candidate ICD codes
- evidence for every code
- confidence level
- missing-evidence warnings
- doctor/billing approval gate
- audit trail for suggestions and approvals

Output:

```txt
Agent suggests explainable ICD codes but never silently finalizes billing
```

Why this is high priority:

ICD suggestion is visible business value. It shows seniors that the agent can use patient history and current encounter context, not just summarize text.

Important boundary:

```txt
ICD suggestion = allowed
Auto-final diagnosis/billing = not allowed
```

### P1 Chunk 5: CPT Suggestions Later

Goal:

Add CPT suggestions after ICD suggestions are stable.

Build:

- procedure/order context
- visit level context
- billing rules
- provider specialty rules
- billing/coding review gate

Output:

```txt
CPT suggestions with stronger billing review
```

Why CPT is lower than ICD:

CPT usually needs more exact procedure, order, visit-level, and billing-rule context. ICD is the better first coding feature.

## P2: Agentic Behavior And Live UX

These chunks make the system feel and behave more like an agent instead of a fixed pipeline.

### P2 Chunk 6: Real-Time Agent Events

Goal:

Show actual backend agent progress in frontend.

Build:

- agent event emitter
- SSE endpoint
- frontend event subscription
- live node/tool activity UI
- live audit event display for internal/debug views

Output:

```txt
Doctor sees real agent progress, not simulated progress
```

Why this matters:

It improves trust and makes the agent workflow transparent.

### P2 Chunk 7: Dynamic Context Router

Goal:

Agent decides which context tools are needed.

Build:

- routing node
- allowed tool policy
- tool selection validation
- reason for each tool call
- audit log for why each tool was called
- fallback if tool is unavailable

Output:

```txt
Agent is no longer fully fixed-sequence
```

Why this comes after safety/extraction:

Dynamic decisions are useful only when the agent has reliable structured facts and guardrails.

## P3: Production LIS Integration

These chunks move us from mock data to real LIS use.

### P3 Chunk 8: Real LIS Adapter

Goal:

Replace mock LIS data with real LIS integration.

Build:

- real adapter implementation
- auth layer
- permission checks
- patient lookup
- encounter lookup
- lab result lookup
- prior notes lookup
- save note endpoint
- audit metadata
- error handling for unavailable LIS services

Output:

```txt
Agent uses real LIS context through approved boundaries
```

Why this is P3:

Real LIS integration is critical, but it needs contracts, credentials, security approval, and senior/team coordination. We can build the intelligence against mock adapter first, then swap the adapter.

## P4: Advanced Intelligence And Optimization

These chunks are valuable after the core scribe, coding, and LIS boundary are stable.

### P4 Chunk 9: Vector Retrieval

Goal:

Retrieve relevant prior notes/templates using semantic search.

Build:

- embedding pipeline
- vector index
- retrieval tool
- source/citation metadata
- PHI-safe storage policy

Output:

```txt
Agent can use long-term clinical context without loading everything
```

Use cases:

- similar past encounters
- long prior notes
- specialty templates
- provider style preferences
- documentation policies

### P4 Chunk 10: Evaluation Harness

Goal:

Measure quality before production.

Build:

- test encounter dataset
- expected note examples
- automated scoring
- manual review workflow
- regression checks

Output:

```txt
Team can prove whether the agent is improving
```

### P4 Chunk 11: Learning From Doctor Edits

Goal:

Use doctor edits to improve prompts, templates, and provider-specific style.

Build:

- draft-vs-final comparison
- edit analytics
- common correction patterns
- provider preference summaries
- prompt/template updates

Output:

```txt
Agent drafts become closer to what doctors actually approve
```

### P4 Chunk 12: Multi-Agent Review

Goal:

Split responsibilities only when the core agent is stable.

Possible agents:

- Context Agent
- Scribe Agent
- Safety Agent
- Coding Agent
- Review Agent

Output:

```txt
Specialized agents improve quality without making one giant prompt responsible for everything
```

## Recommended Next Move

The best next chunk is:

```txt
P0 Chunk 1: Clinical Extraction Layer
```

Reason:

Clinical extraction directly improves SOAP quality, missing-info detection, safety review, and ICD suggestions. It is the foundation for the pro agent.

After that:

```txt
Missing Information Detection
  -> Safety Review
  -> ICD Code Suggestions
  -> Real-Time Agent Events
  -> Dynamic Context Router
  -> Real LIS Adapter
```

This path makes the product more useful first, safer second, more agentic third, and production-ready after LIS contracts are available.

## Final Target Flow

```txt
Doctor starts encounter
  -> local STT creates speaker-aware transcript
  -> clinical extraction finds facts and missing details
  -> agent decides what LIS context is needed
  -> approved tools retrieve patient/encounter/labs/prior notes
  -> vector search retrieves relevant long-form context/templates
  -> context-aware SOAP is generated
  -> safety review checks unsupported claims
  -> doctor edits and approves
  -> final note is saved into LIS
  -> audit trail stores every step
```

That is the path from current MVP to a professional LIS-integrated medical scribing agent.
