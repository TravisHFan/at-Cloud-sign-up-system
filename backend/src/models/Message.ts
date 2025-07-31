import mongoose, { Schema, Document } from "mongoose";

/**
 * Unified Message System - Single Source of Truth
 *
 * This model replaces the previous dual system (SystemMessage + separate notification states)
 * with a unified approach that maintains the same user experience while simplifying the architecture.
 *
 * Features:
 * - Single message document represents both system message and bell notification
 * - User-specific state tracking embedded in the document
 * - Maintains original design: bell notifications + system messages page
 * - Simplified state management and synchronization
 */

export interface IMessage extends Document {
  // Message Content
  title: string;
  content: string;
  type:
    | "announcement"
    | "maintenance"
    | "update"
    | "warning"
    | "auth_level_change";
  priority: "low" | "medium" | "high";

  // Creator Information
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: "male" | "female";
    roleInAtCloud?: string;
    authLevel: string; // "Super Admin", "Administrator", etc.
  };
  createdBy?: mongoose.Types.ObjectId; // For test compatibility

  // Targeting & Lifecycle
  isActive: boolean;
  targetRoles?: string[]; // Optional: target specific roles
  expiresAt?: Date;

  // User-Specific States (embedded for performance)
  userStates: Map<
    string,
    {
      // Bell Notification State
      isReadInBell: boolean;
      readInBellAt?: Date;
      isRemovedFromBell: boolean;
      removedFromBellAt?: Date;

      // System Message State
      isReadInSystem: boolean;
      readInSystemAt?: Date;
      isDeletedFromSystem: boolean;
      deletedFromSystemAt?: Date;

      // Unified state (computed)
      lastInteractionAt?: Date;
    }
  >;

  // Metadata
  createdAt: Date;
  updatedAt: Date;

  // Methods
  getUserState(userId: string): any;
  updateUserState(userId: string, updates: Partial<any>): void;
  markAsReadInBell(userId: string): void;
  markAsReadInSystem(userId: string): void;
  markAsReadEverywhere(userId: string): void;
  removeFromBell(userId: string): void;
  deleteFromSystem(userId: string): void;
  shouldShowInBell(userId: string): boolean;
  shouldShowInSystem(userId: string): boolean;
  getBellDisplayTitle(): string;
  canRemoveFromBell(userId: string): boolean;
}

