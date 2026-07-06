import { Router } from "express";
import {
  getAgentTools,
  runAgentTool,
} from "../controllers/agent-tools.controller";
import { asyncHandler } from "../middleware/async-handler";

export const agentToolsRouter = Router();

agentToolsRouter.get("/agent-tools", asyncHandler(getAgentTools));
agentToolsRouter.post("/agent-tools/:toolName/run", asyncHandler(runAgentTool));
