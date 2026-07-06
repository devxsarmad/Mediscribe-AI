import { env } from "../config/env";
import {
  isClinicalFactExtraction,
  type ClinicalFactExtraction,
} from "../types/clinical.types";
import { HttpError } from "../utils/http-error";
import { deidentifyTranscript } from "./deidentification.service";
import { getOpenAIClient } from "./openai.service";

export async function extractClinicalFacts(transcript: string) {
  const deidentification = deidentifyTranscript(transcript);
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
        content: `Extract clinical facts from a de-identified doctor-patient transcript.

Return valid JSON exactly:
- chiefComplaint: string
- duration: string
- reportedSymptoms: string[]
- deniedSymptoms: string[]
- medicationsDiscussed: string[]
- followUpInstructions: string[]
- missingInformation: string[]

Rules:
- Use only facts explicitly present in the transcript.
- Do not diagnose.
- Do not invent vitals, exam findings, medication names, dosage, or plans.
- Put unclear but clinically important missing items in missingInformation.`,
      },
      {
        role: "user",
        content: `Transcript:\n${sanitizedTranscript}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new HttpError(502, "LLM returned an empty clinical extraction response.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new HttpError(502, "LLM returned invalid JSON for clinical extraction.");
  }

  if (!isClinicalFactExtraction(parsed)) {
    throw new HttpError(502, "LLM clinical extraction response has invalid shape.");
  }

  return parsed satisfies ClinicalFactExtraction;
}
