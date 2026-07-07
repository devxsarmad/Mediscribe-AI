import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { executeAgentTool } from "./agent-tools.service";
import { extractClinicalFacts } from "./clinical-extraction.service";
import { reviewClinicalSafety } from "./clinical-safety.service";
import { validateSoapAgainstSource } from "./clinical-validation.service";
import { suggestIcdCodes } from "./icd-suggestion.service";
import { generateContextAwareSoapNote } from "./soap.service";
import type {
  AgentToolAuditEvent,
  EncounterContextToolData,
  PatientContextToolData,
  PriorNotesToolData,
  RecentLabsToolData,
} from "../types/agent-tool.types";
import type {
  ClinicalAgentInput,
  ClinicalAgentNode,
  ClinicalAgentPreparedContext,
  ClinicalAgentState,
} from "../types/clinical-agent.types";
import { HttpError } from "../utils/http-error";

export type ClinicalAgentProgressEvent = {
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

type ClinicalAgentProgressHandler = (
  event: ClinicalAgentProgressEvent,
) => void | Promise<void>;

const ClinicalAgentAnnotation = Annotation.Root({
  goal: Annotation<string>(),
  patientId: Annotation<string>(),
  encounterId: Annotation<string>(),
  transcript: Annotation<string>(),
  patientContext: Annotation<ClinicalAgentState["patientContext"]>(),
  encounterContext: Annotation<ClinicalAgentState["encounterContext"]>(),
  labs: Annotation<ClinicalAgentState["labs"]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  priorNotes: Annotation<ClinicalAgentState["priorNotes"]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  clinicalFacts: Annotation<ClinicalAgentState["clinicalFacts"]>(),
  preparedContext: Annotation<ClinicalAgentState["preparedContext"]>(),
  generatedSoap: Annotation<ClinicalAgentState["generatedSoap"]>(),
  missingInformation: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  safetyWarnings: Annotation<ClinicalAgentState["safetyWarnings"]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  validationIssues: Annotation<ClinicalAgentState["validationIssues"]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  icdSuggestions: Annotation<ClinicalAgentState["icdSuggestions"]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  requiresDoctorApproval: Annotation<boolean>(),
  approvalStatus: Annotation<ClinicalAgentState["approvalStatus"]>(),
  currentNode: Annotation<ClinicalAgentNode>(),
  completedNodes: Annotation<ClinicalAgentNode[], ClinicalAgentNode[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  auditEvents: Annotation<AgentToolAuditEvent[], AgentToolAuditEvent[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

type LangGraphClinicalAgentState = typeof ClinicalAgentAnnotation.State;
type LangGraphClinicalAgentUpdate = typeof ClinicalAgentAnnotation.Update;

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${label} is required.`);
  }

  return value.trim();
}

export function normalizeClinicalAgentInput(input: unknown): ClinicalAgentInput {
  if (!input || typeof input !== "object") {
    throw new HttpError(400, "Clinical agent request body is required.");
  }

  const body = input as Record<string, unknown>;

  return {
    patientId: readRequiredString(body.patientId, "patientId"),
    encounterId: readRequiredString(body.encounterId, "encounterId"),
    transcript:
      typeof body.transcript === "string" ? body.transcript.trim() : "",
  };
}

function createInitialState(input: ClinicalAgentInput): ClinicalAgentState {
  return {
    goal: "Prepare clinical context for a doctor-reviewed SOAP note.",
    patientId: input.patientId,
    encounterId: input.encounterId,
    transcript: input.transcript || "",
    labs: [],
    priorNotes: [],
    clinicalFacts: undefined,
    generatedSoap: null,
    missingInformation: [],
    safetyWarnings: [],
    validationIssues: [],
    icdSuggestions: [],
    requiresDoctorApproval: true,
    approvalStatus: "pending",
    currentNode: "start",
    completedNodes: [],
    auditEvents: [],
  };
}

function summarizeList(values: string[]) {
  return values.length ? values.join("; ") : "None available.";
}

function summarizeClinicalFacts(
  facts: ClinicalAgentState["clinicalFacts"],
) {
  if (!facts) {
    return "Structured clinical facts unavailable.";
  }

  return [
    `Chief complaint: ${facts.chiefComplaint || "not stated"}`,
    `Duration: ${facts.duration || "not stated"}`,
    `Reported symptoms: ${summarizeList(facts.reportedSymptoms)}`,
    `Denied symptoms: ${summarizeList(facts.deniedSymptoms)}`,
    `Medications discussed: ${summarizeList(facts.medicationsDiscussed)}`,
    `Follow-up: ${summarizeList(facts.followUpInstructions)}`,
    `Missing information: ${summarizeList(facts.missingInformation)}`,
  ].join("\n");
}

function prepareContext(
  state: LangGraphClinicalAgentState,
): ClinicalAgentPreparedContext {
  const patient = state.patientContext;
  const encounter = state.encounterContext;
  const abnormalLabs = state.labs.filter((lab) => lab.flag !== "normal");

  return {
    patientSummary: patient
      ? `${patient.age} year old ${patient.sex}. Allergies: ${summarizeList(patient.allergies)} Active problems: ${summarizeList(patient.activeProblems)}`
      : "Patient context unavailable.",
    encounterSummary: encounter
      ? `${encounter.visitType} with ${encounter.providerName}. Reason: ${encounter.reasonForVisit}. Status: ${encounter.status}.`
      : "Encounter context unavailable.",
    labSummary: state.labs.length
      ? `${state.labs.length} recent lab result(s). Abnormal/highlighted: ${summarizeList(
          abnormalLabs.map(
            (lab) =>
              `${lab.testName} ${lab.value}${lab.unit ? ` ${lab.unit}` : ""} (${lab.flag})`,
          ),
        )}`
      : "No recent labs available.",
    priorNoteSummary: state.priorNotes.length
      ? state.priorNotes
          .map((note) => `${note.noteType}: ${note.summary}`)
          .join(" ")
      : "No prior notes available.",
    clinicalFactSummary: summarizeClinicalFacts(state.clinicalFacts),
    transcriptSummary: state.transcript || "No current transcript provided.",
  };
}

function detectMissingInformation(state: LangGraphClinicalAgentState) {
  const missing: string[] = [];

  if (!state.transcript) {
    missing.push("Current encounter transcript is missing.");
  }

  if (!state.patientContext) {
    missing.push("Patient context is missing.");
  }

  if (!state.encounterContext) {
    missing.push("Encounter context is missing.");
  }

  return missing;
}

function startNode(): LangGraphClinicalAgentUpdate {
  return {
    currentNode: "start",
    completedNodes: ["start"],
  };
}

async function loadPatientContextNode(
  state: LangGraphClinicalAgentState,
): Promise<LangGraphClinicalAgentUpdate> {
  const patientResult = await executeAgentTool("getPatientContext", {
    patientId: state.patientId,
  });

  return {
    patientContext: (patientResult.data as PatientContextToolData).patient,
    auditEvents: [patientResult.auditEvent],
    currentNode: "load_patient_context",
    completedNodes: ["load_patient_context"],
  };
}

async function loadEncounterContextNode(
  state: LangGraphClinicalAgentState,
): Promise<LangGraphClinicalAgentUpdate> {
  const encounterResult = await executeAgentTool("getEncounterContext", {
    encounterId: state.encounterId,
  });

  return {
    encounterContext: (encounterResult.data as EncounterContextToolData)
      .encounter,
    auditEvents: [encounterResult.auditEvent],
    currentNode: "load_encounter_context",
    completedNodes: ["load_encounter_context"],
  };
}

async function loadRecentLabsNode(
  state: LangGraphClinicalAgentState,
): Promise<LangGraphClinicalAgentUpdate> {
  const labsResult = await executeAgentTool("getRecentLabs", {
    patientId: state.patientId,
  });

  return {
    labs: (labsResult.data as RecentLabsToolData).labs,
    auditEvents: [labsResult.auditEvent],
    currentNode: "load_recent_labs",
    completedNodes: ["load_recent_labs"],
  };
}

async function loadPriorNotesNode(
  state: LangGraphClinicalAgentState,
): Promise<LangGraphClinicalAgentUpdate> {
  const priorNotesResult = await executeAgentTool("getPriorNotes", {
    patientId: state.patientId,
  });

  return {
    priorNotes: (priorNotesResult.data as PriorNotesToolData).notes,
    auditEvents: [priorNotesResult.auditEvent],
    currentNode: "load_prior_notes",
    completedNodes: ["load_prior_notes"],
  };
}

async function extractClinicalFactsNode(
  state: LangGraphClinicalAgentState,
): Promise<LangGraphClinicalAgentUpdate> {
  if (!state.transcript.trim()) {
    return {
      currentNode: "extract_clinical_facts",
      completedNodes: ["extract_clinical_facts"],
    };
  }

  return {
    clinicalFacts: await extractClinicalFacts(state.transcript),
    currentNode: "extract_clinical_facts",
    completedNodes: ["extract_clinical_facts"],
  };
}

function prepareContextNode(
  state: LangGraphClinicalAgentState,
): LangGraphClinicalAgentUpdate {
  return {
    preparedContext: prepareContext(state),
    missingInformation: detectMissingInformation(state),
    currentNode: "prepare_context",
    completedNodes: ["prepare_context"],
  };
}

function routeAfterPrepareContext(state: LangGraphClinicalAgentState) {
  if (!state.transcript.trim()) {
    return "doctor_clarification_required";
  }

  return "generate_context_aware_soap";
}

async function generateContextAwareSoapNode(
  state: LangGraphClinicalAgentState,
): Promise<LangGraphClinicalAgentUpdate> {
  if (!state.preparedContext) {
    throw new HttpError(500, "Prepared context is required before SOAP generation.");
  }

  const result = await generateContextAwareSoapNote({
    transcript: state.transcript,
    context: state.preparedContext,
  });

  return {
    generatedSoap: result.soap,
    currentNode: "generate_context_aware_soap",
    completedNodes: ["generate_context_aware_soap"],
  };
}

function reviewSafetyWarningsNode(
  state: LangGraphClinicalAgentState,
): LangGraphClinicalAgentUpdate {
  return {
    safetyWarnings: reviewClinicalSafety({
      facts: state.clinicalFacts,
      soap: state.generatedSoap,
    }),
    currentNode: "review_safety_warnings",
    completedNodes: ["review_safety_warnings"],
  };
}

function validateSoapClaimsNode(
  state: LangGraphClinicalAgentState,
): LangGraphClinicalAgentUpdate {
  return {
    validationIssues: validateSoapAgainstSource({
      transcript: state.transcript,
      facts: state.clinicalFacts,
      patient: state.patientContext,
      soap: state.generatedSoap,
    }),
    currentNode: "validate_soap_claims",
    completedNodes: ["validate_soap_claims"],
  };
}

async function suggestIcdCodesNode(
  state: LangGraphClinicalAgentState,
): Promise<LangGraphClinicalAgentUpdate> {
  return {
    icdSuggestions: await suggestIcdCodes({
      transcript: state.transcript,
      clinicalFacts: state.clinicalFacts,
      soap: state.generatedSoap,
      patient: state.patientContext,
    }),
    currentNode: "suggest_icd_codes",
    completedNodes: ["suggest_icd_codes"],
  };
}

function doctorClarificationRequiredNode(): LangGraphClinicalAgentUpdate {
  return {
    requiresDoctorApproval: true,
    approvalStatus: "pending",
    currentNode: "doctor_clarification_required",
    completedNodes: ["doctor_clarification_required"],
  };
}

function doctorReviewRequiredNode(): LangGraphClinicalAgentUpdate {
  return {
    requiresDoctorApproval: true,
    approvalStatus: "pending",
    currentNode: "doctor_review_required",
    completedNodes: ["doctor_review_required"],
  };
}

function endNode(): LangGraphClinicalAgentUpdate {
  return {
    currentNode: "end",
    completedNodes: ["end"],
  };
}

function createProgressEvent(input: {
  type: ClinicalAgentProgressEvent["type"];
  node?: ClinicalAgentNode;
  message: string;
  completedNodes?: ClinicalAgentNode[];
}): ClinicalAgentProgressEvent {
  return {
    ...input,
    timestamp: new Date().toISOString(),
  };
}

async function emitProgress(
  onProgress: ClinicalAgentProgressHandler | undefined,
  event: ClinicalAgentProgressEvent,
) {
  if (!onProgress) {
    return;
  }

  await onProgress(event);
}

function createProgressNode(
  node: ClinicalAgentNode,
  handler: (
    state: LangGraphClinicalAgentState,
  ) => LangGraphClinicalAgentUpdate | Promise<LangGraphClinicalAgentUpdate>,
  onProgress?: ClinicalAgentProgressHandler,
) {
  return async (state: LangGraphClinicalAgentState) => {
    await emitProgress(
      onProgress,
      createProgressEvent({
        type: "node_started",
        node,
        message: `${node} started.`,
      }),
    );

    const update = await handler(state);
    const completedNodes = Array.isArray(update.completedNodes)
      ? update.completedNodes
      : [];
    const completedNode =
      typeof update.currentNode === "string" ? update.currentNode : node;

    await emitProgress(
      onProgress,
      createProgressEvent({
        type: "node_completed",
        node: completedNode,
        message: `${completedNode} completed.`,
        completedNodes,
      }),
    );

    return update;
  };
}

function createClinicalAgentGraph(onProgress?: ClinicalAgentProgressHandler) {
  return new StateGraph(ClinicalAgentAnnotation)
    .addNode("start_node", createProgressNode("start", startNode, onProgress))
    .addNode(
      "load_patient_context",
      createProgressNode(
        "load_patient_context",
        loadPatientContextNode,
        onProgress,
      ),
    )
    .addNode(
      "load_encounter_context",
      createProgressNode(
        "load_encounter_context",
        loadEncounterContextNode,
        onProgress,
      ),
    )
    .addNode(
      "load_recent_labs",
      createProgressNode("load_recent_labs", loadRecentLabsNode, onProgress),
    )
    .addNode(
      "load_prior_notes",
      createProgressNode("load_prior_notes", loadPriorNotesNode, onProgress),
    )
    .addNode(
      "extract_clinical_facts",
      createProgressNode(
        "extract_clinical_facts",
        extractClinicalFactsNode,
        onProgress,
      ),
    )
    .addNode(
      "prepare_context",
      createProgressNode("prepare_context", prepareContextNode, onProgress),
    )
    .addNode(
      "generate_context_aware_soap",
      createProgressNode(
        "generate_context_aware_soap",
        generateContextAwareSoapNode,
        onProgress,
      ),
    )
    .addNode(
      "review_safety_warnings",
      createProgressNode(
        "review_safety_warnings",
        reviewSafetyWarningsNode,
        onProgress,
      ),
    )
    .addNode(
      "validate_soap_claims",
      createProgressNode(
        "validate_soap_claims",
        validateSoapClaimsNode,
        onProgress,
      ),
    )
    .addNode(
      "suggest_icd_codes",
      createProgressNode("suggest_icd_codes", suggestIcdCodesNode, onProgress),
    )
    .addNode(
      "doctor_clarification_required",
      createProgressNode(
        "doctor_clarification_required",
        doctorClarificationRequiredNode,
        onProgress,
      ),
    )
    .addNode(
      "doctor_review_required",
      createProgressNode(
        "doctor_review_required",
        doctorReviewRequiredNode,
        onProgress,
      ),
    )
    .addNode("end_node", createProgressNode("end", endNode, onProgress))
    .addEdge(START, "start_node")
    .addEdge("start_node", "load_patient_context")
    .addEdge("load_patient_context", "load_encounter_context")
    .addEdge("load_encounter_context", "load_recent_labs")
    .addEdge("load_recent_labs", "load_prior_notes")
    .addEdge("load_prior_notes", "extract_clinical_facts")
    .addEdge("extract_clinical_facts", "prepare_context")
    .addConditionalEdges("prepare_context", routeAfterPrepareContext, {
      generate_context_aware_soap: "generate_context_aware_soap",
      doctor_clarification_required: "doctor_clarification_required",
    })
    .addEdge("generate_context_aware_soap", "review_safety_warnings")
    .addEdge("review_safety_warnings", "validate_soap_claims")
    .addEdge("validate_soap_claims", "suggest_icd_codes")
    .addEdge("suggest_icd_codes", "doctor_review_required")
    .addEdge("doctor_clarification_required", "end_node")
    .addEdge("doctor_review_required", "end_node")
    .addEdge("end_node", END)
    .compile();
}

export async function runClinicalAgentGraph(
  input: ClinicalAgentInput,
  options: { onProgress?: ClinicalAgentProgressHandler } = {},
) {
  await emitProgress(
    options.onProgress,
    createProgressEvent({
      type: "graph_started",
      message: "Clinical agent graph started.",
    }),
  );

  const graph = createClinicalAgentGraph(options.onProgress);
  const state = await graph.invoke(createInitialState(input));
  const status = state.generatedSoap
    ? "doctor_review_required"
    : "doctor_clarification_required";

  await emitProgress(
    options.onProgress,
    createProgressEvent({
      type: "graph_completed",
      node: state.currentNode,
      message: "Clinical agent graph completed.",
      completedNodes: state.completedNodes,
    }),
  );

  return {
    agent: "langgraph-context-aware-soap-agent",
    status,
    state,
  };
}
