import { useState, useEffect, useCallback } from "react";
import { messageService } from "../services/api";

export interface Message {
  _id: string;
  content: string;
  senderId: string;
  senderUsername: string;
  senderName: string;
  senderAvatar?: string;
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

export interface UseMessagesApiReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
  totalMessages: number;

  // Core message operations
  fetchMessages: (params?: {
    eventId?: string;
    receiverId?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  sendMessage: (messageData: {
    content: string;
    eventId?: string;
    receiverId?: string;
    messageType?: string;
    parentMessageId?: string;
    mentions?: string[];
    priority?: string;
    tags?: string[];
  }) => Promise<Message | null>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  refreshMessages: () => Promise<void>;
}

export function useMessagesApi(): UseMessagesApiReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);

  const fetchMessages = useCallback(
    async (params?: {
      eventId?: string;
      receiverId?: string;
      page?: number;
      limit?: number;
    }) => {
      try {
        setLoading(true);
        setError(null);

        const response = await messageService.getMessages({
          eventId: params?.eventId,
          receiverId: params?.receiverId,
          page: params?.page || 1,
          limit: params?.limit || 20,
        });

        if (response.success && response.data) {
          const newMessages = response.data.messages || [];
          if (params?.page === 1) {
            setMessages(newMessages);
          } else {
            setMessages((prev) => [...prev, ...newMessages]);
          }
          setTotalMessages(response.data.totalMessages || 0);
          setHasMore(
            (response.data.currentPage || 1) < (response.data.totalPages || 1)
          );
          setPage(response.data.currentPage || 1);
        }
      } catch (err) {
        console.error("Failed to fetch messages:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch messages"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (messageData: {
      content: string;
      eventId?: string;
      receiverId?: string;
      messageType?: string;
      parentMessageId?: string;
      mentions?: string[];
      priority?: string;
      tags?: string[];
    }): Promise<Message | null> => {
      try {
        setError(null);
        const response = await messageService.sendMessage(messageData);

        if (response) {
          const newMessage = response as Message;
          setMessages((prev) => [newMessage, ...prev]);
          setTotalMessages((prev) => prev + 1);
          return newMessage;
        }
        return null;
      } catch (err) {
        console.error("Failed to send message:", err);
        setError(err instanceof Error ? err.message : "Failed to send message");
        return null;
      }
    },
    []
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      try {
        setError(null);
        await messageService.editMessage(messageId, content);

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? { ...msg, content, isEdited: true, updatedAt: new Date() }
              : msg
          )
        );
      } catch (err) {
        console.error("Failed to edit message:", err);
        setError(err instanceof Error ? err.message : "Failed to edit message");
      }
    },
    []
  );

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      setError(null);
      await messageService.deleteMessage(messageId);

      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      setTotalMessages((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to delete message:", err);
      setError(err instanceof Error ? err.message : "Failed to delete message");
    }
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || loading) return;

    await fetchMessages({
      page: page + 1,
      limit: 20,
    });
  }, [fetchMessages, hasMore, loading, page]);

  const refreshMessages = useCallback(async () => {
    setPage(1);
    setHasMore(true);
    await fetchMessages({ page: 1, limit: 20 });
  }, [fetchMessages]);

  // Initial load
  useEffect(() => {
    fetchMessages().catch(console.error);
  }, []);

  return {
    messages,
    loading,
    error,
    hasMore,
    page,
    totalMessages,
    fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    loadMoreMessages,
    refreshMessages,
  };
}
