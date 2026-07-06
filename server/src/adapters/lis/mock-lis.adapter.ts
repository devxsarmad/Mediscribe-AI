import type { LisAdapter } from "./lis-adapter.types";
import type {
  LisEncounter,
  LisLabResult,
  LisPatient,
  LisPriorNote,
} from "../../types/lis.types";
import { HttpError } from "../../utils/http-error";

const patients: LisPatient[] = [
  {
    id: "patient-001",
    mrn: "MS-10294",
    displayName: "Ayesha Khan",
    age: 34,
    sex: "female",
    dateOfBirth: "1992-03-14",
    phone: "+1-555-0101",
    address: "Mock address, Dallas, TX",
    allergies: ["Penicillin"],
    activeProblems: ["Seasonal allergies", "Recurrent upper respiratory symptoms"],
  },
  {
    id: "patient-002",
    mrn: "MS-20481",
    displayName: "John Doe",
    age: 52,
    sex: "male",
    dateOfBirth: "1974-09-02",
    phone: "+1-555-0188",
    address: "Mock address, Austin, TX",
    allergies: [],
    activeProblems: ["Type 2 diabetes", "Hyperlipidemia"],
  },
];

const encounters: LisEncounter[] = [
  {
    id: "encounter-001",
    patientId: "patient-001",
    status: "in_progress",
    visitType: "Primary care",
    providerName: "Dr. Sarah Malik",
    location: "LIS Clinic Room 3",
    startedAt: "2026-06-30T09:00:00.000Z",
    reasonForVisit: "Fever and cough for three days",
  },
  {
    id: "encounter-002",
    patientId: "patient-002",
    status: "scheduled",
    visitType: "Follow-up",
    providerName: "Dr. Sarah Malik",
    location: "LIS Clinic Room 1",
    startedAt: "2026-06-30T13:30:00.000Z",
    reasonForVisit: "Diabetes lab review",
  },
];

const labResults: LisLabResult[] = [
  {
    id: "lab-001",
    patientId: "patient-001",
    panel: "CBC",
    testName: "WBC",
    value: "11.8",
    unit: "10^3/uL",
    referenceRange: "4.0-10.5",
    flag: "high",
    collectedAt: "2026-06-29T08:15:00.000Z",
    resultedAt: "2026-06-29T10:22:00.000Z",
  },
  {
    id: "lab-002",
    patientId: "patient-001",
    panel: "Respiratory Panel",
    testName: "Influenza A/B",
    value: "Negative",
    unit: "",
    referenceRange: "Negative",
    flag: "normal",
    collectedAt: "2026-06-29T08:20:00.000Z",
    resultedAt: "2026-06-29T11:05:00.000Z",
  },
  {
    id: "lab-003",
    patientId: "patient-002",
    panel: "Metabolic",
    testName: "HbA1c",
    value: "7.9",
    unit: "%",
    referenceRange: "<5.7",
    flag: "high",
    collectedAt: "2026-06-25T08:00:00.000Z",
    resultedAt: "2026-06-25T12:10:00.000Z",
  },
];

const priorNotes: LisPriorNote[] = [
  {
    id: "prior-note-001",
    patientId: "patient-001",
    encounterId: "encounter-previous-001",
    noteType: "SOAP",
    authoredBy: "Dr. Sarah Malik",
    createdAt: "2026-03-12T15:40:00.000Z",
    summary: "Seen for nasal congestion and dry cough.",
    assessment: "Likely allergic rhinitis with postnasal drip.",
    plan: "Started antihistamine, nasal saline, and follow-up if fever develops.",
  },
  {
    id: "prior-note-002",
    patientId: "patient-002",
    encounterId: "encounter-previous-002",
    noteType: "Lab Review",
    authoredBy: "Dr. Sarah Malik",
    createdAt: "2026-04-08T10:15:00.000Z",
    summary: "Reviewed diabetes control and lipid panel.",
    assessment: "Diabetes above goal, hyperlipidemia stable.",
    plan: "Reinforced diet changes and medication adherence.",
  },
];

function findPatient(patientId: string) {
  const patient = patients.find((item) => item.id === patientId);

  if (!patient) {
    throw new HttpError(404, `Mock LIS patient not found: ${patientId}`);
  }

  return patient;
}

export const mockLisAdapter: LisAdapter = {
  async listPatients() {
    return {
      patients,
    };
  },
  async getPatient(patientId) {
    return {
      patient: findPatient(patientId),
    };
  },
  async getEncounter(encounterId) {
    const encounter = encounters.find((item) => item.id === encounterId);

    if (!encounter) {
      throw new HttpError(404, `Mock LIS encounter not found: ${encounterId}`);
    }

    return {
      encounter,
    };
  },
  async getRecentLabs(patientId) {
    findPatient(patientId);

    return {
      patientId,
      labs: labResults.filter((item) => item.patientId === patientId),
    };
  },
  async getPriorNotes(patientId) {
    findPatient(patientId);

    return {
      patientId,
      notes: priorNotes.filter((item) => item.patientId === patientId),
    };
  },
};
