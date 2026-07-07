import type { AgentToolAuditEvent } from "./agent-tool.types";
import type {
  ClinicalFactExtraction,
  ClinicalSafetyWarning,
  ClinicalValidationIssue,
  IcdCodeSuggestion,
} from "./clinical.types";
import type {
  LisEncounter,
  LisLabResult,
  LisPatient,
  LisPriorNote,
} from "./lis.types";
import type { SoapNote } from "./soap.types";

export type ClinicalAgentNode =
  | "start"
  | "load_patient_context"
  | "load_encounter_context"
  | "load_recent_labs"
  | "load_prior_notes"
  | "extract_clinical_facts"
  | "prepare_context"
  | "generate_context_aware_soap"
  | "review_safety_warnings"
  | "validate_soap_claims"
  | "suggest_icd_codes"
  | "doctor_clarification_required"
  | "doctor_review_required"
  | "end";

export type ClinicalAgentInput = {
  patientId: string;
  encounterId: string;
  transcript?: string;
};

export type ClinicalAgentPreparedContext = {
  patientSummary: string;
  encounterSummary: string;
  labSummary: string;
  priorNoteSummary: string;
  clinicalFactSummary: string;
  transcriptSummary: string;
};

export type ClinicalAgentState = {
  goal: string;
  patientId: string;
  encounterId: string;
  transcript: string;
  patientContext?: LisPatient;
  encounterContext?: LisEncounter;
  labs: LisLabResult[];
  priorNotes: LisPriorNote[];
  clinicalFacts?: ClinicalFactExtraction;
  preparedContext?: ClinicalAgentPreparedContext;
  generatedSoap: SoapNote | null;
  missingInformation: string[];
  safetyWarnings: ClinicalSafetyWarning[];
  validationIssues: ClinicalValidationIssue[];
  icdSuggestions: IcdCodeSuggestion[];
  requiresDoctorApproval: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  currentNode: ClinicalAgentNode;
  completedNodes: ClinicalAgentNode[];
  auditEvents: AgentToolAuditEvent[];
};