// Interface for the Message model with static methods
export interface IMessageModel extends mongoose.Model<IMessage> {
  getBellNotificationsForUser(userId: string): Promise<any[]>;
  getSystemMessagesForUser(
    userId: string,
    page?: number,
    limit?: number
  ): Promise<{
    messages: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>;
  getUnreadCountsForUser(userId: string): Promise<{
    bellNotifications: number;
    systemMessages: number;
    total: number;
  }>;
  createForAllUsers(messageData: any, userIds: string[]): Promise<IMessage>;
  createForSpecificUser(messageData: any, userId: string): Promise<IMessage>;
}

const messageSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Message title is required"],
      maxlength: [200, "Title cannot exceed 200 characters"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
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
      required: [true, "Message type is required"],
      default: "announcement",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    creator: {
      id: {
        type: String,
        required: [true, "Creator ID is required"],
      },
      firstName: {
        type: String,
        required: [true, "Creator first name is required"],
        trim: true,
      },
      lastName: {
        type: String,
        required: [true, "Creator last name is required"],
        trim: true,
      },
      username: {
        type: String,
        required: [true, "Creator username is required"],
        trim: true,
      },
      avatar: {
        type: String,
        trim: true,
      },
      gender: {
        type: String,
        enum: ["male", "female"],
        required: [true, "Creator gender is required"],
      },
      roleInAtCloud: {
        type: String,
        trim: true,
      },
      authLevel: {
        type: String,
        required: [true, "Creator auth level is required"],
        trim: true,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, // For efficient queries
    },
    targetRoles: [
      {
        type: String,
        trim: true,
      },
    ],
    expiresAt: {
      type: Date,
      index: true, // For TTL and cleanup
    },
    userStates: {
      type: Map,
      of: {
        // Bell Notification State
        isReadInBell: {
          type: Boolean,
          default: false,
        },
        readInBellAt: Date,
        isRemovedFromBell: {
          type: Boolean,
          default: false,
        },
        removedFromBellAt: Date,

        // System Message State
        isReadInSystem: {
          type: Boolean,
          default: false,
        },
        readInSystemAt: Date,
        isDeletedFromSystem: {
          type: Boolean,
          default: false,
        },
        deletedFromSystemAt: Date,

        // Unified tracking
        lastInteractionAt: Date,
      },
      default: new Map(),
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc: any, ret: any) {
        // Convert Map to Object for JSON serialization
        if (ret.userStates instanceof Map) {
          ret.userStates = Object.fromEntries(ret.userStates);
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc: any, ret: any) {
        // Convert Map to Object for object serialization
        if (ret.userStates instanceof Map) {
          ret.userStates = Object.fromEntries(ret.userStates);
        }
        return ret;
      },
    },
  }
);

// Indexes for performance
messageSchema.index({ isActive: 1, createdAt: -1 });
messageSchema.index({ type: 1, isActive: 1 });
messageSchema.index({ priority: 1, isActive: 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Instance Methods
messageSchema.methods = {
  /**
   * Get user-specific state for this message
   */
  getUserState(userId: string) {
    const state = this.userStates.get(userId);
    if (!state) {
      return {
        isReadInBell: false,
        isRemovedFromBell: false,
        isReadInSystem: false,
        isDeletedFromSystem: false,
      };
    }

    // Convert Mongoose subdocument to plain object
    return {
      isReadInBell: state.isReadInBell || false,
      isRemovedFromBell: state.isRemovedFromBell || false,
      isReadInSystem: state.isReadInSystem || false,
      isDeletedFromSystem: state.isDeletedFromSystem || false,
      readInBellAt: state.readInBellAt,
      readInSystemAt: state.readInSystemAt,
      removedFromBellAt: state.removedFromBellAt,
      deletedFromSystemAt: state.deletedFromSystemAt,
      lastInteractionAt: state.lastInteractionAt,
    };
  },

  /**
   * Update user state for this message
   */
  updateUserState(userId: string, updates: Partial<any>) {
    const currentState = this.getUserState(userId);
    const newState = {
      ...currentState,
      ...updates,
      lastInteractionAt: new Date(),
    };

    this.userStates.set(userId, newState);
    this.markModified("userStates");
  },

  /**
   * Mark message as read in bell notifications
   */
  markAsReadInBell(userId: string) {
    this.updateUserState(userId, {
      isReadInBell: true,
      readInBellAt: new Date(),
    });
  },

  /**
   * Mark message as read in system messages
   */
  markAsReadInSystem(userId: string) {
    this.updateUserState(userId, {
      isReadInSystem: true,
      readInSystemAt: new Date(),
    });
  },

  /**
   * Mark message as read in both places (unified read)
   */
  markAsReadEverywhere(userId: string) {
    const now = new Date();
    this.updateUserState(userId, {
      isReadInBell: true,
      readInBellAt: now,
      isReadInSystem: true,
      readInSystemAt: now,
    });
  },

  /**
   * Remove message from bell notifications (but keep in system messages)
   */
  removeFromBell(userId: string) {
    this.updateUserState(userId, {
      isRemovedFromBell: true,
      removedFromBellAt: new Date(),
    });
  },

  /**
   * Delete message from system messages (and auto-remove from bell per REQ 9)
   */
  deleteFromSystem(userId: string) {
    this.updateUserState(userId, {
      isDeletedFromSystem: true,
      deletedFromSystemAt: new Date(),
      isRemovedFromBell: true, // REQ 9: Auto-remove from bell when deleted from system
      removedFromBellAt: new Date(),
    });
  },

  /**
   * Check if message should appear in bell notifications for user
   */
  shouldShowInBell(userId: string): boolean {
    const state = this.getUserState(userId);
    return this.isActive && !state.isRemovedFromBell;
  },

  /**
   * Check if message should appear in system messages for user
   */
  shouldShowInSystem(userId: string): boolean {
    const state = this.getUserState(userId);
    return this.isActive && !state.isDeletedFromSystem;
  },

  /**
   * Get display title for bell notifications
   */
  getBellDisplayTitle(): string {
    // Return the actual message title for navigation (REQ 10)
    return this.title;
  },

  /**
   * Check if user can remove from bell (typically after reading)
   */
  canRemoveFromBell(userId: string): boolean {
    const state = this.getUserState(userId);
    return state.isReadInBell && !state.isRemovedFromBell;
  },
};

// Static Methods
messageSchema.statics.getBellNotificationsForUser = async function (
  userId: string
) {
  const messages = await this.find({
    isActive: true,
    [`userStates.${userId}`]: { $exists: true }, // Only messages where user exists in userStates
    [`userStates.${userId}.isRemovedFromBell`]: { $ne: true },
  }).sort({ createdAt: -1 });

  return messages.map((message: IMessage) => {
    const userState = message.getUserState(userId);
    return {
      id: message._id,
      title: message.getBellDisplayTitle(),
      content: message.content,
      type: message.type,
      priority: message.priority,
      createdAt: message.createdAt,
      isRead: userState.isReadInBell,
      readAt: userState.readInBellAt,
      showRemoveButton: message.canRemoveFromBell(userId),
      // REQ 4: Include "From" information for bell notifications
      creator: {
        firstName: message.creator.firstName,
        lastName: message.creator.lastName,
        authLevel: message.creator.authLevel,
        roleInAtCloud: message.creator.roleInAtCloud,
      },
    };
  });
};

messageSchema.statics.getSystemMessagesForUser = async function (
  userId: string,
  page = 1,
  limit = 20
) {
  const skip = (page - 1) * limit;

  const messages = await this.find({
    isActive: true,
    [`userStates.${userId}.isDeletedFromSystem`]: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments({
    isActive: true,
    [`userStates.${userId}.isDeletedFromSystem`]: { $ne: true },
  });

  return {
    messages: messages.map((message: IMessage) => {
      const userState = message.getUserState(userId);
      return {
        id: message._id,
        title: message.title,
        content: message.content,
        type: message.type,
        priority: message.priority,
        creator: message.creator,
        createdAt: message.createdAt,
        isRead: userState.isReadInSystem,
        readAt: userState.readInSystemAt,
      };
    }),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCount: total,
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

messageSchema.statics.getUnreadCountsForUser = async function (userId: string) {
  const bellNotificationsCount = await this.countDocuments({
    isActive: true,
    [`userStates.${userId}`]: { $exists: true }, // Only messages where user exists in userStates
    [`userStates.${userId}.isRemovedFromBell`]: { $ne: true },
    [`userStates.${userId}.isReadInBell`]: { $ne: true },
  });

  const systemMessagesCount = await this.countDocuments({
    isActive: true,
    [`userStates.${userId}`]: { $exists: true }, // Only messages where user exists in userStates
    [`userStates.${userId}.isDeletedFromSystem`]: { $ne: true },
    [`userStates.${userId}.isReadInSystem`]: { $ne: true },
  });

  return {
    bellNotifications: bellNotificationsCount,
    systemMessages: systemMessagesCount,
    total: bellNotificationsCount, // Bell notifications drive the main notification count
  };
};

messageSchema.statics.createForAllUsers = async function (
  messageData: any,
  userIds: string[]
) {
  const message = new this(messageData);

  // Initialize user states for all users
  const userStatesMap = new Map();
  userIds.forEach((userId) => {
    userStatesMap.set(userId, {
      isReadInBell: false,
      isRemovedFromBell: false,
      isReadInSystem: false,
      isDeletedFromSystem: false,
    });
  });

  message.userStates = userStatesMap;
  await message.save();

  return message;
};

messageSchema.statics.createForSpecificUser = async function (
  messageData: any,
  userId: string
) {
  const message = new this(messageData);

  // Initialize user state for single user
  const userStatesMap = new Map();
  userStatesMap.set(userId, {
    isReadInBell: false,
    isRemovedFromBell: false,
    isReadInSystem: false,
    isDeletedFromSystem: false,
  });

  message.userStates = userStatesMap;
  await message.save();

  return message;
};

export const Message = mongoose.model<IMessage, IMessageModel>(
  "Message",
  messageSchema
);
export default Message;
