import mongoose, { Schema, Document } from "mongoose";

export type RefundRequestSource = "purchase_history" | "program_unenroll";
export type RefundRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";
export type RefundRequestUserDecision =
  | "unenroll_without_refund"
  | "stay_enrolled";

export interface IRefundRequest extends Document {
  userId: mongoose.Types.ObjectId;
  purchaseId: mongoose.Types.ObjectId;
  purchaseType: "program" | "event";
  programId?: mongoose.Types.ObjectId;
  eventId?: mongoose.Types.ObjectId;
  source: RefundRequestSource;
  status: RefundRequestStatus;
  reason?: string;
  refundAmount: number;
  itemTitle: string;
  requestedAt: Date;
  requestExpiresAt: Date;
  decidedAt?: Date;
  decidedBy?: mongoose.Types.ObjectId;
  decisionNote?: string;
  stripeRefundId?: string;
  userDecision?: RefundRequestUserDecision;
  userDecidedAt?: Date;
  cleanupAfter?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refundRequestSchema = new Schema<IRefundRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: "Purchase",
      required: true,
      index: true,
    },
    purchaseType: {
      type: String,
      enum: ["program", "event"],
      required: true,
      index: true,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: "Program",
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      index: true,
    },
    source: {
      type: String,
      enum: ["purchase_history", "program_unenroll"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "expired"],
      required: true,
      default: "pending",
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    itemTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    requestedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    requestExpiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    decidedAt: Date,
    decidedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    decisionNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    stripeRefundId: {
      type: String,
      trim: true,
      maxlength: 255,
    },
    userDecision: {
      type: String,
      enum: ["unenroll_without_refund", "stay_enrolled"],
    },
    userDecidedAt: Date,
    cleanupAfter: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (
        _doc,
        ret: Record<string, unknown> & { _id?: unknown; __v?: unknown },
      ) {
        (ret as { id?: string }).id = ret._id as unknown as string;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

refundRequestSchema.index({ purchaseId: 1, status: 1 });
refundRequestSchema.index({ userId: 1, purchaseId: 1, status: 1 });

export const RefundRequest =
  (mongoose.models.RefundRequest as mongoose.Model<IRefundRequest>) ||
  mongoose.model<IRefundRequest>("RefundRequest", refundRequestSchema);

export default RefundRequest;
