const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  "http://localhost:4000";

type ApiErrorResponse = {
  error?: {
    message?: string;
    statusCode?: number;
  };
};

export type TranscriptionResponse = {
  transcript: string;
  model: string;
  source: {
    filename: string;
    mimeType: string;
    size: number;
  };
};

export type SoapNote = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type SoapEditSummary = {
  changedSections: (keyof SoapNote)[];
  hasDoctorEdits: boolean;
};

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

export type IcdCodeSuggestion = {
  code: string;
  label: string;
  confidence: "low" | "medium" | "high";
  reason: string;
  source: "transcript" | "soap" | "patient_context";
};

export type SoapGenerationResponse = {
  clinical: ClinicalExtraction;
  soap: SoapNote;
  sanitizedTranscript: string;
  deidentifiedTranscript?: string;
  phiTokens?: Array<{
    token: string;
    category: string;
    source: string;
    confidence: number;
  }>;
  model: string;
};

export type PatientContext = {
  patientLabel: string;
  mrnLabel: string;
  ageRange: string;
  visitType: string;
};

export type LisPatient = {
  id: string;
  mrn: string;
  displayName: string;
  age: number;
  sex: "female" | "male" | "other" | "unknown";
  dateOfBirth: string;
  phone: string;
  address: string;
  allergies: string[];
  activeProblems: string[];
};

export type LisPatientsResponse = {
  patients: LisPatient[];
  meta?: {
    patientSource: "real_lis" | "mock";
    clinicalContextSource: "real_lis" | "mock" | "temporary";
    mode: "mock" | "real_patient_hybrid";
    note: string;
  };
};

export type SavedNote = {
  id: string;
  patientContext: PatientContext;
  transcript: string;
  soap: SoapNote;
  doctorEditSummary?: SoapEditSummary | null;
  icdSuggestions?: IcdCodeSuggestion[];
  status: "draft" | "generated" | "reviewed" | "saved";
  reviewedAt: string;
  savedAt: string;
  createdAt: string;
  updatedAt: string;
  source?: {
    audioCaptured?: boolean;
    transcriptionModel?: string;
    soapModel?: string;
  };
};

export type SavedNotesResponse = {
  notes: SavedNote[];
};

export type ClinicalAgentAuditEvent = {
  timestamp: string;
  tool: string;
  status: "success" | "error";
  patientId?: string;
  encounterId?: string;
  message: string;
};

export type ClinicalAgentState = {
  goal: string;
  patientId: string;
  encounterId: string;
  transcript: string;
  patientContext?: unknown;
  encounterContext?: unknown;
  labs: unknown[];
  priorNotes: unknown[];
  clinicalFacts?: ClinicalFactExtraction;
  preparedContext?: unknown;
  generatedSoap: SoapNote | null;
  missingInformation: string[];
  safetyWarnings: {
    code: string;
    severity: "info" | "warning";
    message: string;
  }[];
  validationIssues: {
    code: string;
    section: keyof SoapNote;
    severity: "info" | "warning";
    message: string;
  }[];
  icdSuggestions: IcdCodeSuggestion[];
  requiresDoctorApproval: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  currentNode: string;
  completedNodes: string[];
  auditEvents: ClinicalAgentAuditEvent[];
};

