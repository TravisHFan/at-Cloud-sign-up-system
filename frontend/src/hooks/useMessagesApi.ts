import { useState, useEffect } from "react";
import { messageService } from "../services/api";

export interface Message {
  _id: string;
  content: string;
  senderId: string;
  senderUsername: string;
  senderName: string;
  senderAvatar?: string;
  chatRoomId?: string;
  eventId?: string;
  receiverId?: string;
  messageType: "text" | "image" | "file" | "audio" | "video";
  parentMessageId?: string;
  mentions: string[];
  attachments: Array<{
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  }>;
  reactions: Array<{
    userId: string;
    emoji: string;
    createdAt: Date;
  }>;
  readBy: Array<{
    userId: string;
    readAt: Date;
  }>;
  isEdited: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  priority: "low" | "normal" | "high" | "urgent";
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRoom {
  _id: string;
  name: string;
  description?: string;
  type: "general" | "event" | "direct" | "announcement";
  isPrivate: boolean;
  eventId?: string;
  participants: Array<{
    userId: string;
    username: string;
    name: string;
    role: "admin" | "moderator" | "member";
    joinedAt: Date;
  }>;
  messageCount: number;
  lastMessage?: {
    content: string;
    senderId: string;
    senderName: string;
    sentAt: Date;
    messageType: string;
  };
  createdBy: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const useMessagesApi = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get messages for a chat room or direct conversation
  const getMessages = async (params: {
    chatRoomId?: string;
    eventId?: string;
    receiverId?: string;
    page?: number;
    limit?: number;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const data = await messageService.getMessages(params);
      setMessages(data.messages);
      return data;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to fetch messages";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Send a new message
  const sendMessage = async (messageData: {
    content: string;
    chatRoomId?: string;
    eventId?: string;
    receiverId?: string;
    messageType?: string;
    parentMessageId?: string;
    mentions?: string[];
    attachments?: Array<{
      fileName: string;
      fileUrl: string;
      fileType: string;
      fileSize: number;
    }>;
    priority?: string;
    tags?: string[];
  }) => {
    try {
      setLoading(true);
      setError(null);

      const message = await messageService.sendMessage(messageData);
      // Add the new message to the current messages
      setMessages((prev) => [...prev, message]);
      return message;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to send message";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Edit a message
  const editMessage = async (messageId: string, content: string) => {
    try {
      setLoading(true);
      setError(null);

      const message = await messageService.editMessage(messageId, content);
      // Update the message in the current messages
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, content, isEdited: true } : msg
        )
      );
      return message;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to edit message";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Delete a message
  const deleteMessage = async (messageId: string) => {
    try {
      setLoading(true);
      setError(null);

      const success = await messageService.deleteMessage(messageId);

      if (success) {
        // Remove or mark the message as deleted
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  content: "[Message deleted]",
                  isDeleted: true,
                  deletedAt: new Date(),
                }
              : msg
          )
        );
        return true;
      } else {
        throw new Error("Failed to delete message");
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to delete message";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Add reaction to a message
  const addReaction = async (messageId: string, emoji: string) => {
    try {
      setLoading(true);
      setError(null);

      const message = await messageService.addReaction(messageId, emoji);
      // Update the message with the new reaction
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? message : msg))
      );
      return message;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to add reaction";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Get chat rooms for current user
  const getChatRooms = async () => {
    try {
      setLoading(true);
      setError(null);

      const chatRoomsData = await messageService.getChatRooms();
      setChatRooms(chatRoomsData);
      return chatRoomsData;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to fetch chat rooms";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Create a new chat room
  const createChatRoom = async (chatRoomData: {
    name: string;
    description?: string;
    type?: string;
    isPrivate?: boolean;
    eventId?: string;
    participantIds?: string[];
  }) => {
    try {
      setLoading(true);
      setError(null);

      const chatRoom = await messageService.createChatRoom(chatRoomData);
      // Add the new chat room to the current chat rooms
      setChatRooms((prev) => [chatRoom, ...prev]);
      return chatRoom;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to create chat room";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Load chat rooms on hook initialization
  useEffect(() => {
    getChatRooms().catch(console.error);
  }, []);

  return {
    messages,
    chatRooms,
    loading,
    error,
    getMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    getChatRooms,
    createChatRoom,
    setMessages,
    setChatRooms,
    setError,
  };
};

export default useMessagesApi;
