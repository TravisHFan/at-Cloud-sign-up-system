import mongoose, { Schema, Document } from "mongoose";

export interface IChatRoom extends Document {
  id: string;
  name: string;
  description?: string;
  type: "general" | "event" | "direct" | "announcement" | "support";
  isPrivate: boolean;
  eventId?: string; // If tied to a specific event
  participants: {
    userId: string;
    username: string;
    name: string;
    role: "admin" | "moderator" | "member";
    joinedAt: Date;
    lastActive?: Date;
    isMuted?: boolean;
  }[];
  settings: {
    allowFileUploads: boolean;
    allowImageUploads: boolean;
    maxMessageLength: number;
    enableReactions: boolean;
    enableThreads: boolean;
  };
  lastMessage?: {
    content: string;
    senderId: string;
    senderName: string;
    sentAt: Date;
    messageType: string;
  };
  messageCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
  archivedAt?: Date;
}

const ChatRoomSchema = new Schema<IChatRoom>(
  {
    name: {
      type: String,
      required: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: ["general", "event", "direct", "announcement", "support"],
      default: "general",
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    eventId: {
      type: String,
      sparse: true,
    },
    participants: [
      {
        userId: {
          type: String,
          required: true,
        },
        username: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        role: {
          type: String,
          enum: ["admin", "moderator", "member"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        lastActive: {
          type: Date,
        },
        isMuted: {
          type: Boolean,
          default: false,
        },
      },
    ],
    settings: {
      allowFileUploads: {
        type: Boolean,
        default: true,
      },
      allowImageUploads: {
        type: Boolean,
        default: true,
      },
      maxMessageLength: {
        type: Number,
        default: 10000,
      },
      enableReactions: {
        type: Boolean,
        default: true,
      },
      enableThreads: {
        type: Boolean,
        default: true,
      },
    },
    lastMessage: {
      content: String,
      senderId: String,
      senderName: String,
      sentAt: Date,
      messageType: String,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: String,
      required: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret: any) => {
        ret.id = ret._id?.toString() || ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
ChatRoomSchema.index({ type: 1, isArchived: 1 });
ChatRoomSchema.index({ eventId: 1 });
ChatRoomSchema.index({ "participants.userId": 1 });
ChatRoomSchema.index({ createdBy: 1 });
ChatRoomSchema.index({ isPrivate: 1, type: 1 });

export const ChatRoom = mongoose.model<IChatRoom>("ChatRoom", ChatRoomSchema);
