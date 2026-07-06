# PHI-Safe AI Pipeline For MediScribe AI

## Purpose

This document describes the proposed privacy-safe architecture for using AI in MediScribe AI while protecting patient demographics and other PHI before data is sent to external AI services.

The goal is to support future LIS/EMR integration without exposing raw patient identifiers to general-purpose LLMs.

## Core Concern

Doctor-patient conversations can contain PHI.

Examples:

- Patient name
- MRN
- Date of birth
- Phone number
- Address
- Email
- Insurance/member ID
- Exact dates
- Family member names
- Provider names

If the patient says these details during the conversation, then the **audio itself contains PHI**.

Therefore, the system must not blindly send raw audio or raw transcript to external AI services unless the company has completed compliance review, vendor approval, and required agreements such as a BAA where applicable.

## Proposed Privacy-Safe Flow

```txt
Raw audio
Doctor-patient conversation
    |
    v
Private infrastructure
    |
    v
Speech-to-text inside controlled environment
Local Whisper / private STT / HIPAA-approved STT
    |
    v
Raw transcript inside backend only
    |
    v
PHI Redactor
Replace identifiers with tokens
    |
    +-----------------------------+
    |                             |
    v                             v
Anonymized transcript        PHI Token Map
Tokens instead of names      Stored locally/encrypted
                              PATIENT_001 -> John Doe
                              ID_001 -> MRN 12345
    |
    v
Scribing LLM
Receives de-identified transcript only
    |
    v
SOAP draft with tokens
    |
    v
PHI Re-injector
Swap tokens back inside LIS/backend only
    |
    v
Doctor review
    |
    v
Save final note into LIS/EMR
```

## Recommended Production Architecture

### 1. Raw Audio Stays Private

Raw audio should remain inside our controlled infrastructure.

Recommended options:

- Local Whisper/faster-whisper running on our own server.
- Private STT deployed inside hospital/company infrastructure.
- HIPAA-approved STT provider only after compliance approval.

Avoid:

- Sending real patient audio directly to generic cloud APIs without compliance approval.

### 2. STT Produces Raw Transcript Internally

The speech-to-text service creates a raw transcript.

This raw transcript may contain PHI, so it must be treated as sensitive.

Example raw transcript:

```txt
My name is John Doe. My MRN is 12345. I live at 22 Main Street.
I have fever and cough for three days.
```

### 3. PHI Redactor Creates Tokens

The redactor detects PHI and replaces it with stable tokens.

Example de-identified transcript:

```txt
My name is PATIENT_001. My MRN is ID_001. I live at LOCATION_001.
I have fever and cough for several days.
```

Or stricter version:

```txt
PATIENT_001 reports fever and cough for several days.
```

### 4. PHI Token Map Is Stored Locally

The token map must never be sent to the external LLM.

Example token map:

```json
{
  "PATIENT_001": "John Doe",
  "ID_001": "MRN 12345",
  "LOCATION_001": "22 Main Street"
}
```

Storage requirements:

- Store encrypted.
- Link to encounter/session ID.
- Limit access by role.
- Add audit trail.
- Set retention policy.

### 5. LLM Receives Only De-identified Transcript

The scribing LLM receives:

```txt
PATIENT_001 reports fever and cough for several days.
```

It should not receive:

```txt
John Doe, MRN 12345, 22 Main Street
```

### 6. PHI Re-injector Runs Inside LIS Backend

After the LLM generates the SOAP note, the backend may re-inject identifiers only if needed for the LIS view.

The re-injection step happens inside our backend, not inside the LLM.

Example LLM output:

```txt
Subjective:
PATIENT_001 reports fever and cough for several days.
```

Re-injected inside LIS:

```txt
Subjective:
John Doe reports fever and cough for several days.
```

For many clinical note workflows, we may not even need to re-inject names into the SOAP body because the note is already attached to the patient encounter in LIS.

## Important Correction To The Diagram

The diagram shows:

```txt
Raw audio -> PHI Redactor -> PHI-free audio -> OpenAI Whisper
```

This is conceptually useful, but technically difficult.

Audio PHI redaction before transcription requires:

- Speaker/audio segmentation
- Speech recognition or keyword detection
- Audio masking/beeping/removal
- Reconstructing clean audio

That is much harder than text redaction.

Recommended practical version:

```txt
Raw audio
  -> Local/private STT
  -> Raw transcript inside backend
  -> PHI redaction in text
  -> De-identified transcript to LLM
```

If we must use external Whisper/STT, then the STT provider must be approved for PHI handling and covered by proper compliance agreements.

## PHI Detection Options

### Option A: Custom Local PHI Redactor

Build our own redaction service using:

- Regex rules
- Patient context from LIS
- Known MRN/patient ID
- Names from encounter
- Phone/email/address detection
- Date and age generalization

