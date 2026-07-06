import { Router } from "express";
import {
  approveClinicalAgentRun,
  createClinicalAgentRun,
  createClinicalAgentRunStream,
  getClinicalAgentRunAudit,
  getClinicalAgentRun,
  runClinicalAgent,
} from "../controllers/clinical-agent.controller";
import { asyncHandler } from "../middleware/async-handler";

export const clinicalAgentRouter = Router();

clinicalAgentRouter.post("/clinical-agent/run", asyncHandler(runClinicalAgent));
clinicalAgentRouter.post("/clinical-agent/runs", asyncHandler(createClinicalAgentRun));
clinicalAgentRouter.post(
  "/clinical-agent/runs/stream",
  asyncHandler(createClinicalAgentRunStream),
);
clinicalAgentRouter.get("/clinical-agent/runs/:runId", asyncHandler(getClinicalAgentRun));
clinicalAgentRouter.get(
  "/clinical-agent/runs/:runId/audit",
  asyncHandler(getClinicalAgentRunAudit),
);
clinicalAgentRouter.post(
  "/clinical-agent/runs/:runId/approve",
  asyncHandler(approveClinicalAgentRun),
);
