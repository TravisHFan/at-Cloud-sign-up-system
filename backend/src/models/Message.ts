import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  id: string;
  content: string;
  senderId: string;
  senderUsername: string;
  senderName: string;
  senderAvatar?: string;
  receiverId?: string; // For direct messages
  eventId?: string; // For event-based group chats
  chatRoomId?: string; // For general chat rooms
  messageType: "text" | "image" | "file" | "system" | "announcement";
  isEdited: boolean;
  editedAt?: Date;
  parentMessageId?: string; // For replies/threads
  mentions?: string[]; // Array of user IDs mentioned in the message
  attachments?: {
    type: "image" | "file" | "link";
    url: string;
    name: string;
    size?: number;
  }[];
  reactions?: {
    userId: string;
    emoji: string;
    createdAt: Date;
  }[];
  isDeleted: boolean;
  deletedAt?: Date;
  readBy?: {
    userId: string;
    readAt: Date;
  }[];
  priority: "normal" | "high" | "urgent";
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    content: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    senderId: {
      type: String,
      required: true,
      index: true,
    },
    senderUsername: {
      type: String,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderAvatar: {
      type: String,
      default: null,
    },
    receiverId: {
      type: String,
      sparse: true,
      index: true,
    },
    eventId: {
      type: String,
      sparse: true,
      index: true,
    },
    chatRoomId: {
      type: String,
      sparse: true,
      index: true,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "file", "system", "announcement"],
      default: "text",
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    parentMessageId: {
      type: String,
      default: null,
      index: true,
    },
    mentions: [
      {
        type: String,
      },
    ],
    attachments: [
      {
        type: {
          type: String,
          enum: ["image", "file", "link"],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        size: {
          type: Number,
        },
      },
    ],
    reactions: [
      {
        userId: {
          type: String,
          required: true,
        },
        emoji: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    readBy: [
      {
        userId: {
          type: String,
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    priority: {
      type: String,
      enum: ["normal", "high", "urgent"],
      default: "normal",
    },
    tags: [
      {
        type: String,
      },
    ],
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

// Indexes for better query performance
MessageSchema.index({ senderId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, createdAt: -1 });
MessageSchema.index({ eventId: 1, createdAt: -1 });
MessageSchema.index({ chatRoomId: 1, createdAt: -1 });
MessageSchema.index({ isDeleted: 1, createdAt: -1 });
MessageSchema.index({ "readBy.userId": 1 });

// Text search index for message content
MessageSchema.index({ content: "text", senderName: "text" });

// Compound indexes for common queries
MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
MessageSchema.index({ eventId: 1, isDeleted: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>("Message", MessageSchema);
