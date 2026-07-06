import { Router } from "express";
import {
  getLisEncounter,
  getLisPatient,
  getLisPatientLabs,
  getLisPatientNotes,
  getLisPatients,
} from "../controllers/lis.controller";
import { asyncHandler } from "../middleware/async-handler";

export const lisRouter = Router();

lisRouter.get("/lis/patients", asyncHandler(getLisPatients));
lisRouter.get("/lis/patients/:patientId", asyncHandler(getLisPatient));
lisRouter.get("/lis/encounters/:encounterId", asyncHandler(getLisEncounter));
lisRouter.get("/lis/patients/:patientId/labs", asyncHandler(getLisPatientLabs));
lisRouter.get("/lis/patients/:patientId/notes", asyncHandler(getLisPatientNotes));
