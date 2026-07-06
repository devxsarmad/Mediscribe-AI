import { getLisAdapter } from "../adapters/lis";

export function getLisPatient(patientId: string) {
  return getLisAdapter().getPatient(patientId);
}

export function getLisEncounter(encounterId: string) {
  return getLisAdapter().getEncounter(encounterId);
}

export function getLisLabs(patientId: string) {
  return getLisAdapter().getRecentLabs(patientId);
}

export function getLisPriorNotes(patientId: string) {
  return getLisAdapter().getPriorNotes(patientId);
}

export function listLisPatients() {
  return getLisAdapter().listPatients();
}
