import { Schema, model, models, type InferSchemaType } from "mongoose";

const agentRunSchema = new Schema(
  {
    agent: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true, index: true },
    encounterId: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: [
        "doctor_review_required",
        "doctor_clarification_required",
        "approved",
        "saved",
        "rejected",
      ],
      required: true,
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
      index: true,
    },
    state: { type: Schema.Types.Mixed, required: true },
    approvedSoap: { type: Schema.Types.Mixed, default: null },
    doctorEditSummary: { type: Schema.Types.Mixed, default: null },
    approvedAt: { type: Date, default: null },
    savedNoteId: { type: Schema.Types.ObjectId, ref: "Note", default: null },
  },
  {
    timestamps: true,
  },
);

agentRunSchema.index({ createdAt: -1 });
agentRunSchema.index({ patientId: 1, encounterId: 1, createdAt: -1 });

export type AgentRunDocument = InferSchemaType<typeof agentRunSchema>;

export const AgentRunModel =
  models.AgentRun || model("AgentRun", agentRunSchema);
