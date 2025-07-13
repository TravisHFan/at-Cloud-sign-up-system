import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  type: "email" | "sms" | "push" | "in-app";
  category:
    | "registration"
    | "reminder"
    | "cancellation"
    | "update"
    | "system"
    | "marketing";
  title: string;
  message: string;
  data?: {
    eventId?: mongoose.Types.ObjectId;
    registrationId?: mongoose.Types.ObjectId;
    actionUrl?: string;
    additionalInfo?: Record<string, any>;
  };
  status: "pending" | "sent" | "delivered" | "failed" | "read";
  scheduledFor?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  priority: "low" | "normal" | "high" | "urgent";
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema: Schema = new Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
    },
    type: {
      type: String,
      enum: ["email", "sms", "push", "in-app"],
      required: [true, "Notification type is required"],
    },
    category: {
      type: String,
      enum: [
        "registration",
        "reminder",
        "cancellation",
        "update",
        "system",
        "marketing",
      ],
      required: [true, "Notification category is required"],
    },
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    data: {
      eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
      registrationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Registration",
      },
      actionUrl: String,
      additionalInfo: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed", "read"],
      default: "pending",
    },
    scheduledFor: Date,
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    failureReason: {
      type: String,
      trim: true,
      maxlength: [500, "Failure reason cannot exceed 500 characters"],
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
      min: 0,
      max: 10,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    expiresAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        (ret as any).id = ret._id;
        delete (ret as any)._id;
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

// Indexes for performance
notificationSchema.index({ recipient: 1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ category: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Compound indexes
notificationSchema.index({ recipient: 1, status: 1 });
notificationSchema.index({ status: 1, scheduledFor: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model<INotification>(
  "Notification",
  notificationSchema
);
