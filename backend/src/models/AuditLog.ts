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

interface MutableAuditLogJSON {
  _id?: unknown;
  id?: unknown;
  __v?: unknown;
  [key: string]: unknown;
}

auditLogSchema.set("toJSON", {
  transform: (_doc, ret: IAuditLog & { _id: unknown; __v?: number }) => {
    const mutable = ret as unknown as MutableAuditLogJSON;
    if (mutable._id) {
      mutable.id = mutable._id;
      delete mutable._id;
    }
    if ("__v" in mutable) {
      delete mutable.__v;
    }
    return mutable;
  },
});

export default mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
