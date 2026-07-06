import { env } from "../../config/env";
import type { LisAdapter } from "./lis-adapter.types";
import type { LisEncounter, LisPatient } from "../../types/lis.types";
import { HttpError } from "../../utils/http-error";
import { mockLisAdapter } from "./mock-lis.adapter";

type LisRecord = Record<string, unknown>;

function requireLisConfig() {
  if (!env.lisApiBaseUrl || !env.lisAuthToken) {
    throw new HttpError(
      501,
      "Real LIS adapter requires LIS_API_BASE_URL and LIS_AUTH_TOKEN.",
    );
  }
}

function extractPatientIdFromEncounterId(encounterId: string) {
  if (encounterId.startsWith("current:")) {
    return encounterId.replace("current:", "");
  }

  return encounterId;
}

function buildLisUrl(pathname: string, params: Record<string, string>) {
  const baseUrl = env.lisApiBaseUrl.endsWith("/")
    ? env.lisApiBaseUrl
    : `${env.lisApiBaseUrl}/`;
  const url = new URL(pathname.replace(/^\//, ""), baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url;
}

async function fetchLisJson<T>(url: URL): Promise<T> {
  requireLisConfig();

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    env.lisRequestTimeoutMs,
  );

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.lisAuthToken}`,
        "auth-token": env.lisAuthToken,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new HttpError(
        response.status,
        `LIS request failed with status ${response.status}.`,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(
      502,
      error instanceof Error
        ? `LIS request failed: ${error.message}`
        : "LIS request failed.",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function asRecord(value: unknown): LisRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LisRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(record: LisRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

function readNumber(record: LisRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function readStringList(record: LisRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === "string"
            ? item
            : asRecord(item)
              ? readString(asRecord(item) as LisRecord, [
                  "name",
                  "title",
                  "description",
                ])
              : "",
        )
        .filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function normalizeSex(value: string): LisPatient["sex"] {
  const normalized = value.toLowerCase();

  if (normalized.startsWith("f")) {
    return "female";
  }

  if (normalized.startsWith("m")) {
    return "male";
  }

  if (normalized) {
    return "other";
  }

  return "unknown";
}

function calculateAge(dateOfBirth: string) {
  if (!dateOfBirth) {
    return 0;
  }

  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return 0;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age;
}

function getPatientName(record: LisRecord) {
  const directName = readString(record, [
    "displayName",
    "display_name",
    "full_name",
    "patient_name",
    "name",
  ]);

  if (directName) {
    return directName;
  }

  return [readString(record, ["first_name", "firstName"]), readString(record, [
    "last_name",
    "lastName",
  ])]
    .filter(Boolean)
    .join(" ");
}

function extractPatientRecords(payload: unknown): LisRecord[] {
  if (Array.isArray(payload)) {
    return payload.map(asRecord).filter(Boolean) as LisRecord[];
  }

  const root = asRecord(payload);

  if (!root) {
    return [];
  }

  const directData = root.data;
  const nestedData = asRecord(directData)?.data;

  return [
    ...asArray(root.patients),
    ...asArray(root.results),
    ...asArray(directData),
    ...asArray(nestedData),
  ]
    .map(asRecord)
    .filter(Boolean) as LisRecord[];
}

function mapPatient(record: LisRecord): LisPatient {
  const id = readString(record, [
    "id",
    "patient_id",
    "patientId",
    "uuid",
    "external_id",
    "mrn",
    "patient_code",
    "medical_record_number",
  ]);
  const mrn = readString(record, [
    "mrn",
    "patient_code",
    "medical_record_number",
    "medicalRecordNumber",
    "patient_mrn",
    "external_id",
    "id",
  ]);
  const dateOfBirth = readString(record, [
    "date_of_birth",
    "dateOfBirth",
    "dob",
    "birth_date",
  ]);
  const explicitAge = readNumber(record, ["age", "patient_age"]);

  return {
    id,
    mrn,
    displayName: getPatientName(record) || "Unknown patient",
    age: explicitAge || calculateAge(dateOfBirth),
    sex: normalizeSex(readString(record, ["sex", "gender"])),
    dateOfBirth,
    phone: readString(record, [
      "phone",
      "phone_number",
      "mobile",
      "contact",
      "contact_number",
    ]),
    address: readString(record, ["address", "full_address"]),
    allergies: readStringList(record, ["allergies", "allergy"]),
    activeProblems: readStringList(record, [
      "activeProblems",
      "active_problems",
      "problems",
      "diagnoses",
    ]),
  };
}

async function fetchPatients(search = "") {
  const url = buildLisUrl("/patients", {
    paginate: "true",
    per_page: "50",
    page: "1",
    search,
    organization_id: env.lisOrganizationId,
  });
  const payload = await fetchLisJson<unknown>(url);

  return extractPatientRecords(payload).map(mapPatient).filter((patient) => patient.id);
}

const hybridMeta = {
  patientSource: "real_lis" as const,
  clinicalContextSource: "temporary" as const,
  mode: "real_patient_hybrid" as const,
  note: "Patients come from the real LIS dev API. Encounter, labs, and prior notes use portfolio-safe placeholders until those APIs are available.",
};

const fallbackMeta = {
  patientSource: "mock" as const,
  clinicalContextSource: "mock" as const,
  mode: "mock" as const,
  note: "Real LIS patient API was unavailable, so mock patients are being used for the portfolio demo.",
};

async function listMockPatients() {
  const result = await mockLisAdapter.listPatients();

  return {
    ...result,
    meta: fallbackMeta,
  };
}

async function getMockPatient(patientId: string) {
  const result = await mockLisAdapter.getPatient(patientId);

  return {
    ...result,
    meta: fallbackMeta,
  };
}

export const realLisAdapter: LisAdapter = {
  async listPatients() {
    try {
      return {
        patients: await fetchPatients(),
        meta: hybridMeta,
      };
    } catch (error) {
      if (env.lisRealPatientFallbackToMock) {
        return listMockPatients();
      }

      throw error;
    }
  },

  async getPatient(patientId) {
    try {
      const patients = [
        ...(await fetchPatients(patientId)),
        ...(await fetchPatients()),
      ];
      const patient = patients.find(
        (item) => item.id === patientId || item.mrn === patientId,
      );

      if (!patient) {
        throw new HttpError(404, `LIS patient not found: ${patientId}`);
      }

      return {
        patient,
        meta: hybridMeta,
      };
    } catch (error) {
      if (env.lisRealPatientFallbackToMock) {
        return getMockPatient(patientId);
      }

      throw error;
    }
  },

  async getEncounter(encounterId) {
    const patientId = extractPatientIdFromEncounterId(encounterId);
    const { patient } = await this.getPatient(patientId);
    const encounter: LisEncounter = {
      id: encounterId,
      patientId: patient.id,
      status: "in_progress",
      visitType: "Primary care",
      providerName: "Current provider",
      location: "LIS encounter",
      startedAt: new Date().toISOString(),
      reasonForVisit: "Current scribe encounter",
    };

    return {
      encounter,
    };
  },

  async getRecentLabs(patientId) {
    await this.getPatient(patientId);

    return {
      patientId,
      labs: [],
    };
  },

  async getPriorNotes(patientId) {
    await this.getPatient(patientId);

    return {
      patientId,
      notes: [],
    };
  },
};
