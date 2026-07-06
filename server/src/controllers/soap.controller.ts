import type { Request, Response } from "express";
import { generateSoapNote } from "../services/soap.service";
import type { PhiContext } from "../types/phi.types";
import { HttpError } from "../utils/http-error";

function readPhiContext(body: unknown): PhiContext | undefined {
  if (!body || typeof body !== "object" || !("phiContext" in body)) {
    return undefined;
  }

  const phiContext = (body as { phiContext?: unknown }).phiContext;

  if (!phiContext || typeof phiContext !== "object") {
    return undefined;
  }

  const record = phiContext as Record<string, unknown>;
  const readList = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : undefined;

  return {
    names: readList(record.names),
    ids: readList(record.ids),
    contacts: readList(record.contacts),
    locations: readList(record.locations),
    ages: readList(record.ages),
    providers: readList(record.providers),
  };
}

export async function createSoapNote(req: Request, res: Response) {
  const transcript = req.body?.transcript;

  if (typeof transcript !== "string" || !transcript.trim()) {
    throw new HttpError(400, "Transcript is required in the request body.");
  }

  const result = await generateSoapNote({
    transcript: transcript.trim(),
    phiContext: readPhiContext(req.body),
  });

  res.status(201).json(result);
}
