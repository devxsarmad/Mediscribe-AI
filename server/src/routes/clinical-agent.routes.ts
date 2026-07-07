import { Router } from "express";
import {
  approveClinicalAgentRun,
  createClinicalAgentRunStream,
  regenerateClinicalAgentIcdSuggestions,
} from "../controllers/clinical-agent.controller";
import { asyncHandler } from "../middleware/async-handler";
export const clinicalAgentRouter = Router();
clinicalAgentRouter.post(
  "/clinical-agent/runs/stream",
  asyncHandler(createClinicalAgentRunStream),
);

clinicalAgentRouter.post(
  "/clinical-agent/runs/:runId/approve",
  asyncHandler(approveClinicalAgentRun),
);

clinicalAgentRouter.post(
  "/clinical-agent/runs/:runId/icd-suggestions",
  asyncHandler(regenerateClinicalAgentIcdSuggestions),
);
