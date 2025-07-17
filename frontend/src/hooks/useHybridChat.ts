import { useState, useEffect, useCallback, useRef } from "react";
import { HybridChatService } from "../services/hybridChatService";
import type {
  ChatConversation,
  ChatMessage,
  SendMessageRequest,
} from "../services/hybridChatService";
import { useSocket } from "./useSocket";
import { useAuth } from "./useAuth";

export interface UseHybridChatReturn {
  // State
  conversations: ChatConversation[];
  currentMessages: ChatMessage[];
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  isTyping: boolean;
  typingUsers: string[];

  // Actions
  sendMessage: (
    content: string,
    messageType?: "text" | "image" | "file"
  ) => Promise<void>;
  selectConversation: (partnerId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  searchMessages: (query: string, partnerId?: string) => Promise<ChatMessage[]>;
  markAsRead: (partnerId: string) => Promise<void>;
  pinConversation: (partnerId: string, pinned: boolean) => Promise<void>;
  muteConversation: (partnerId: string, muted: boolean) => Promise<void>;
  archiveConversation: (partnerId: string, archived: boolean) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;

  // Real-time
  startTyping: () => void;
  stopTyping: () => void;

  // Utils
  refreshConversations: () => Promise<void>;
  getConversation: (partnerId: string) => ChatConversation | undefined;
  hasUnreadMessages: boolean;
  totalUnreadCount: number;
}

export const useHybridChat = (
  initialPartnerId?: string
): UseHybridChatReturn => {
  const { currentUser } = useAuth();
  const {
    socket,
    joinRoom,
    leaveRoom,
    onNewMessage,
    onUserTyping,
    startTyping: socketStartTyping,
    stopTyping: socketStopTyping,
  } = useSocket();

  // State
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(initialPartnerId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Refs
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentMessagesRef = useRef<ChatMessage[]>([]);

  // Update ref when messages change
  useEffect(() => {
    currentMessagesRef.current = currentMessages;
  }, [currentMessages]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Handle initial partner selection
  useEffect(() => {
    if (initialPartnerId && conversations.length > 0) {
      selectConversation(initialPartnerId);
    }
  }, [initialPartnerId, conversations]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !currentUser) return;

    // Handle new messages
    const handleNewMessage = (message: any) => {

      // Update conversations list
      loadConversations();

      // Update current messages if this message is for the active conversation
      if (
        activeConversationId &&
        (message.senderId === activeConversationId ||
          message.receiverId === activeConversationId)
      ) {
        setCurrentMessages((prev) => [
          ...prev,
          {
            messageId: message.messageId,
            content: message.content,
            messageType: message.messageType,
            isFromMe: message.senderId === currentUser.id,
            senderName: message.senderName,
            senderUsername: message.senderUsername,
            senderAvatar: message.senderAvatar,
            timestamp: message.timestamp,
            isDeleted: false,
            attachments: message.attachments || [],
          },
        ]);
      }
    };

    // Handle typing indicators
    const handleUserTyping = (data: any) => {
      if (data.userId === activeConversationId) {
        setTypingUsers((prev) => {
          if (data.isTyping && !prev.includes(data.username)) {
            return [...prev, data.username];
          } else if (!data.isTyping) {
            return prev.filter((user) => user !== data.username);
          }
          return prev;
        });
      }
    };

    onNewMessage(handleNewMessage);
    onUserTyping(handleUserTyping);

    return () => {
      // Cleanup listeners
      socket.off("direct_message", handleNewMessage);
      socket.off("user_typing", handleUserTyping);
    };
  }, [socket, currentUser, activeConversationId, onNewMessage, onUserTyping]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await HybridChatService.getConversations();
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load conversations"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Select conversation and load messages
  const selectConversation = useCallback(
    async (partnerId: string) => {
      if (activeConversationId === partnerId) return;

      try {
        setIsLoading(true);
        setError(null);

        // Leave previous room
        if (activeConversationId && currentUser) {
          leaveRoom(`chat_${currentUser.id}_${activeConversationId}`);
        }

        // Set active conversation
        setActiveConversationId(partnerId);

        // Join new room
        if (currentUser) {
          joinRoom(`chat_${currentUser.id}_${partnerId}`);
        }

        // Load messages
        const messages = await HybridChatService.getConversationMessages(
          partnerId
        );
        setCurrentMessages(messages);

        // Mark as read
        await markAsRead(partnerId);
      } catch (err) {
        console.error("Failed to select conversation:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load conversation"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeConversationId, currentUser, joinRoom, leaveRoom]
  );

  // Send message
  const sendMessage = useCallback(
    async (
      content: string,
      messageType: "text" | "image" | "file" = "text"
    ) => {
      if (!activeConversationId || !content.trim()) return;

      try {
        setError(null);

        const request: SendMessageRequest = {
          toUserId: activeConversationId,
          content: content.trim(),
          messageType,
        };

        const response = await HybridChatService.sendMessage(request);

        // Optimistically add message to current messages
        const newMessage: ChatMessage = {
          messageId: response.messageId,
          content: content.trim(),
          messageType,
          isFromMe: true,
          senderName:
            currentUser?.firstName + " " + currentUser?.lastName || "You",
          senderUsername: currentUser?.username || "you",
          senderAvatar: currentUser?.avatar || undefined,
          timestamp: response.timestamp,
          isDeleted: false,
          attachments: [],
        };

        setCurrentMessages((prev) => [...prev, newMessage]);

        // Refresh conversations to update last message
        loadConversations();
      } catch (err) {
        console.error("Failed to send message:", err);
        setError(err instanceof Error ? err.message : "Failed to send message");
      }
    },
    [activeConversationId, currentUser, loadConversations]
  );

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!activeConversationId || currentMessages.length === 0) return;

    try {
      const oldestMessage = currentMessages[0];
      const olderMessages = await HybridChatService.getConversationMessages(
        activeConversationId,
        50,
        oldestMessage.timestamp
      );

      setCurrentMessages((prev) => [...olderMessages, ...prev]);
    } catch (err) {
      console.error("Failed to load more messages:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load more messages"
      );
    }
  }, [activeConversationId, currentMessages]);

  // Search messages
  const searchMessages = useCallback(
    async (query: string, partnerId?: string) => {
      try {
        const result = await HybridChatService.searchMessages(query, partnerId);
        return result.messages;
      } catch (err) {
        console.error("Failed to search messages:", err);
        throw err;
      }
    },
    []
  );

  // Mark conversation as read
  const markAsRead = useCallback(async (partnerId: string) => {
    try {
      await HybridChatService.markConversationAsRead(partnerId);

      // Update local conversation state
      setConversations((prev) =>
        prev.map((conv) =>
          conv.partnerId === partnerId ? { ...conv, unreadCount: 0 } : conv
        )
      );
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  }, []);

  // Pin conversation
  const pinConversation = useCallback(
    async (partnerId: string, pinned: boolean) => {
      try {
        await HybridChatService.pinConversation(partnerId, pinned);

        // Update local state
        setConversations((prev) =>
          prev.map((conv) =>
            conv.partnerId === partnerId ? { ...conv, isPinned: pinned } : conv
          )
        );
      } catch (err) {
        console.error("Failed to pin conversation:", err);
        throw err;
      }
    },
    []
  );

  // Mute conversation
  const muteConversation = useCallback(
    async (partnerId: string, muted: boolean) => {
      try {
        await HybridChatService.muteConversation(partnerId, muted);

        // Update local state
        setConversations((prev) =>
          prev.map((conv) =>
            conv.partnerId === partnerId ? { ...conv, isMuted: muted } : conv
          )
        );
      } catch (err) {
        console.error("Failed to mute conversation:", err);
        throw err;
      }
    },
    []
  );

  // Archive conversation
  const archiveConversation = useCallback(
    async (partnerId: string, archived: boolean) => {
      try {
        await HybridChatService.archiveConversation(partnerId, archived);

        // Update local state
        setConversations((prev) =>
          prev.map((conv) =>
            conv.partnerId === partnerId
              ? { ...conv, isArchived: archived }
              : conv
          )
        );
      } catch (err) {
        console.error("Failed to archive conversation:", err);
        throw err;
      }
    },
    []
  );

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      await HybridChatService.deleteMessage(messageId);

      // Update local state
      setCurrentMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === messageId
            ? {
                ...msg,
                isDeleted: true,
                content: "This message has been deleted",
              }
            : msg
        )
      );
    } catch (err) {
      console.error("Failed to delete message:", err);
      throw err;
    }
  }, []);

  // Typing handlers
  const startTyping = useCallback(() => {
    if (!activeConversationId || isTyping) return;

    setIsTyping(true);
    socketStartTyping(activeConversationId);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [activeConversationId, isTyping, socketStartTyping]);

  const stopTyping = useCallback(() => {
    if (!activeConversationId || !isTyping) return;

    setIsTyping(false);
    socketStopTyping(activeConversationId);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [activeConversationId, isTyping, socketStopTyping]);

  // Utils
  const getConversation = useCallback(
    (partnerId: string) => {
      return conversations.find((conv) => conv.partnerId === partnerId);
    },
    [conversations]
  );

  const hasUnreadMessages = conversations.some((conv) => conv.unreadCount > 0);
  const totalUnreadCount = conversations.reduce(
    (total, conv) => total + conv.unreadCount,
    0
  );

  return {
    // State
    conversations,
    currentMessages,
    activeConversationId,
    isLoading,
    error,
    isTyping,
    typingUsers,

    // Actions
    sendMessage,
    selectConversation,
    loadMoreMessages,
    searchMessages,
    markAsRead,
    pinConversation,
    muteConversation,
    archiveConversation,
    deleteMessage,

    // Real-time
    startTyping,
    stopTyping,

    // Utils
    refreshConversations: loadConversations,
    getConversation,
    hasUnreadMessages,
    totalUnreadCount,
  };
};

export default useHybridChat;
