import type {
  ClinicalFactExtraction,
  ClinicalSafetyWarning,
} from "../types/clinical.types";
import type { SoapNote } from "../types/soap.types";

function hasOnlyGenericMedication(value: string) {
  const normalized = value.toLowerCase().trim();

  return ["medicine", "medication", "tablet", "painkiller"].some(
    (term) => normalized === term || normalized.includes(`this ${term}`),
  );
}

function normalizeMissingInformation(item: string) {
  const normalized = item.toLowerCase();

  if (
    normalized.includes("medication") ||
    normalized.includes("medicine") ||
    normalized.includes("tablet") ||
    normalized.includes("dose")
  ) {
    return "Medication details are missing; doctor must confirm name, dose, route, and frequency.";
  }

  return item.trim().replace(/^[,.;:\s-]+/, "");
}

function pushUnique(
  warnings: ClinicalSafetyWarning[],
  warning: ClinicalSafetyWarning,
) {
  if (warnings.some((item) => item.message === warning.message)) {
    return;
  }

  warnings.push(warning);
}

export function reviewClinicalSafety(input: {
  facts?: ClinicalFactExtraction;
  soap?: SoapNote | null;
}) {
  const warnings: ClinicalSafetyWarning[] = [];
  const facts = input.facts;

  if (!facts) {
    warnings.push({
      code: "clinical_facts_missing",
      severity: "warning",
      message: "Structured clinical facts were not extracted from the transcript.",
    });

    return warnings;
  }

  for (const item of facts.missingInformation) {
    pushUnique(warnings, {
      code: "missing_information",
      severity: "warning",
      message: normalizeMissingInformation(item),
    });
  }

  if (!facts.duration.trim()) {
    pushUnique(warnings, {
      code: "duration_missing",
      severity: "warning",
      message: "Symptom duration is missing and should be confirmed.",
    });
  }

  if (!facts.reportedSymptoms.length) {
    pushUnique(warnings, {
      code: "symptoms_missing",
      severity: "warning",
      message: "No reported symptoms were extracted from the encounter.",
    });
  }

  if (facts.medicationsDiscussed.some(hasOnlyGenericMedication)) {
    pushUnique(warnings, {
      code: "medication_name_missing",
      severity: "warning",
      message:
        "Medication details are missing; doctor must confirm name, dose, route, and frequency.",
    });
  }

  if (!input.soap?.objective.trim()) {
    pushUnique(warnings, {
      code: "objective_missing",
      severity: "info",
      message: "Objective findings are empty and may need vitals or exam details.",
    });
  }

  return warnings;
}
