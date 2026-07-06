import type { Request, Response } from "express";
import {
  executeAgentTool,
  listAgentTools,
} from "../services/agent-tools.service";
import type {
  AgentToolCallInput,
  AgentToolName,
} from "../types/agent-tool.types";
import { HttpError } from "../utils/http-error";

const agentToolNames: AgentToolName[] = [
  "getPatientContext",
  "getEncounterContext",
  "getRecentLabs",
  "getPriorNotes",
];

function readToolName(value: string | string[] | undefined) {
  if (!value || Array.isArray(value)) {
    throw new HttpError(400, "toolName is required.");
  }

  if (!agentToolNames.includes(value as AgentToolName)) {
    throw new HttpError(404, `Agent tool not found: ${value}`);
  }

  return value as AgentToolName;
}

function readToolInput(value: unknown): AgentToolCallInput {
  if (!value || typeof value !== "object") {
    return {};
  }

  const input = value as Record<string, unknown>;

  return {
    patientId: typeof input.patientId === "string" ? input.patientId : undefined,
    encounterId:
      typeof input.encounterId === "string" ? input.encounterId : undefined,
  };
}

export async function getAgentTools(_req: Request, res: Response) {
  res.json(listAgentTools());
}

export async function runAgentTool(req: Request, res: Response) {
  const toolName = readToolName(req.params.toolName);
  const input = readToolInput(req.body);

  res.json(await executeAgentTool(toolName, input));
}
