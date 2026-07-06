import OpenAI from "openai";
import { env } from "../config/env";
import { HttpError } from "../utils/http-error";

let openaiClient: OpenAI | null = null;


export function assertOpenAiApiKey() {
  if (!env.openaiApiKey ) {
    throw new HttpError(
      500,
      "OPENAI_API_KEY is not configured. Add your real key to server/.env and restart the API.",
    );
  }

  return env.openaiApiKey;
}

export function getOpenAIClient() {
  const apiKey = assertOpenAiApiKey();

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      timeout: 120_000,
      maxRetries: 2,
    });
  }

  return openaiClient;
}
