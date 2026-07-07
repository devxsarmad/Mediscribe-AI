import { Schema, model, models, type InferSchemaType } from "mongoose";

const soapNoteSchema = new Schema(
  {
    subjective: { type: String, required: true, trim: true },
    objective: { type: String, required: true, trim: true },
    assessment: { type: String, required: true, trim: true },
    plan: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const patientContextSchema = new Schema(
  {
    patientLabel: { type: String, default: "<PATIENT>", trim: true },
    mrnLabel: { type: String, default: "<ID>", trim: true },
    ageRange: { type: String, default: "", trim: true },
    visitType: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const noteSchema = new Schema(
  {
    patientContext: {
      type: patientContextSchema,
      required: true,
      default: () => ({}),
    },
    transcript: { type: String, required: true, trim: true },
    soap: { type: soapNoteSchema, required: true },
    doctorEditSummary: { type: Schema.Types.Mixed, default: null },
    icdSuggestions: { type: Schema.Types.Mixed, default: [] },
    status: {
      type: String,
      enum: ["draft", "generated", "reviewed", "saved"],
      default: "saved",
      required: true,
    },
    reviewedAt: { type: Date, required: true },
    savedAt: { type: Date, required: true, default: Date.now },
    source: {
      audioCaptured: { type: Boolean, default: false },
      transcriptionModel: { type: String, default: "", trim: true },
      soapModel: { type: String, default: "", trim: true },
    },
  },
  {
    timestamps: true,
  },
);

noteSchema.index({ createdAt: -1 });
noteSchema.index({ status: 1, createdAt: -1 });

export type NoteDocument = InferSchemaType<typeof noteSchema>;

export const NoteModel = models.Note || model("Note", noteSchema);
