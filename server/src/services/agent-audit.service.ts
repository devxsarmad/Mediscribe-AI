import mongoose from "mongoose";
import { env } from "../config/env";
import { AgentAuditModel } from "../models/agent-audit.model";
import type { AgentToolAuditEvent } from "../types/agent-tool.types";
import { HttpError } from "../utils/http-error";

type AgentAuditInput = {
  runId: string | mongoose.Types.ObjectId;
  patientId: string;
  encounterId: string;
  eventType:
    | "run_created"
    | "tool_call"
    | "graph_completed"
    | "doctor_review_required"
    | "doctor_clarification_required"
    | "run_approved"
    | "note_saved";
  node?: string;
  tool?: string;
  status?: "success" | "error" | "pending";
  message: string;
  metadata?: Record<string, unknown>;
};

function assertDatabaseReady() {
  if (!env.mongodbUri || mongoose.connection.readyState !== 1) {
    throw new HttpError(
      503,
      "MongoDB is not connected. Configure MONGODB_URI and restart the API.",
    );
  }
}

function toObjectId(id: string | mongoose.Types.ObjectId) {
  if (id instanceof mongoose.Types.ObjectId) {
    return id;
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, "Invalid agent run id.");
  }

  return new mongoose.Types.ObjectId(id);
}

function serializeAudit(audit: unknown) {
  const record = audit as {
    _id: { toString(): string };
    runId: { toString(): string };
    patientId: string;
    encounterId: string;
    eventType: string;
    node?: string;
    tool?: string;
    status: string;
    message: string;
    metadata?: unknown;
    createdAt: Date;
    updatedAt: Date;
  };

  return {
    id: record._id.toString(),
    runId: record.runId.toString(),
    patientId: record.patientId,
    encounterId: record.encounterId,
    eventType: record.eventType,
    node: record.node,
    tool: record.tool,
    status: record.status,
    message: record.message,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function createAgentAuditEvent(input: AgentAuditInput) {
  assertDatabaseReady();

  const audit = await AgentAuditModel.create({
    runId: toObjectId(input.runId),
    patientId: input.patientId,
    encounterId: input.encounterId,
    eventType: input.eventType,
    node: input.node || "",
    tool: input.tool || "",
    status: input.status || "success",
    message: input.message,
    metadata: input.metadata || {},
  });

  return serializeAudit(audit);
}

export async function createToolAuditEvents(input: {
  runId: string | mongoose.Types.ObjectId;
  patientId: string;
  encounterId: string;
  events: AgentToolAuditEvent[];
}) {
  const audits = [];

  for (const event of input.events) {
    audits.push(
      await createAgentAuditEvent({
        runId: input.runId,
        patientId: input.patientId,
        encounterId: input.encounterId,
        eventType: "tool_call",
        tool: event.tool,
        status: event.status,
        message: event.message,
        metadata: {
          eventTimestamp: event.timestamp,
          toolPatientId: event.patientId,
          toolEncounterId: event.encounterId,
        },
      }),
    );
  }

  return audits;
}

export async function listAgentRunAudit(runId: string) {
  assertDatabaseReady();

  const objectId = toObjectId(runId);
  const audits = await AgentAuditModel.find({ runId: objectId })
    .sort({ createdAt: 1 })
    .lean();

  return {
    runId,
    auditEvents: audits.map(serializeAudit),
  };
}
