import { env } from "../config/env";
import {
  isIcdCodeSuggestionArray,
  type ClinicalFactExtraction,
  type IcdCodeSuggestion,
} from "../types/clinical.types";
import type { LisPatient } from "../types/lis.types";
import type { SoapNote } from "../types/soap.types";
import { HttpError } from "../utils/http-error";
import { deidentifyTranscript } from "./deidentification.service";
import { getOpenAIClient } from "./openai.service";

export async function suggestIcdCodes(input: {
  transcript: string;
  clinicalFacts?: ClinicalFactExtraction;
  soap?: SoapNote | null;
  patient?: LisPatient;
}) {
  const sanitizedTranscript = deidentifyTranscript(input.transcript)
    .deidentifiedText;

  if (!sanitizedTranscript.trim()) {
    return [] satisfies IcdCodeSuggestion[];
  }

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: env.soapModel,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You suggest ICD-10-CM codes for doctor review only.

Return valid JSON exactly:
- suggestions: array of objects with:
  - code: string
  - label: string
  - confidence: "low" | "medium" | "high"
  - reason: string
  - source: "transcript" | "soap" | "patient_context"

Rules:
- Suggest at most 5 ICD-10-CM codes.
- Use only the de-identified transcript, structured facts, SOAP draft, and patient context provided.
- Prefer symptom codes when the doctor did not explicitly state a diagnosis.
- Do not create billing-final codes.
- Do not use high confidence unless the doctor explicitly stated the diagnosis.
- If evidence is weak, return an empty suggestions array.
- Never include personal identifiers.`,
      },
      {
        role: "user",
        content: `Transcript:
${sanitizedTranscript}

Structured facts:
${JSON.stringify(input.clinicalFacts || null)}

SOAP draft:
${JSON.stringify(input.soap || null)}

Patient context:
${JSON.stringify({
  age: input.patient?.age,
  sex: input.patient?.sex,
  activeProblems: input.patient?.activeProblems || [],
  allergies: input.patient?.allergies || [],
})}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new HttpError(502, "LLM returned an empty ICD suggestion response.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new HttpError(502, "LLM returned invalid JSON for ICD suggestions.");
  }

  const suggestions = (parsed as { suggestions?: unknown }).suggestions;

  if (!isIcdCodeSuggestionArray(suggestions)) {
    throw new HttpError(502, "LLM ICD suggestion response has invalid shape.");
  }

  return suggestions.slice(0, 5);
}
