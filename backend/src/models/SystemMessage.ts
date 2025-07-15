import mongoose, { Schema, Document } from "mongoose";

export interface ISystemMessage extends Document {
  title: string;
  content: string;
  type:
    | "announcement"
    | "maintenance"
    | "update"
    | "warning"
    | "auth_level_change";
  priority: "low" | "medium" | "high";
  createdAt: Date;
  updatedAt: Date;

  // For auth level change messages - target specific user
  targetUserId?: mongoose.Types.ObjectId;

  // Message creator information
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: "male" | "female";
    roleInAtCloud?: string;
  };

  // Global visibility settings
  isActive: boolean;
  expiresAt?: Date;

  // Read tracking per user (array of user IDs who have read this message)
  readByUsers: mongoose.Types.ObjectId[];
}

const systemMessageSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      maxlength: [2000, "Content cannot exceed 2000 characters"],
    },
    type: {
      type: String,
      enum: [
        "announcement",
        "maintenance",
        "update",
        "warning",
        "auth_level_change",
      ],
      required: [true, "Message type is required"],
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    // For auth level change messages
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Message creator
    creator: {
      id: String,
      firstName: String,
      lastName: String,
      username: String,
      avatar: String,
      gender: {
        type: String,
        enum: ["male", "female"],
      },
      roleInAtCloud: String,
    },

    // Visibility settings
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: Date,

    // Track which users have read this message
    readByUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
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
systemMessageSchema.index({ type: 1, createdAt: -1 });
systemMessageSchema.index({ targetUserId: 1 });
systemMessageSchema.index({ isActive: 1, expiresAt: 1 });
systemMessageSchema.index({ readByUsers: 1 });

// TTL index for expired messages
systemMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<ISystemMessage>(
  "SystemMessage",
  systemMessageSchema
);
