import mongoose from "mongoose";
import { env } from "../config/env";
import { AgentRunModel } from "../models/agent-run.model";
import {
  createAgentAuditEvent,
  createToolAuditEvents,
  listAgentRunAudit,
} from "./agent-audit.service";
import { createReviewedNote } from "./note.service";
import {
  type ClinicalAgentProgressEvent,
  normalizeClinicalAgentInput,
  runClinicalAgentGraph,
} from "./clinical-agent.service";
import { isSoapNote } from "../types/soap.types";
import { HttpError } from "../utils/http-error";

type ApproveAgentRunInput = {
  soap?: unknown;
  reviewedAt?: unknown;
};

type CreateAgentRunOptions = {
  onProgress?: (event: ClinicalAgentProgressEvent) => void | Promise<void>;
};

function assertDatabaseReady() {
  if (!env.mongodbUri || mongoose.connection.readyState !== 1) {
    throw new HttpError(
      503,
      "MongoDB is not connected. Configure MONGODB_URI and restart the API.",
    );
  }
}

function serializeAgentRun(run: unknown) {
  const record = run as {
    _id: { toString(): string };
    agent: string;
    patientId: string;
    encounterId: string;
    status: string;
    approvalStatus: string;
    state: unknown;
    approvedSoap?: unknown;
    approvedAt?: Date | null;
    savedNoteId?: { toString(): string } | null;
    createdAt: Date;
    updatedAt: Date;
  };

  return {
    id: record._id.toString(),
    agent: record.agent,
    patientId: record.patientId,
    encounterId: record.encounterId,
    status: record.status,
    approvalStatus: record.approvalStatus,
    state: record.state,
    approvedSoap: record.approvedSoap,
    approvedAt: record.approvedAt,
    savedNoteId: record.savedNoteId?.toString() || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function normalizeReviewedAt(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return new Date();
  }

  const reviewedAt = new Date(value);

  if (Number.isNaN(reviewedAt.getTime())) {
    throw new HttpError(400, "reviewedAt must be a valid date.");
  }

  return reviewedAt;
}

async function findAgentRunById(runId: string) {
  assertDatabaseReady();

  if (!mongoose.Types.ObjectId.isValid(runId)) {
    throw new HttpError(400, "Invalid agent run id.");
  }

  const run = await AgentRunModel.findById(runId);

  if (!run) {
    throw new HttpError(404, "Agent run not found.");
  }

  return run;
}

export async function createAgentRun(
  input: unknown,
  options: CreateAgentRunOptions = {},
) {
  assertDatabaseReady();

  const agentInput = normalizeClinicalAgentInput(input);
  const result = await runClinicalAgentGraph(agentInput, {
    onProgress: options.onProgress,
  });

  const run = await AgentRunModel.create({
    agent: result.agent,
    patientId: agentInput.patientId,
    encounterId: agentInput.encounterId,
    status: result.status,
    approvalStatus: result.state.approvalStatus,
    state: result.state,
  });

  await createAgentAuditEvent({
    runId: run._id,
    patientId: agentInput.patientId,
    encounterId: agentInput.encounterId,
    eventType: "run_created",
    status: "success",
    message: "Clinical agent run created.",
    metadata: {
      agent: result.agent,
      status: result.status,
    },
  });

  await createToolAuditEvents({
    runId: run._id,
    patientId: agentInput.patientId,
    encounterId: agentInput.encounterId,
    events: result.state.auditEvents,
  });

  await createAgentAuditEvent({
    runId: run._id,
    patientId: agentInput.patientId,
    encounterId: agentInput.encounterId,
    eventType: "graph_completed",
    status: "success",
    node: result.state.currentNode,
    message: "Clinical agent graph completed.",
    metadata: {
      completedNodes: result.state.completedNodes,
      missingInformation: result.state.missingInformation,
    },
  });

  await createAgentAuditEvent({
    runId: run._id,
    patientId: agentInput.patientId,
    encounterId: agentInput.encounterId,
    eventType:
      result.status === "doctor_review_required"
        ? "doctor_review_required"
        : "doctor_clarification_required",
    status: "pending",
    node: result.state.currentNode,
    message:
      result.status === "doctor_review_required"
        ? "SOAP draft is ready for doctor review."
        : "Doctor clarification is required before SOAP generation.",
  });

  return serializeAgentRun(run);
}

export async function getAgentRun(runId: string) {
  const run = await findAgentRunById(runId);
  return serializeAgentRun(run);
}

export async function getAgentRunAudit(runId: string) {
  await findAgentRunById(runId);
  return listAgentRunAudit(runId);
}

export async function approveAgentRun(runId: string, input: unknown) {
  const run = await findAgentRunById(runId);

  if (run.status === "saved") {
    throw new HttpError(409, "Agent run has already been saved.");
  }

  if (run.status !== "doctor_review_required") {
    throw new HttpError(
      409,
      "Agent run is not ready for approval. Generate a SOAP draft first.",
    );
  }

  const body = input as ApproveAgentRunInput;
  const state = run.state as {
    transcript?: string;
    generatedSoap?: unknown;
    patientContext?: { age?: number; displayName?: string; mrn?: string };
    encounterContext?: { visitType?: string };
  };
  const approvedSoap = body?.soap || state.generatedSoap;

  if (!isSoapNote(approvedSoap)) {
    throw new HttpError(
      400,
      "Approved SOAP note is required with subjective, objective, assessment, and plan.",
    );
  }

  const reviewedAt = normalizeReviewedAt(body?.reviewedAt);
  const savedNote = await createReviewedNote({
    patientContext: {
      patientLabel: state.patientContext?.displayName || "<PATIENT>",
      mrnLabel: state.patientContext?.mrn || "<ID>",
      ageRange:
        typeof state.patientContext?.age === "number"
          ? `${state.patientContext.age}`
          : "",
      visitType: state.encounterContext?.visitType || "",
    },
    transcript: state.transcript || "",
    soap: approvedSoap,
    reviewedAt: reviewedAt.toISOString(),
    source: {
      audioCaptured: Boolean(state.transcript),
      soapModel: "langgraph-context-aware-soap-agent",
    },
  });

  run.status = "saved";
  run.approvalStatus = "approved";
  run.approvedSoap = approvedSoap;
  run.approvedAt = reviewedAt;
  run.savedNoteId = new mongoose.Types.ObjectId(savedNote.id);
  run.state = {
    ...(run.state as Record<string, unknown>),
    approvalStatus: "approved",
    generatedSoap: approvedSoap,
  };

  await run.save();

  await createAgentAuditEvent({
    runId: run._id,
    patientId: run.patientId,
    encounterId: run.encounterId,
    eventType: "run_approved",
    status: "success",
    message: "Doctor approved the agent-generated SOAP note.",
    metadata: {
      approvedAt: reviewedAt.toISOString(),
    },
  });

  await createAgentAuditEvent({
    runId: run._id,
    patientId: run.patientId,
    encounterId: run.encounterId,
    eventType: "note_saved",
    status: "success",
    message: "Approved SOAP note saved as final reviewed note.",
    metadata: {
      savedNoteId: savedNote.id,
    },
  });

  return {
    run: serializeAgentRun(run),
    savedNote,
  };
}
