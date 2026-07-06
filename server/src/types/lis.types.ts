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

export type LisEncounter = {
  id: string;
  patientId: string;
  status: "scheduled" | "in_progress" | "completed";
  visitType: string;
  providerName: string;
  location: string;
  startedAt: string;
  reasonForVisit: string;
};

export type LisLabResult = {
  id: string;
  patientId: string;
  panel: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: "normal" | "high" | "low" | "critical" | "abnormal";
  collectedAt: string;
  resultedAt: string;
};

export type LisPriorNote = {
  id: string;
  patientId: string;
  encounterId: string;
  noteType: "SOAP" | "Lab Review" | "Follow-up";
  authoredBy: string;
  createdAt: string;
  summary: string;
  assessment: string;
  plan: string;
};
