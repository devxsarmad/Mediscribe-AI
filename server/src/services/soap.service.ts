import { env } from "../config/env";
import {
  isClinicalExtraction,
  toReviewableSoapNote,
} from "../types/clinical.types";
import type { ClinicalAgentPreparedContext } from "../types/clinical-agent.types";
import type { PhiContext } from "../types/phi.types";
import { isSoapNote } from "../types/soap.types";
import { HttpError } from "../utils/http-error";
import {
  deidentifyTranscript,
  toPublicPhiTokens,
} from "./deidentification.service";
import { getOpenAIClient } from "./openai.service";

const CLINICAL_SYSTEM_PROMPT = `You are a healthcare scribing assistant.

The input transcript has already been de-identified. Treat all placeholders literally:
- PATIENT_001, PATIENT_002, etc.
- ID_001, ID_002, etc.
- CONTACT_001, CONTACT_002, etc.
- LOCATION_001, LOCATION_002, etc.
- AGE_001, AGE_002, etc.
- DATE_001, DATE_002, etc.
- PROVIDER_001, PROVIDER_002, etc.

Convert the sanitized transcript into valid JSON with exactly:
- clinicalSummary: string
- symptoms: string[]
- medications: string[]

Rules:
- Use only information present in the sanitized transcript.
- Produce a concise structured clinical summary in neutral medical language.
- List reported symptoms as short bullet-ready strings.
- List medications only if explicitly mentioned; otherwise return an empty array.
- Do NOT diagnose, differential diagnose, or provide treatment advice.
- Do NOT invent symptoms, medications, exam findings, or plans.
- Never include or recreate personal identifiers.`;

type GenerateSoapNoteInput = {
  transcript: string;
  phiContext?: PhiContext;
};

type GenerateContextAwareSoapInput = {
  transcript: string;
  context: ClinicalAgentPreparedContext;
  phiContext?: PhiContext;
};

export async function generateSoapNote(input: GenerateSoapNoteInput) {
  const deidentification = deidentifyTranscript(
    input.transcript,
    input.phiContext,
  );
  const sanitizedTranscript = deidentification.deidentifiedText;

  if (!sanitizedTranscript) {
    throw new HttpError(400, "Transcript is empty after PHI de-identification.");
  }

  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: env.soapModel,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CLINICAL_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Sanitized transcript:\n${sanitizedTranscript}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new HttpError(502, "LLM returned an empty clinical summary response.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new HttpError(502, "LLM returned invalid JSON for clinical summary.");
  }

  if (!isClinicalExtraction(parsed)) {
    throw new HttpError(
      502,
      "LLM response is missing required fields: clinicalSummary, symptoms, medications.",
    );
  }

  const clinical = parsed;
  const soap = toReviewableSoapNote(clinical);

  return {
    clinical,
    soap,
    sanitizedTranscript,
    deidentifiedTranscript: sanitizedTranscript,
    phiTokens: toPublicPhiTokens(deidentification.tokens),
    model: env.soapModel,
  };
}

export async function generateContextAwareSoapNote(
  input: GenerateContextAwareSoapInput,
) {
  const deidentification = deidentifyTranscript(
    input.transcript,
    input.phiContext,
  );
  const sanitizedTranscript = deidentification.deidentifiedText;

  if (!sanitizedTranscript) {
    throw new HttpError(400, "Transcript is empty after PHI de-identification.");
  }

  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: env.soapModel,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a healthcare scribing assistant.

Create a doctor-reviewable SOAP note as valid JSON with exactly:
- subjective: string
- objective: string
- assessment: string
- plan: string

Rules:
- Use the sanitized transcript as the primary source for the encounter.
- Use the provided LIS context only as supporting context.
- Do not include patient names, MRNs, phone numbers, addresses, or direct identifiers.
- Do not invent vitals, exam findings, diagnoses, or treatments.
- If labs or prior notes are relevant, summarize them cautiously as context.
- Assessment and plan must remain pending physician review.
- The final note must be safe for doctor editing and approval.`,
      },
      {
        role: "user",
        content: `Sanitized transcript:
${sanitizedTranscript}

Minimized LIS context:
Patient: ${input.context.patientSummary}
Encounter: ${input.context.encounterSummary}
Recent labs: ${input.context.labSummary}
Prior notes: ${input.context.priorNoteSummary}
Structured clinical facts:
${input.context.clinicalFactSummary}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new HttpError(502, "LLM returned an empty SOAP response.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new HttpError(502, "LLM returned invalid JSON for SOAP note.");
  }

  if (!isSoapNote(parsed)) {
    throw new HttpError(
      502,
      "LLM response is missing required SOAP fields: subjective, objective, assessment, plan.",
    );
  }

  return {
    soap: parsed,
    sanitizedTranscript,
    deidentifiedTranscript: sanitizedTranscript,
    phiTokens: toPublicPhiTokens(deidentification.tokens),
    model: env.soapModel,
  };
}
