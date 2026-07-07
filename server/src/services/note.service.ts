import mongoose from "mongoose";
import { env } from "../config/env";
import { NoteModel } from "../models/note.model";
import { isSoapNote } from "../types/soap.types";
import { HttpError } from "../utils/http-error";

type PatientContextInput = {
  patientLabel?: unknown;
  mrnLabel?: unknown;
  ageRange?: unknown;
  visitType?: unknown;
};

type CreateReviewedNoteInput = {
  patientContext?: PatientContextInput;
  transcript?: unknown;
  soap?: unknown;
  doctorEditSummary?: unknown;
  icdSuggestions?: unknown;
  reviewedAt?: unknown;
  source?: {
    audioCaptured?: unknown;
    transcriptionModel?: unknown;
    soapModel?: unknown;
  };
};

function assertDatabaseReady() {
  if (!env.mongodbUri || mongoose.connection.readyState !== 1) {
    throw new HttpError(
      503,
      "MongoDB is not connected. Configure MONGODB_URI and restart the API.",
    );
  }
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeCreateInput(input: unknown) {
  if (!input || typeof input !== "object") {
    throw new HttpError(400, "Request body is required.");
  }

  const body = input as CreateReviewedNoteInput;
  const transcript = readString(body.transcript);

  if (!transcript) {
    throw new HttpError(400, "Transcript is required.");
  }

  if (!isSoapNote(body.soap)) {
    throw new HttpError(
      400,
      "SOAP note is required with subjective, objective, assessment, and plan.",
    );
  }

  const reviewedAtValue = readString(body.reviewedAt);
  const reviewedAt = reviewedAtValue ? new Date(reviewedAtValue) : new Date();

  if (Number.isNaN(reviewedAt.getTime())) {
    throw new HttpError(400, "reviewedAt must be a valid date.");
  }

  return {
    patientContext: {
      patientLabel: readString(body.patientContext?.patientLabel, "<PATIENT>"),
      mrnLabel: readString(body.patientContext?.mrnLabel, "<ID>"),
      ageRange: readString(body.patientContext?.ageRange),
      visitType: readString(body.patientContext?.visitType),
    },
    transcript,
    soap: body.soap,
    doctorEditSummary: body.doctorEditSummary || null,
    icdSuggestions: Array.isArray(body.icdSuggestions)
      ? body.icdSuggestions
      : [],
    status: "saved",
    reviewedAt,
    savedAt: new Date(),
    source: {
      audioCaptured: Boolean(body.source?.audioCaptured),
      transcriptionModel: readString(body.source?.transcriptionModel),
      soapModel: readString(body.source?.soapModel),
    },
  };
}

function serializeNote(note: unknown) {
  const record = note as {
    _id: { toString(): string };
    patientContext: unknown;
    transcript: string;
    soap: unknown;
    doctorEditSummary?: unknown;
    icdSuggestions?: unknown;
    status: string;
    reviewedAt: Date;
    savedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    source?: unknown;
  };

  return {
    id: record._id.toString(),
    patientContext: record.patientContext,
    transcript: record.transcript,
    soap: record.soap,
    doctorEditSummary: record.doctorEditSummary || null,
    icdSuggestions: record.icdSuggestions || [],
    status: record.status,
    reviewedAt: record.reviewedAt,
    savedAt: record.savedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    source: record.source,
  };
}

export async function createReviewedNote(input: unknown) {
  assertDatabaseReady();

  const note = await NoteModel.create(normalizeCreateInput(input));
  return serializeNote(note);
}

export async function listNotes() {
  assertDatabaseReady();

  const notes = await NoteModel.find().sort({ createdAt: -1 }).limit(25).lean();
  return {
    notes: notes.map(serializeNote),
  };
}

export async function getNoteById(id: string) {
  assertDatabaseReady();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, "Invalid note id.");
  }

  const note = await NoteModel.findById(id).lean();

  if (!note) {
    throw new HttpError(404, "Note not found.");
  }

  return serializeNote(note);
}
