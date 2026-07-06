export type ClinicalExtraction = {
  clinicalSummary: string;
  symptoms: string[];
  medications: string[];
};

export type ClinicalFactExtraction = {
  chiefComplaint: string;
  duration: string;
  reportedSymptoms: string[];
  deniedSymptoms: string[];
  medicationsDiscussed: string[];
  followUpInstructions: string[];
  missingInformation: string[];
};

export function isClinicalExtraction(value: unknown): value is ClinicalExtraction {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.clinicalSummary === "string" &&
    Array.isArray(record.symptoms) &&
    record.symptoms.every((item) => typeof item === "string") &&
    Array.isArray(record.medications) &&
    record.medications.every((item) => typeof item === "string")
  );
}

function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isClinicalFactExtraction(
  value: unknown,
): value is ClinicalFactExtraction {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.chiefComplaint === "string" &&
    typeof record.duration === "string" &&
    isStringArray(record.reportedSymptoms) &&
    isStringArray(record.deniedSymptoms) &&
    isStringArray(record.medicationsDiscussed) &&
    isStringArray(record.followUpInstructions) &&
    isStringArray(record.missingInformation)
  );
}

export function toReviewableSoapNote(extraction: ClinicalExtraction) {
  const symptomsText = extraction.symptoms.length
    ? extraction.symptoms.map((symptom) => `- ${symptom}`).join("\n")
    : "- None documented";

  const medicationsText = extraction.medications.length
    ? extraction.medications.map((medication) => `- ${medication}`).join("\n")
    : "- None documented";

  return {
    subjective: `${extraction.clinicalSummary}\n\nSymptoms:\n${symptomsText}`,
    objective:
      "Objective findings require physician documentation. AI does not infer vitals or exam results.",
    assessment:
      "Pending physician review. AI does not provide diagnoses or differential diagnoses.",
    plan: `Medications mentioned:\n${medicationsText}\n\nTreatment planning requires physician review. AI does not provide treatment advice.`,
  };
}
