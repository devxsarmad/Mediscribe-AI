import type {
  LisEncounter,
  LisLabResult,
  LisPatient,
  LisPriorNote,
} from "./lis.types";

export type AgentToolName =
  | "getPatientContext"
  | "getEncounterContext"
  | "getRecentLabs"
  | "getPriorNotes";

export type AgentToolCallInput = {
  patientId?: string;
  encounterId?: string;
};

export type AgentToolAuditEvent = {
  timestamp: string;
  tool: AgentToolName;
  status: "success" | "error";
  patientId?: string;
  encounterId?: string;
  message: string;
};

export type AgentToolResult<TData> = {
  tool: AgentToolName;
  data: TData;
  auditEvent: AgentToolAuditEvent;
};

export type PatientContextToolData = {
  patient: LisPatient;
};

export type EncounterContextToolData = {
  encounter: LisEncounter;
};

export type RecentLabsToolData = {
  patientId: string;
  labs: LisLabResult[];
};

export type PriorNotesToolData = {
  patientId: string;
  notes: LisPriorNote[];
};
