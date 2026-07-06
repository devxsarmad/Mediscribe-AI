import {
  getLisEncounter,
  getLisLabs,
  getLisPatient,
  getLisPriorNotes,
} from "./lis.service";
import type {
  AgentToolAuditEvent,
  AgentToolCallInput,
  AgentToolName,
  AgentToolResult,
  EncounterContextToolData,
  PatientContextToolData,
  PriorNotesToolData,
  RecentLabsToolData,
} from "../types/agent-tool.types";
import { HttpError } from "../utils/http-error";

type ToolDefinition<TData> = {
  name: AgentToolName;
  description: string;
  execute: (input: AgentToolCallInput) => Promise<AgentToolResult<TData>>;
};

function createAuditEvent(input: {
  tool: AgentToolName;
  status: AgentToolAuditEvent["status"];
  patientId?: string;
  encounterId?: string;
  message: string;
}): AgentToolAuditEvent {
  return {
    timestamp: new Date().toISOString(),
    tool: input.tool,
    status: input.status,
    patientId: input.patientId,
    encounterId: input.encounterId,
    message: input.message,
  };
}

function requirePatientId(input: AgentToolCallInput, tool: AgentToolName) {
  if (!input.patientId) {
    throw new HttpError(400, `${tool} requires patientId.`);
  }

  return input.patientId;
}

function requireEncounterId(input: AgentToolCallInput, tool: AgentToolName) {
  if (!input.encounterId) {
    throw new HttpError(400, `${tool} requires encounterId.`);
  }

  return input.encounterId;
}

function wrapToolResult<TData>(input: {
  tool: AgentToolName;
  data: TData;
  patientId?: string;
  encounterId?: string;
  message: string;
}): AgentToolResult<TData> {
  return {
    tool: input.tool,
    data: input.data,
    auditEvent: createAuditEvent({
      tool: input.tool,
      status: "success",
      patientId: input.patientId,
      encounterId: input.encounterId,
      message: input.message,
    }),
  };
}

export const agentToolRegistry = {
  getPatientContext: {
    name: "getPatientContext",
    description: "Load patient demographics, allergies, and active problems.",
    async execute(input) {
      const patientId = requirePatientId(input, "getPatientContext");
      const data = await getLisPatient(patientId);

      return wrapToolResult<PatientContextToolData>({
        tool: "getPatientContext",
        data,
        patientId,
        message: "Loaded patient context from LIS adapter.",
      });
    },
  } satisfies ToolDefinition<PatientContextToolData>,
  getEncounterContext: {
    name: "getEncounterContext",
    description: "Load active encounter details for a clinical note workflow.",
    async execute(input) {
      const encounterId = requireEncounterId(input, "getEncounterContext");
      const data = await getLisEncounter(encounterId);

      return wrapToolResult<EncounterContextToolData>({
        tool: "getEncounterContext",
        data,
        patientId: data.encounter.patientId,
        encounterId,
        message: "Loaded encounter context from LIS adapter.",
      });
    },
  } satisfies ToolDefinition<EncounterContextToolData>,
  getRecentLabs: {
    name: "getRecentLabs",
    description: "Load recent lab results for the selected patient.",
    async execute(input) {
      const patientId = requirePatientId(input, "getRecentLabs");
      const data = await getLisLabs(patientId);

      return wrapToolResult<RecentLabsToolData>({
        tool: "getRecentLabs",
        data,
        patientId,
        message: data.labs.length
          ? "Loaded recent labs from LIS adapter."
          : "Checked lab context; no linked lab results were available.",
      });
    },
  } satisfies ToolDefinition<RecentLabsToolData>,
  getPriorNotes: {
    name: "getPriorNotes",
    description: "Load prior clinical note summaries for the selected patient.",
    async execute(input) {
      const patientId = requirePatientId(input, "getPriorNotes");
      const data = await getLisPriorNotes(patientId);

      return wrapToolResult<PriorNotesToolData>({
        tool: "getPriorNotes",
        data,
        patientId,
        message: data.notes.length
          ? "Loaded prior notes from LIS adapter."
          : "Checked prior note context; no linked prior notes were available.",
      });
    },
  } satisfies ToolDefinition<PriorNotesToolData>,
} satisfies Record<AgentToolName, ToolDefinition<unknown>>;

export function listAgentTools() {
  return {
    tools: Object.values(agentToolRegistry).map((tool) => ({
      name: tool.name,
      description: tool.description,
    })),
  };
}

export async function executeAgentTool(
  toolName: AgentToolName,
  input: AgentToolCallInput,
) {
  const tool = agentToolRegistry[toolName];

  if (!tool) {
    throw new HttpError(404, `Agent tool not found: ${toolName}`);
  }

  return tool.execute(input);
}
