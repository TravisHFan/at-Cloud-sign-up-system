import { useState, useEffect, useRef } from "react";
import { useNotifications } from "../contexts/NotificationContext";
import { useAuth } from "./useAuth";
import { useSocket } from "./useSocket";
import useMessagesApi from "./useMessagesApi";

export const useChatLogic = (userId?: string) => {
  const { currentUser } = useAuth();
  const {
    joinRoom,
    leaveRoom,
    onNewMessage,
    onUserTyping,
    startTyping,
    stopTyping,
  } = useSocket();
  const { getMessages } = useMessagesApi();

  const {
    chatConversations,
    markChatAsRead,
    sendMessage,
    getAllUsers,
    startConversation,
    deleteConversation,
    deleteMessage,
    setActiveChatUser,
  } = useNotifications();

  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(
    userId || null
  );
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);

  // Set initial selected chat based on URL
  useEffect(() => {
    if (userId) {
      setSelectedChatUserId(userId);
    } else {
      setSelectedChatUserId(null);
    }
  }, [userId]);

  // Find the selected conversation
  const selectedConversation = selectedChatUserId
    ? chatConversations.find((conv) => conv.userId === selectedChatUserId) || {
        userId: selectedChatUserId,
        user: {
          id: selectedChatUserId,
          firstName: "Unknown",
          lastName: "User",
          username: `user_${selectedChatUserId}`,
          avatar: undefined,
          gender: "male" as const,
        },
        messages: [],
        unreadCount: 0,
      }
    : null;

  // Check if this is a self-chat attempt
  const isSelfChat = currentUser && selectedChatUserId === currentUser.id;

  // Sync active chat user with selected chat user
  useEffect(() => {
    setActiveChatUser(selectedChatUserId);
  }, [selectedChatUserId, setActiveChatUser]);

  // Cleanup: clear active chat when component unmounts
  useEffect(() => {
    return () => {
      setActiveChatUser(null);
    };
  }, [setActiveChatUser]);

  // Group messages by date
  const groupedMessages =
    selectedConversation?.messages.reduce((groups: any, msg: any) => {
      const date = new Date(msg.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
      return groups;
    }, {}) || {};

  // Socket.IO event handlers
  useEffect(() => {
    if (selectedChatUserId) {
      joinRoom(selectedChatUserId);
      getMessages({ receiverId: selectedChatUserId });

      const unsubscribeNewMessage = onNewMessage((_newMessage) => {
        // Real-time message updates are handled automatically
      });

      const unsubscribeTyping = onUserTyping((data) => {
        if (data.isTyping && data.userId !== currentUser?.id) {
          setTypingUsers((prev) => [
            ...prev.filter((id) => id !== data.userId),
            data.userId,
          ]);
        } else {
          setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
        }
      });

      return () => {
        leaveRoom(selectedChatUserId);
        unsubscribeNewMessage();
        unsubscribeTyping();
      };
    }
  }, [
    selectedChatUserId,
    joinRoom,
    leaveRoom,
    onNewMessage,
    onUserTyping,
    getMessages,
    currentUser?.id,
  ]);

  // Handle typing indicator
  useEffect(() => {
    if (selectedChatUserId) {
      if (isTyping) {
        startTyping(selectedChatUserId);
      } else {
        stopTyping(selectedChatUserId);
      }
    }
  }, [isTyping, selectedChatUserId, startTyping, stopTyping]);

  // Handle selecting a chat
  const handleSelectChat = async (userId: string) => {
    setSelectedChatUserId(userId);
    await markChatAsRead(userId);
    window.history.replaceState({}, "", `/dashboard/chat/${userId}`);
  };

  // Handle clearing chat selection
  const handleClearSelection = () => {
    setSelectedChatUserId(null);
    window.history.replaceState({}, "", "/dashboard/chat");
  };

  // Handle starting a new conversation
  const handleStartConversation = (user: any) => {
    if (currentUser && user.id === currentUser.id) {
      return { error: "Cannot start conversation with yourself" };
    }

    const fullName = `${user.firstName} ${user.lastName}`;
    startConversation(user.id, fullName, user.gender);
    handleSelectChat(user.id);
    return { success: true };
  };

  // Handle sending a message
  const handleSendMessage = (message: string) => {
    if (currentUser && selectedChatUserId === currentUser.id) {
      return { error: "Cannot send messages to yourself" };
    }

    if (message.trim() && selectedChatUserId) {
      sendMessage(selectedChatUserId, message.trim());
      return { success: true };
    }
    return { error: "Invalid message or recipient" };
  };

  // Debounce typing indicator
  const handleKeyDown = () => {
    setIsTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  // Handle scroll events
  const handleScroll = (element: HTMLDivElement) => {
    const { scrollTop, scrollHeight, clientHeight } = element;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200;
    setShowScrollButton(!isNearBottom);
  };

  return {
    // State
    selectedChatUserId,
    selectedConversation,
    isSelfChat,
    typingUsers,
    showScrollButton,
    groupedMessages,
    chatConversations,
    currentUser,

    // Data
    allUsers: getAllUsers(),

    // Handlers
    handleSelectChat,
    handleClearSelection,
    handleStartConversation,
    handleSendMessage,
    handleKeyDown,
    handleScroll,

    // Actions
    deleteConversation,
    deleteMessage,
  };
};
