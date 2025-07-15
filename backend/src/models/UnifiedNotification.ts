import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUnifiedNotification extends Document {
  userId: mongoose.Types.ObjectId;
  type:
    | "SYSTEM_MESSAGE"
    | "CHAT_MESSAGE"
    | "EVENT_NOTIFICATION"
    | "USER_ACTION";
  category:
    | "registration"
    | "reminder"
    | "cancellation"
    | "update"
    | "system"
    | "marketing"
    | "chat"
    | "role_change"
    | "announcement";

  title: string;
  message: string;
  isRead: boolean;
  priority: "low" | "normal" | "high" | "urgent";

  // Metadata for different notification types
  metadata?: {
    // For EVENT_NOTIFICATION
    eventId?: mongoose.Types.ObjectId;
    registrationId?: mongoose.Types.ObjectId;
    actionUrl?: string;

    // For CHAT_MESSAGE
    fromUserId?: mongoose.Types.ObjectId;
    messageId?: mongoose.Types.ObjectId;

    // For USER_ACTION
    actionType?: "promotion" | "demotion" | "role_change";
    fromRole?: string;
    toRole?: string;
    actorName?: string;

    // Additional data
    additionalInfo?: Record<string, any>;
  };

  // Delivery tracking
  deliveryStatus?: "pending" | "sent" | "delivered" | "failed";
  deliveryChannels?: ("in-app" | "email" | "push" | "sms")[];
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;

  // Expiration and scheduling
  expiresAt?: Date;
  scheduledFor?: Date;

  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  markAsRead(): Promise<this>;
  markAsDelivered(): Promise<this>;
}

export interface IUnifiedNotificationModel extends Model<IUnifiedNotification> {
  markAllAsReadForUser(userId: string): Promise<any>;
  getUnreadCountForUser(userId: string): Promise<number>;
  cleanupExpiredNotifications(): Promise<any>;
}

const UnifiedNotificationSchema = new Schema<IUnifiedNotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "SYSTEM_MESSAGE",
        "CHAT_MESSAGE",
        "EVENT_NOTIFICATION",
        "USER_ACTION",
      ],
      required: true,
      index: true,
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
        "chat",
        "role_change",
        "announcement",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    deliveryStatus: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed"],
      default: "pending",
    },
    deliveryChannels: [
      {
        type: String,
        enum: ["in-app", "email", "push", "sms"],
      },
    ],
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    expiresAt: Date,
    scheduledFor: Date,
  },
  {
    timestamps: true,
  }
);

// Add compound indexes for common queries
UnifiedNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
UnifiedNotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
UnifiedNotificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
UnifiedNotificationSchema.index({ expiresAt: 1 }); // For cleanup of expired notifications

// Add methods for common operations
UnifiedNotificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

UnifiedNotificationSchema.methods.markAsDelivered = function () {
  this.deliveryStatus = "delivered";
  this.deliveredAt = new Date();
  return this.save();
};

// Static methods for bulk operations
UnifiedNotificationSchema.statics.markAllAsReadForUser = function (
  userId: string
) {
  return this.updateMany(
    { userId, isRead: false },
    {
      isRead: true,
      readAt: new Date(),
    }
  );
};

UnifiedNotificationSchema.statics.getUnreadCountForUser = function (
  userId: string
) {
  return this.countDocuments({ userId, isRead: false });
};

UnifiedNotificationSchema.statics.cleanupExpiredNotifications = function () {
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
};

const UnifiedNotification = mongoose.model<
  IUnifiedNotification,
  IUnifiedNotificationModel
>("UnifiedNotification", UnifiedNotificationSchema);

export default UnifiedNotification;
