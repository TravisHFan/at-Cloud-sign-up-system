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
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: "male" | "female";
    roleInAtCloud?: string;
    authLevel: string; // For "From xxx, Super Admin" display
  };
  isActive: boolean;
  targetRoles?: string[]; // Optional: target specific roles
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const systemMessageSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: [true, "System message title is required"],
      maxlength: [200, "Title cannot exceed 200 characters"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "System message content is required"],
      maxlength: [5000, "Content cannot exceed 5000 characters"],
      trim: true,
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
      required: [true, "System message type is required"],
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    creator: {
      id: { type: String, required: true },
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      username: { type: String, required: true },
      avatar: String,
      gender: {
        type: String,
        enum: ["male", "female"],
        required: true,
      },
      roleInAtCloud: String,
      authLevel: { type: String, required: true }, // "Super Admin", "Administrator", etc.
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    targetRoles: [
      {
        type: String,
        enum: ["Super Admin", "Administrator", "Leader", "Participant"],
      },
    ],
    expiresAt: {
      type: Date,
      validate: {
        validator: function (value: Date) {
          return !value || value > new Date();
        },
        message: "Expiration date must be in the future",
      },
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
systemMessageSchema.index({ type: 1 });
systemMessageSchema.index({ isActive: 1 });
systemMessageSchema.index({ createdAt: -1 });
systemMessageSchema.index({ expiresAt: 1 });
systemMessageSchema.index({ targetRoles: 1 });

// Compound indexes
systemMessageSchema.index({ isActive: 1, type: 1 });
systemMessageSchema.index({ isActive: 1, createdAt: -1 });

// Text search index
systemMessageSchema.index({
  title: "text",
  content: "text",
});

// Static method to get active messages for a role
systemMessageSchema.statics.getActiveMessagesForRole = function (
  userRole: string
) {
  const now = new Date();
  return this.find({
    isActive: true,
    $and: [
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: now } },
        ],
      },
      {
        $or: [
          { targetRoles: { $exists: false } },
          { targetRoles: { $size: 0 } },
          { targetRoles: userRole },
        ],
      },
    ],
  }).sort({ createdAt: -1 });
};

// Static method to clean up expired messages
systemMessageSchema.statics.cleanupExpiredMessages = async function () {
  const now = new Date();
  const result = await this.updateMany(
    {
      isActive: true,
      expiresAt: { $exists: true, $lt: now },
    },
    {
      $set: { isActive: false, updatedAt: now },
    }
  );
  return result.modifiedCount;
};

export default mongoose.model<ISystemMessage>(
  "SystemMessage",
  systemMessageSchema
);
