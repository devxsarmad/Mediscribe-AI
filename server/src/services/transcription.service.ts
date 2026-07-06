import { env } from "../config/env";
import { assertOpenAiApiKey } from "./openai.service";
import { HttpError } from "../utils/http-error";
import { transcribeWithLocalStt } from "./local-stt.service";

type TranscribeAudioInput = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

type TranscriptionApiResponse = {
  text?: string;
  error?: {
    message?: string;
  };
};

function getOpenAiErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as TranscriptionApiResponse).error?.message === "string"
  ) {
    return (payload as TranscriptionApiResponse).error?.message || fallback;
  }

  return fallback;
}

export async function transcribeAudio(input: TranscribeAudioInput) {
  if (env.sttProvider === "local") {
    return transcribeWithLocalStt(input);
  }

  const apiKey = assertOpenAiApiKey();
  const formData = new FormData();

  formData.append(
    "file",
    new Blob([input.buffer as unknown as BlobPart], { type: input.mimeType }),
    input.originalName,
  );
  formData.append("model", env.transcriptionModel);

  let response: Response;

  try {
    response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
  } catch (error) {
    const cause =
      error instanceof Error ? error.message : "Unknown network error";

    throw new HttpError(
      503,
      `OpenAI transcription request failed: ${cause}. Check your internet connection and try again.`,
    );
  }

  const bodyText = await response.text();
  let payload: unknown = null;

  if (bodyText) {
    try {
      payload = JSON.parse(bodyText);
    } catch {
      throw new HttpError(
        response.status || 502,
        bodyText || "OpenAI returned an invalid transcription response.",
      );
    }
  }

  if (!response.ok) {
    throw new HttpError(
      response.status,
      getOpenAiErrorMessage(payload, "OpenAI transcription failed."),
    );
  }

  const transcription = payload as TranscriptionApiResponse;

  if (!transcription?.text?.trim()) {
    throw new HttpError(502, "OpenAI returned an empty transcript.");
  }

  return {
    transcript: transcription.text,
    model: env.transcriptionModel,
    source: {
      filename: input.originalName,
      mimeType: input.mimeType,
      size: input.buffer.byteLength,
    },
  };
}
