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

// Interface for static methods
export interface IAuditLogModel extends mongoose.Model<IAuditLog> {
  purgeOldAuditLogs(
    retentionMonths?: number
  ): Promise<{ deletedCount: number }>;
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

// Optional TTL index as fallback safety mechanism (24 months = 730 days)
// This acts as a hard limit to prevent indefinite accumulation
const TTL_FALLBACK_DAYS = parseInt(
  process.env.AUDIT_LOG_TTL_FALLBACK_DAYS || "730",
  10
);
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: TTL_FALLBACK_DAYS * 24 * 60 * 60 }
);

// Static method for bulk deletion of old audit logs
auditLogSchema.statics.purgeOldAuditLogs = async function (
  retentionMonths?: number
): Promise<{ deletedCount: number }> {
  const months =
    retentionMonths ??
    parseInt(process.env.AUDIT_LOG_RETENTION_MONTHS || "12", 10);
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
  });

  return { deletedCount: result.deletedCount || 0 };
};

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

export default (mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", auditLogSchema)) as IAuditLogModel;
