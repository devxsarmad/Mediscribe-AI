import type {
  ClinicalFactExtraction,
  ClinicalValidationIssue,
} from "../types/clinical.types";
import type { LisPatient } from "../types/lis.types";
import type { SoapNote } from "../types/soap.types";

const DIAGNOSIS_LANGUAGE = [
  "likely",
  "possible",
  "consistent with",
  "suggestive of",
  "diagnosis",
  "migraine",
  "tension",
  "viral infection",
  "bacterial infection",
  "pneumonia",
  "diabetes",
  "hypertension",
];

const OBJECTIVE_CLAIMS = [
  "observed",
  "exam",
  "vital",
  "temperature",
  "blood pressure",
  "pulse",
  "respiratory",
  "oxygen",
  "normal appearance",
];

const TREATMENT_TERMS = [
  "prescribe",
  "start",
  "take",
  "dose",
  "mg",
  "antibiotic",
  "steroid",
  "follow up",
  "return",
  "rest",
  "fluids",
  "hydration",
];

function normalize(value: string) {
  return value.toLowerCase();
}

function includesAny(text: string, terms: string[]) {
  const normalized = normalize(text);

  return terms.find((term) => normalized.includes(term));
}

function hasTranscriptSupport(term: string, transcript: string, patient?: LisPatient) {
  const normalizedTerm = normalize(term);
  const supportedByTranscript = normalize(transcript).includes(normalizedTerm);
  const supportedByProblems =
    patient?.activeProblems.some((problem) =>
      normalize(problem).includes(normalizedTerm),
    ) ?? false;

  return supportedByTranscript || supportedByProblems;
}

function pushUnique(
  issues: ClinicalValidationIssue[],
  issue: ClinicalValidationIssue,
) {
  if (issues.some((item) => item.code === issue.code && item.section === issue.section)) {
    return;
  }

  issues.push(issue);
}

export function validateSoapAgainstSource(input: {
  transcript: string;
  facts?: ClinicalFactExtraction;
  patient?: LisPatient;
  soap?: SoapNote | null;
}) {
  const issues: ClinicalValidationIssue[] = [];

  if (!input.soap) {
    return issues;
  }

  const soap = input.soap;
  const assessmentTerm = includesAny(
    soap.assessment,
    DIAGNOSIS_LANGUAGE,
  );

  if (
    assessmentTerm &&
    !hasTranscriptSupport(assessmentTerm, input.transcript, input.patient)
  ) {
    pushUnique(issues, {
      code: "unsupported_assessment_language",
      section: "assessment",
      severity: "warning",
      message:
        "Assessment contains diagnostic language that is not clearly supported by the transcript.",
    });
  }

  const objectiveTerm = includesAny(soap.objective, OBJECTIVE_CLAIMS);

  if (objectiveTerm && !hasTranscriptSupport(objectiveTerm, input.transcript)) {
    pushUnique(issues, {
      code: "unsupported_objective_finding",
      section: "objective",
      severity: "warning",
      message:
        "Objective section may contain findings that were not documented in the conversation.",
    });
  }

  const planTerm = includesAny(soap.plan, TREATMENT_TERMS);

  if (planTerm && !hasTranscriptSupport(planTerm, input.transcript)) {
    pushUnique(issues, {
      code: "unsupported_plan_item",
      section: "plan",
      severity: "warning",
      message:
        "Plan contains an instruction or treatment item that was not clearly stated by the doctor.",
    });
  }

  if (
    input.facts?.deniedSymptoms.some((symptom) =>
      normalize(soap.assessment).includes(normalize(symptom)),
    )
  ) {
    pushUnique(issues, {
      code: "denied_symptom_in_assessment",
      section: "assessment",
      severity: "info",
      message:
        "Assessment references a denied symptom; doctor should confirm the wording before saving.",
    });
  }

  return issues;
}
