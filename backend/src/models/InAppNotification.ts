import mongoose, { Schema, Document } from "mongoose";

export interface IInAppNotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: "system" | "user_message" | "management_action";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;

  // For user messages
  fromUser?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: "male" | "female";
  };

  // For management actions
  actionType?: "promotion" | "demotion" | "role_change";
  actionDetails?: {
    fromRole: string;
    toRole: string;
    actorName: string;
  };

  // Additional data
  data?: Record<string, any>;
}

const inAppNotificationSchema: Schema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    type: {
      type: String,
      enum: ["system", "user_message", "management_action"],
      required: [true, "Notification type is required"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },
    isRead: {
      type: Boolean,
      default: false,
    },

    // For user messages
    fromUser: {
      id: String,
      firstName: String,
      lastName: String,
      username: String,
      avatar: String,
      gender: {
        type: String,
        enum: ["male", "female"],
      },
    },

    // For management actions
    actionType: {
      type: String,
      enum: ["promotion", "demotion", "role_change"],
    },
    actionDetails: {
      fromRole: String,
      toRole: String,
      actorName: String,
    },

    // Additional data
    data: {
      type: Schema.Types.Mixed,
    },
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
inAppNotificationSchema.index({ userId: 1, createdAt: -1 });
inAppNotificationSchema.index({ userId: 1, isRead: 1 });
inAppNotificationSchema.index({ type: 1 });

export default mongoose.model<IInAppNotification>(
  "InAppNotification",
  inAppNotificationSchema
);
