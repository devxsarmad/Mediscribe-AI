import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

function loadEnvFile() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "server", ".env"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
  }

  dotenv.config();
}

loadEnvFile();

type NodeEnv = "development" | "test" | "production";
type SttProvider = "openai" | "local";
type LisAdapterMode = "mock" | "real";

function readNodeEnv(value: string | undefined): NodeEnv {
  if (value === "test" || value === "production") {
    return value;
  }

  return "development";
}

function readNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readSttProvider(value: string | undefined): SttProvider {
  return value === "openai" ? "openai" : "local";
}

function readLisAdapterMode(value: string | undefined): LisAdapterMode {
  return value === "real" ? "real" : "mock";
}

function readBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return value === "true" || value === "1";
}

function readList(value: string | undefined, fallback: string[]) {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: readNodeEnv(process.env.NODE_ENV),
  port: readNumber(process.env.PORT, 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  clientOrigins: readList(process.env.CLIENT_ORIGINS, [
    process.env.CLIENT_ORIGIN || "http://localhost:3000",
  ]),
  mongodbUri: process.env.MONGODB_URI || "",
  mongodbRequired: readBoolean(
    process.env.MONGODB_REQUIRED,
    process.env.NODE_ENV === "production",
  ),
  sttProvider: readSttProvider(process.env.STT_PROVIDER),
  lisAdapterMode: readLisAdapterMode(process.env.LIS_ADAPTER_MODE),
  lisApiBaseUrl: process.env.LIS_API_BASE_URL || "",
  lisAuthToken: process.env.LIS_AUTH_TOKEN || "",
  lisOrganizationId: process.env.LIS_ORGANIZATION_ID || "",
  lisRealPatientFallbackToMock: readBoolean(
    process.env.LIS_REAL_PATIENT_FALLBACK_TO_MOCK,
    true,
  ),
  lisRequestTimeoutMs: readNumber(process.env.LIS_REQUEST_TIMEOUT_MS, 10000),
  localSttUrl: process.env.LOCAL_STT_URL || "http://localhost:8001",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1",
  soapModel: process.env.OPENAI_SOAP_MODEL || "gpt-4o-mini",
};
