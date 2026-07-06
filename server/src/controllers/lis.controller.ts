import type { Request, Response } from "express";
import {
  getLisEncounter as readLisEncounter,
  getLisLabs as readLisLabs,
  getLisPatient as readLisPatient,
  getLisPriorNotes as readLisPriorNotes,
  listLisPatients as readLisPatients,
} from "../services/lis.service";
import { HttpError } from "../utils/http-error";

function readParam(value: string | string[] | undefined, label: string) {
  if (!value || Array.isArray(value)) {
    throw new HttpError(400, `${label} is required.`);
  }

  return value;
}

export async function getLisPatients(_req: Request, res: Response) {
  res.json(await readLisPatients());
}

export async function getLisPatient(req: Request, res: Response) {
  const patientId = readParam(req.params.patientId, "patientId");

  res.json(await readLisPatient(patientId));
}

export async function getLisEncounter(req: Request, res: Response) {
  const encounterId = readParam(req.params.encounterId, "encounterId");

  res.json(await readLisEncounter(encounterId));
}

export async function getLisPatientLabs(req: Request, res: Response) {
  const patientId = readParam(req.params.patientId, "patientId");

  res.json(await readLisLabs(patientId));
}

export async function getLisPatientNotes(req: Request, res: Response) {
  const patientId = readParam(req.params.patientId, "patientId");

  res.json(await readLisPriorNotes(patientId));
}
