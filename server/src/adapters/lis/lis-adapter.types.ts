import type {
  LisEncounter,
  LisLabResult,
  LisPatient,
  LisPriorNote,
} from "../../types/lis.types";

export type LisAdapterMeta = {
  patientSource: "real_lis" | "mock";
  clinicalContextSource: "real_lis" | "mock" | "temporary";
  mode: "mock" | "real_patient_hybrid";
  note: string;
};

export type LisAdapter = {
  listPatients(): Promise<{ patients: LisPatient[]; meta?: LisAdapterMeta }>;
  getPatient(patientId: string): Promise<{ patient: LisPatient; meta?: LisAdapterMeta }>;
  getEncounter(encounterId: string): Promise<{ encounter: LisEncounter }>;
  getRecentLabs(patientId: string): Promise<{ patientId: string; labs: LisLabResult[] }>;
  getPriorNotes(patientId: string): Promise<{ patientId: string; notes: LisPriorNote[] }>;
};
