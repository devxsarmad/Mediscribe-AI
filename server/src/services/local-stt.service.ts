import { env } from "../config/env";
import { HttpError } from "../utils/http-error";

type LocalSttInput = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

type LocalSttResponse = {
  transcript?: string;
  language?: string;
  durationSeconds?: number;
  model?: string;
  error?: string;
};

export async function transcribeWithLocalStt(input: LocalSttInput) {
  const formData = new FormData();

  formData.append(
    "audio",
    new Blob([input.buffer as unknown as BlobPart], { type: input.mimeType }),
    input.originalName,
  );

  let response: Response;

  try {
    response = await fetch(`${env.localSttUrl}/transcribe`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    const cause =
      error instanceof Error ? error.message : "Unknown network error";

    throw new HttpError(
      503,
      `Local STT service is unavailable: ${cause}. Start the STT service and retry.`,
    );
  }

  let payload: LocalSttResponse;

  try {
    payload = (await response.json()) as LocalSttResponse;
  } catch {
    throw new HttpError(
      response.status || 502,
      "Local STT service returned an invalid response.",
    );
  }

  if (!response.ok) {
    throw new HttpError(
      response.status,
      payload.error || "Local STT transcription failed.",
    );
  }

  if (!payload.transcript?.trim()) {
    throw new HttpError(502, "Local STT service returned an empty transcript.");
  }
  return {
    transcript: payload.transcript,
    model: payload.model || "local-stt",
    language: payload.language,
    durationSeconds: payload.durationSeconds,
    source: {
      filename: input.originalName,
      mimeType: input.mimeType,
      size: input.buffer.byteLength,
    },
  };
}
