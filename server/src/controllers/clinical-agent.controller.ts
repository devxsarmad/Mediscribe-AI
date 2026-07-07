import type { Request, Response } from "express";
import {
  approveAgentRun,
  createAgentRun,
  regenerateAgentRunIcdSuggestions,
} from "../services/agent-run.service";
import { HttpError } from "../utils/http-error";

function readRunId(value: string | string[] | undefined) {
  if (!value || Array.isArray(value)) {
    throw new HttpError(400, "runId is required.");
  }

  return value;
}

function writeStreamEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function createClinicalAgentRunStream(req: Request, res: Response) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const result = await createAgentRun(req.body, {
      onProgress(event) {
        writeStreamEvent(res, "agent_event", event);
      },
    });

    writeStreamEvent(res, "agent_run", result);
    writeStreamEvent(res, "done", { status: "done" });
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const message =
      error instanceof Error ? error.message : "Clinical agent stream failed.";

    writeStreamEvent(res, "error", {
      statusCode,
      message,
    });
  } finally {
    res.end();
  }
}

export async function approveClinicalAgentRun(req: Request, res: Response) {
  const runId = readRunId(req.params.runId);
  const result = await approveAgentRun(runId, req.body);

  res.json(result);
}

export async function regenerateClinicalAgentIcdSuggestions(
  req: Request,
  res: Response,
) {
  const runId = readRunId(req.params.runId);
  const result = await regenerateAgentRunIcdSuggestions(runId, req.body);

  res.json(result);
}
