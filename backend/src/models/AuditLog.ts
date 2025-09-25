import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  action: string; // e.g., EventPublished, EventUnpublished
  actorId?: mongoose.Types.ObjectId | null; // user performing action
  eventId?: mongoose.Types.ObjectId | null;
  metadata?: Record<string, unknown> | null;
  ipHash?: string | null; // truncated/hashed IP (future use)
  emailHash?: string | null; // hashed email when needed
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: null },
    ipHash: { type: String, default: null },
    emailHash: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ action: 1, createdAt: -1 });

auditLogSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