Pros:

- Fully controlled.
- No external PHI sharing.
- Easy to integrate with LIS context.

Cons:

- Needs careful testing.
- May miss complex PHI.

### Option B: Healthcare PHI Detection Service

Use a healthcare-focused PHI detection service.

Example:

- AWS Comprehend Medical `DetectPHI`

Pros:

- Healthcare-specific PHI detection.
- Confidence scores.
- Faster to implement.

Cons:

- External vendor.
- Requires compliance review and agreement.
- Still sends raw transcript to that provider.

### Option C: Hybrid

Use:

- Local rules for obvious PHI.
- Healthcare PHI detector for additional checks.
- Human review for risky cases.

Recommended for production:

```txt
LIS context redaction + regex + healthcare PHI detector + audit logs
```

## Proposed Backend Modules

Add these modules later:

```txt
server/src/services/
  local-transcription.service.ts
  deidentification.service.ts
  phi-token-map.service.ts
  phi-reinjection.service.ts

server/src/models/
  phi-token-map.model.ts
  note.model.ts

server/src/types/
  phi.types.ts
```

## Proposed Data Types

```ts
type PhiToken = {
  token: string;
  originalValue: string;
  category:
    | "PATIENT"
    | "ID"
    | "CONTACT"
    | "LOCATION"
    | "DATE"
    | "AGE"
    | "PROVIDER"
    | "OTHER";
  confidence?: number;
};

type DeidentifiedTranscript = {
  rawTranscriptId: string;
  encounterId: string;
  deidentifiedText: string;
  tokens: PhiToken[];
};
```

## Proposed Implementation Steps

### Step 1: Improve Current Text PHI Redaction

Current file:

```txt
server/src/utils/phi-sanitizer.ts
```

Upgrade it into:

```txt
server/src/services/deidentification.service.ts
```

Add:

- Token generation
- Token map output
- Confidence/source metadata
- More PHI categories

Status: Started.

Implemented files:

```txt
server/src/types/phi.types.ts
server/src/services/deidentification.service.ts
```

The SOAP generation path now uses PHI tokens such as:

```txt
PATIENT_001
ID_001
CONTACT_001
LOCATION_001
AGE_001
DATE_001
PROVIDER_001
```

The LLM receives the de-identified transcript. The API response only exposes public token metadata and does not return original PHI values.

### Step 2: Stop Sending Raw Transcript To LLM

Ensure:

```txt
soap.service.ts
```

receives only de-identified transcript.

Status: Done for SOAP generation.

Current SOAP generation flow:

```txt
raw transcript in backend
  -> deidentifyTranscript()
  -> deidentified transcript
  -> LLM SOAP generation
```

Remaining production concern:

Speech-to-text still needs a HIPAA-safe strategy before real patient use. The recommended production path remains local/private STT.

### Step 3: Store PHI Token Map Locally

Add:

```txt
phi-token-map.model.ts
```

Store token maps encrypted and linked to encounter/session ID.

Status: Not implemented yet.

Next implementation step:

- Add `phi-token-map.model.ts`
- Store original PHI values encrypted
- Link map to note/session/encounter
- Do not expose original values to frontend or LLM

### Step 4: Add Re-injection Service

Add:

```txt
phi-reinjection.service.ts
```

This service replaces tokens with real values only inside our trusted backend/LIS context.

### Step 5: Replace Cloud STT With Local/Private STT

For production, move from:

```txt
OpenAI Whisper API
```

to:

```txt
Local Whisper/faster-whisper
```

or a HIPAA-approved STT provider.

Detailed internal STT microservice plan:

```txt
INTERNAL_STT_MICROSERVICE_PLAN.md
```

## MVP Adjustment Recommendation

For the current MVP:

- Use synthetic/demo patient data only.
- Keep PHI sanitizer before SOAP generation.
- Add a visible note in docs that production requires private STT and stronger de-identification.

For production/LIS:

- Do not send raw patient audio to external APIs without compliance approval.
- Do not send raw transcripts to LLM.
- Store token map locally.
- Send only de-identified transcript to LLM.
- Keep doctor approval mandatory.

## Final Recommended Flow For Our LIS

```txt
Browser records audio
  -> Backend receives audio
  -> Local/private STT creates raw transcript
  -> De-identification service replaces PHI with tokens
  -> Token map stored encrypted in LIS/backend
  -> LLM receives only de-identified transcript
  -> LLM returns SOAP draft with tokens
  -> Backend optionally re-injects PHI for LIS display
  -> Doctor reviews and edits
  -> Final note saved to LIS
  -> Audit trail stored
```

This approach gives us a safer path toward HIPAA-aware LIS integration and future agentic workflows.