export type ClinicalAgentRun = {
  id: string;
  agent: string;
  patientId: string;
  encounterId: string;
  status: string;
  approvalStatus: string;
  state: ClinicalAgentState;
  approvedSoap?: SoapNote | null;
  doctorEditSummary?: SoapEditSummary | null;
  approvedAt?: string | null;
  savedNoteId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClinicalAgentProgressEvent = {
  type:
    | "graph_started"
    | "node_started"
    | "node_completed"
    | "graph_completed";
  node?: string;
  message: string;
  timestamp: string;
  completedNodes?: string[];
};

type GenerateSoapNoteInput = {
  transcript: string;
  phiContext?: {
    names?: string[];
    ids?: string[];
    contacts?: string[];
    locations?: string[];
    ages?: string[];
  };
};

type SaveReviewedNoteInput = {
  patientContext: PatientContext;
  transcript: string;
  soap: SoapNote;
  reviewedAt: string;
  source?: {
    audioCaptured?: boolean;
    transcriptionModel?: string;
    soapModel?: string;
  };
};

type CreateClinicalAgentRunInput = {
  patientId: string;
  encounterId: string;
  transcript: string;
};

type ApproveClinicalAgentRunInput = {
  soap?: SoapNote;
  reviewedAt?: string;
};

type ApproveClinicalAgentRunResponse = {
  run: ClinicalAgentRun;
  savedNote: SavedNote;
};

type RegenerateIcdSuggestionsResponse = {
  run: ClinicalAgentRun;
  icdSuggestions: IcdCodeSuggestion[];
};

type StreamEventHandler = (event: ClinicalAgentProgressEvent) => void;

async function parseApiError(response: Response) {
  try {
    const data = (await response.json()) as ApiErrorResponse;
    return data.error?.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes("webm")) {
    return "webm";
  }

  if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
    return "m4a";
  }

  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
    return "mp3";
  }

  if (mimeType.includes("wav")) {
    return "wav";
  }

  return "webm";
}

export async function apiGet<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json() as Promise<TResponse>;
}

export async function transcribeAudio(blob: Blob): Promise<TranscriptionResponse> {
  const formData = new FormData();
  const mimeType = blob.type || "audio/webm";
  const extension = getAudioExtension(mimeType);

  formData.append("audio", blob, `recording.${extension}`);

  const response = await fetch(`${API_BASE_URL}/api/v1/transcriptions`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json() as Promise<TranscriptionResponse>;
}

export async function generateSoapNote(
  input: GenerateSoapNoteInput,
): Promise<SoapGenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/soap-notes`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json() as Promise<SoapGenerationResponse>;
}

export async function saveReviewedNote(
  input: SaveReviewedNoteInput,
): Promise<SavedNote> {
  const response = await fetch(`${API_BASE_URL}/api/v1/notes`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json() as Promise<SavedNote>;
}

function parseStreamBlock(block: string) {
  const eventLine = block
    .split("\n")
    .find((line) => line.startsWith("event:"));
  const dataLine = block
    .split("\n")
    .find((line) => line.startsWith("data:"));

  if (!eventLine || !dataLine) {
    return null;
  }

  return {
    event: eventLine.replace(/^event:\s*/, "").trim(),
    data: JSON.parse(dataLine.replace(/^data:\s*/, "")) as unknown,
  };
}

export async function createClinicalAgentRunStream(
  input: CreateClinicalAgentRunInput,
  onEvent: StreamEventHandler,
): Promise<ClinicalAgentRun> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/clinical-agent/runs/stream`,
    {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  if (!response.body) {
    throw new Error("Agent stream is not available in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let run: ClinicalAgentRun | null = null;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      const parsed = parseStreamBlock(block.trim());

      if (!parsed) {
        continue;
      }

      if (parsed.event === "agent_event") {
        onEvent(parsed.data as ClinicalAgentProgressEvent);
      }

      if (parsed.event === "agent_run") {
        run = parsed.data as ClinicalAgentRun;
      }

      if (parsed.event === "error") {
        const errorData = parsed.data as { message?: string };
        throw new Error(errorData.message || "Clinical agent stream failed.");
      }
    }
  }

  if (!run) {
    throw new Error("Clinical agent stream ended without a run result.");
  }

  return run;
}

export async function approveClinicalAgentRun(
  runId: string,
  input: ApproveClinicalAgentRunInput,
): Promise<ApproveClinicalAgentRunResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/clinical-agent/runs/${runId}/approve`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json() as Promise<ApproveClinicalAgentRunResponse>;
}

export async function regenerateClinicalAgentIcdSuggestions(
  runId: string,
  input: { soap: SoapNote },
): Promise<RegenerateIcdSuggestionsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/clinical-agent/runs/${runId}/icd-suggestions`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json() as Promise<RegenerateIcdSuggestionsResponse>;
}

export async function listSavedNotes(): Promise<SavedNotesResponse> {
  return apiGet<SavedNotesResponse>("/api/v1/notes");
}

export async function listLisPatients(): Promise<LisPatientsResponse> {
  return apiGet<LisPatientsResponse>("/api/v1/lis/patients");
}

export { API_BASE_URL };
