import { Schema, model, models, type InferSchemaType } from "mongoose";

const agentAuditSchema = new Schema(
  {
    runId: {
      type: Schema.Types.ObjectId,
      ref: "AgentRun",
      required: true,
      index: true,
    },
    patientId: { type: String, required: true, trim: true, index: true },
    encounterId: { type: String, required: true, trim: true, index: true },
    eventType: {
      type: String,
      enum: [
        "run_created",
        "tool_call",
        "graph_completed",
        "doctor_review_required",
        "doctor_clarification_required",
        "icd_regenerated",
        "run_approved",
        "note_saved",
      ],
      required: true,
      index: true,
    },
    node: { type: String, default: "", trim: true },
    tool: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["success", "error", "pending"],
      required: true,
      default: "success",
      index: true,
    },
    message: { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  },
);

agentAuditSchema.index({ runId: 1, createdAt: 1 });
agentAuditSchema.index({ patientId: 1, encounterId: 1, createdAt: -1 });

export type AgentAuditDocument = InferSchemaType<typeof agentAuditSchema>;

export const AgentAuditModel =
  models.AgentAudit || model("AgentAudit", agentAuditSchema);
