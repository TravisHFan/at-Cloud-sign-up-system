import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type {
  Notification,
  SystemMessage,
  ChatConversation,
  ChatMessage,
} from "../types/notification";
import {
  getAllUsers as getCentralizedUsers,
  getUserById,
} from "../data/mockUserData";
import { notificationService } from "../services/notificationService";
import { systemMessageService } from "../services/systemMessageService";
import { setNotificationService } from "../utils/welcomeMessageService";
import { securityAlertService } from "../utils/securityAlertService";
import { systemMessageIntegration } from "../utils/systemMessageIntegration";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";

interface NotificationContextType {
  // Notifications (for bell dropdown - includes system messages)
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (
    notification: Omit<Notification, "id" | "createdAt">
  ) => void;
  removeNotification: (notificationId: string) => void;

  // Combined notifications for bell dropdown (includes system messages converted to notifications)
  allNotifications: Notification[];
  totalUnreadCount: number;

  // System Messages (for dedicated system messages page)
  systemMessages: SystemMessage[];
  markSystemMessageAsRead: (messageId: string) => Promise<void>;
  addSystemMessage: (
    message: Omit<SystemMessage, "id" | "createdAt">
  ) => Promise<void>;
  addAutoSystemMessage: (
    message: Omit<SystemMessage, "id" | "createdAt">
  ) => Promise<void>;
  deleteSystemMessage: (messageId: string) => void;
  addRoleChangeSystemMessage: (data: {
    targetUserName: string;
    targetUserId: string;
    fromSystemAuthLevel: string;
    toSystemAuthLevel: string;
    actorUserId: string;
    actorName: string;
  }) => void;

  // Chat Conversations
  chatConversations: ChatConversation[];
  markChatAsRead: (userId: string) => void;
  sendMessage: (toUserId: string, message: string) => void;
  startConversation: (
    userId: string,
    userName: string,
    userGender: "male" | "female"
  ) => void;
  deleteConversation: (userId: string) => void;
  deleteMessage: (userId: string, messageId: string) => void;

  // User management for chat
  getAllUsers: () => Array<{
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: "male" | "female";
  }>;

  // Active chat session tracking
  setActiveChatUser: (userId: string | null) => void;
  isUserInActiveChat: (senderId: string, recipientId: string) => boolean;

  // Event reminder functionality
  scheduleEventReminder: (eventData: {
    id: string;
    title: string;
    date: string;
    time: string;
    endTime: string;
    location: string;
  }) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

// Mock data for demonstration
const mockNotifications: Notification[] = [
  {
    id: "2",
    type: "user_message",
    title: "New Message",
    message: "Hey, are you available for the event tomorrow?",
    isRead: false,
    createdAt: "2025-07-10T09:30:00Z",
    fromUser: {
      id: "user_2",
      firstName: "Jane",
      lastName: "Smith",
      username: "jane_smith",
      avatar: undefined,
      gender: "female",
    },
  },
];

// Helper function to create system message creator from centralized user data
const createSystemMessageCreator = (
  userId: string,
  customRoleInAtCloud?: string
) => {
  const user = getUserById(userId);
  if (!user) {
    throw new Error(`User with ID ${userId} not found in centralized data`);
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatar: user.avatar || undefined,
    gender: user.gender,
    roleInAtCloud:
      customRoleInAtCloud || user.roleInAtCloud || `${user.role} User`,
  };
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const socket = useSocket();

  const [notifications, setNotifications] =
    useState<Notification[]>(mockNotifications);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]); // Start with empty array instead of mock data
  const [lastLocalUpdate, setLastLocalUpdate] = useState<number>(0); // Track when we last updated locally
  const [chatConversations, setChatConversations] = useState<
    ChatConversation[]
  >([]); // Start with empty chat conversations - no mock data

  // Track which notifications have been dismissed from bell dropdown
  const [dismissedNotifications, setDismissedNotifications] = useState<
    Set<string>
  >(new Set());

  // Track which user the current user is actively chatting with
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);

  // Listen for incoming messages via WebSocket
  useEffect(() => {
    if (!socket || !currentUser) return;

    // Use the onNewMessage method from useSocket hook
    const unsubscribe = socket.onNewMessage((messageData: any) => {
      console.log("📨 Received new message via socket:", messageData);

      // Update the chat conversation with the new message
      setChatConversations((prev) => {
        const updatedConversations = [...prev];
        const conversationIndex = updatedConversations.findIndex(
          (conv) => conv.user.id === messageData.fromUserId
        );

        const newMessage: ChatMessage = {
          id: messageData.id,
          fromUserId: messageData.fromUserId,
          toUserId: messageData.toUserId,
          message: messageData.message || messageData.content,
          isRead: false,
          createdAt:
            messageData.createdAt ||
            messageData.timestamp ||
            new Date().toISOString(),
        };

        if (conversationIndex >= 0) {
          // Add message to existing conversation
          updatedConversations[conversationIndex] = {
            ...updatedConversations[conversationIndex],
            messages: [
              ...updatedConversations[conversationIndex].messages,
              newMessage,
            ],
            lastMessage: newMessage,
            unreadCount:
              updatedConversations[conversationIndex].unreadCount + 1,
          };
        } else {
          // Create new conversation for this sender
          console.log(
            "📝 Creating new conversation for sender:",
            messageData.fromUserId
          );
          // For now, we'll need the sender's details which should be included in messageData
          if (messageData.sender) {
            const newConversation: ChatConversation = {
              userId: messageData.fromUserId,
              user: {
                id: messageData.fromUserId,
                firstName: messageData.sender.firstName,
                lastName: messageData.sender.lastName,
                username: messageData.sender.username,
                avatar: messageData.sender.avatar || "/default-avatar-male.jpg",
                gender: messageData.sender.gender || "male",
              },
              messages: [newMessage],
              lastMessage: newMessage,
              unreadCount: 1,
            };
            updatedConversations.unshift(newConversation);
          }
        }

        return updatedConversations;
      });
    });

    return unsubscribe;
  }, [socket, currentUser]);

  // Load notifications from backend on component mount
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const backendNotifications =
          await notificationService.getNotifications();
        // Always update with backend data, even if empty
        setNotifications(backendNotifications || []);
      } catch (error) {
        console.error("Failed to load notifications from backend:", error);
        // Keep using mock data if backend fails
      }
    };

    loadNotifications();
  }, []);

  // Load system messages from backend on component mount
  useEffect(() => {
    const loadSystemMessages = async () => {
      try {
        const backendSystemMessages =
          await systemMessageService.getSystemMessages();

        // Debug logging
        const currentUserId = getUserIdFromAuth();
        console.log("🔍 DEBUG: Current user ID from token:", currentUserId);
        console.log(
          "🔍 DEBUG: Backend system messages:",
          backendSystemMessages
        ); // Transform backend system messages to frontend format
        const transformedMessages: SystemMessage[] = backendSystemMessages.map(
          (msg) => {
            // Use the isRead field calculated by the backend (don't recalculate)
            const isRead = (msg as any).isRead || false;

            // Debug each message
            console.log(`🔍 DEBUG: Message "${msg.title}":`, {
              backendIsRead: (msg as any).isRead,
              currentUserId,
              finalIsRead: isRead,
              readByUsersRemoved: "Backend removes readByUsers for privacy",
            });

            return {
              id: msg._id,
              title: msg.title,
              content: msg.content,
              type: msg.type,
              isRead,
              createdAt: msg.createdAt,
              priority: msg.priority,
              targetUserId: msg.targetUserId,
              creator: msg.creator
                ? {
                    id: msg.creator.id,
                    firstName: msg.creator.name
                      ? msg.creator.name.split(" ")[0]
                      : "System",
                    lastName: msg.creator.name
                      ? msg.creator.name.split(" ")[1] || ""
                      : "Admin",
                    username: msg.creator.email
                      ? msg.creator.email.split("@")[0]
                      : "system",
                    avatar: undefined,
                    gender: "male" as const,
                    roleInAtCloud: "System Administrator",
                  }
                : undefined,
            };
          }
        );

        setSystemMessages(transformedMessages);
      } catch (error) {
        console.error("Failed to load system messages from backend:", error);
        // Keep using mock data if backend fails
      }
    };

    console.log(
      "🔄 DEBUG: Initial load triggered - calling loadSystemMessages"
    );
    loadSystemMessages();
  }, []);

  // Set up smart polling for system messages with real-time updates
  useEffect(() => {
    // Increase polling interval to 3 minutes to reduce server load
    const POLLING_INTERVAL = 3 * 60 * 1000; // 3 minutes

    let interval: number;

    const startPolling = () => {
      interval = setInterval(() => {
        // Only poll if document is visible (user is actively using the app)
        if (document.visibilityState === "visible") {
          console.log(
            "🔄 DEBUG: Smart polling triggered - refreshing system messages"
          );
          refreshSystemMessages();
        } else {
          console.log("🔄 DEBUG: Skipping poll - document not visible");
        }
      }, POLLING_INTERVAL);
    };

    // Start polling
    startPolling();

    // Listen for visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // User came back to the app, refresh messages once
        console.log("🔄 DEBUG: User returned - refreshing system messages");
        refreshSystemMessages();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Clean up interval and listener on unmount
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Helper function to get current user ID from auth token
  const getUserIdFromAuth = () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) return null;

      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.userId;
    } catch (error) {
      console.error("Error decoding auth token:", error);
      return null;
    }
  };

  // Helper function to refresh system messages from backend
  const refreshSystemMessages = async (force = false) => {
    try {
      const userId = getUserIdFromAuth();
      if (!userId) return;

      // Prevent duplicate requests by checking if a request is already in progress
      if ((window as any)._systemMessageRefreshInProgress) {
        console.log(
          "🔄 DEBUG: System message refresh already in progress, skipping..."
        );
        return;
      }

      // Don't override recent local changes (within 10 seconds) unless forced
      if (!force) {
        const timeSinceLastUpdate = Date.now() - lastLocalUpdate;
        if (timeSinceLastUpdate < 10000) {
          console.log("Skipping refresh to preserve recent local changes");
          return;
        }
      }

      // Mark as in progress
      (window as any)._systemMessageRefreshInProgress = true;

      try {
        const backendSystemMessages =
          await systemMessageService.getSystemMessages();

        console.log("🔄 DEBUG: Refreshing system messages for user:", userId);

        // Transform backend system messages to frontend format
        const transformedMessages: SystemMessage[] = backendSystemMessages.map(
          (msg) => {
            // Use the isRead field calculated by the backend (don't recalculate)
            const isRead = (msg as any).isRead || false;

            // Debug each message during refresh
            console.log(`🔄 DEBUG: Refresh - Message "${msg.title}":`, {
              backendIsRead: (msg as any).isRead,
              userId,
              finalIsRead: isRead,
              readByUsersRemoved: "Backend removes readByUsers for privacy",
            });

            return {
              id: msg._id,
              title: msg.title,
              content: msg.content,
              type: msg.type,
              isRead,
              createdAt: msg.createdAt,
              priority: msg.priority,
              targetUserId: msg.targetUserId,
              creator: msg.creator
                ? {
                    id: msg.creator.id,
                    firstName: msg.creator.name
                      ? msg.creator.name.split(" ")[0]
                      : "System",
                    lastName: msg.creator.name
                      ? msg.creator.name.split(" ")[1] || ""
                      : "Admin",
                    username: msg.creator.email
                      ? msg.creator.email.split("@")[0]
                      : "system",
                    avatar: undefined,
                    gender: "male" as const,
                    roleInAtCloud: "System Administrator",
                  }
                : undefined,
            };
          }
        );

        setSystemMessages(transformedMessages);
      } catch (innerError) {
        console.error("Error fetching system messages:", innerError);
      } finally {
        // Always clear the in-progress flag
        (window as any)._systemMessageRefreshInProgress = false;
      }
    } catch (error) {
      console.error("Error in refreshSystemMessages:", error);
      // Clear the flag in case of any error
      (window as any)._systemMessageRefreshInProgress = false;
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Convert system messages to notification format for bell dropdown
  // Filter auth level changes to only show for targeted users
  const systemMessagesAsNotifications: Notification[] = systemMessages
    .filter((sysMsg) => {
      if (sysMsg.type === "auth_level_change") {
        // Only show auth level change messages to the targeted user
        const currentUserId = getUserIdFromAuth();
        return sysMsg.targetUserId === currentUserId;
      }

      // Show all other system messages to everyone (including real security alerts)
      return true;
    })
    .map((sysMsg) => ({
      id: sysMsg.id,
      type: "system" as const,
      title: sysMsg.title,
      message: sysMsg.content,
      isRead: sysMsg.isRead,
      createdAt: sysMsg.createdAt,
      systemMessage: sysMsg, // Include full system message data
    }));

  // Combine all notifications for bell dropdown and filter out dismissed ones
  const allNotifications = [...notifications, ...systemMessagesAsNotifications]
    .filter((notification) => !dismissedNotifications.has(notification.id))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const totalUnreadCount = allNotifications.filter((n) => !n.isRead).length;

  const markAsRead = async (notificationId: string) => {
    try {
      // Update backend first
      await notificationService.markAsRead(notificationId);

      // Then update local state
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      // Still update local state even if backend call fails
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );
    }
  };

  const markAllAsRead = async () => {
    try {
      // Update backend first
      await notificationService.markAllAsRead();

      // Then update local state
      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, isRead: true }))
      );
      setSystemMessages((prev) =>
        prev.map((message) => ({ ...message, isRead: true }))
      );
      // Clear dismissed notifications when marking all as read
      setDismissedNotifications(new Set());
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      // Still update local state even if backend call fails
      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, isRead: true }))
      );
      setSystemMessages((prev) =>
        prev.map((message) => ({ ...message, isRead: true }))
      );
      // Clear dismissed notifications when marking all as read
      setDismissedNotifications(new Set());
    }
  };

  const addNotification = (
    notification: Omit<Notification, "id" | "createdAt">
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  const removeNotification = (notificationId: string) => {
    // Add to dismissed notifications to remove from bell dropdown
    setDismissedNotifications((prev) => new Set(prev).add(notificationId));

    // Also remove from regular notifications array if it exists there
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== notificationId)
    );
  };

  const markSystemMessageAsRead = async (messageId: string) => {
    try {
      // Update local state immediately (optimistic update)
      setSystemMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? { ...message, isRead: true } : message
        )
      );

      // Track when we made this local change
      setLastLocalUpdate(Date.now());

      // Call the backend API to mark as read
      const success = await systemMessageService.markAsRead(messageId);

      if (!success) {
        console.error("Failed to mark system message as read in backend");
        // Revert local state if backend call fails
        setSystemMessages((prev) =>
          prev.map((message) =>
            message.id === messageId ? { ...message, isRead: false } : message
          )
        );
      } else {
        // After 15 seconds, force refresh to ensure we're in sync with backend
        setTimeout(() => {
          refreshSystemMessages(true);
        }, 15000);
      }
    } catch (error) {
      console.error("Error marking system message as read:", error);
      // Revert local state if backend call fails
      setSystemMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? { ...message, isRead: false } : message
        )
      );
    }
  };

  const markChatAsRead = (userId: string) => {
    setChatConversations((prev) =>
      prev.map((conv) =>
        conv.userId === userId
          ? {
              ...conv,
              unreadCount: 0,
              messages: conv.messages.map((msg) => ({ ...msg, isRead: true })),
            }
          : conv
      )
    );

    // Also mark notification as read
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.type === "user_message" &&
        notification.fromUser?.id === userId
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const sendMessage = async (toUserId: string, message: string) => {
    // Prevent self-messaging - additional safety check
    if (currentUser && toUserId === currentUser.id) {
      console.warn("Attempted to send message to self - blocked");
      return;
    }

    try {
      console.log("📤 Sending message to backend:", { toUserId, message });

      // Import the API client dynamically to avoid circular imports
      const { messageService } = await import("../services/api");

      // Send message to backend API
      const response = await messageService.sendMessage({
        content: message,
        receiverId: toUserId,
        messageType: "text",
      });

      console.log("✅ Message sent successfully:", response);

      // Create local message for immediate UI update
      const newMessage = {
        id: response?._id || Math.random().toString(36).substr(2, 9),
        fromUserId: "current_user",
        toUserId,
        message,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      // Update chat conversations locally for immediate feedback
      setChatConversations((prev) =>
        prev.map((conv) =>
          conv.userId === toUserId
            ? {
                ...conv,
                lastMessage: newMessage,
                messages: [...conv.messages, newMessage],
              }
            : conv
        )
      );

      // Create a notification for the recipient in the bell dropdown
      // Only if the recipient is NOT currently in an active chat with the sender
      const currentUserForNotification = getAllUsers().find(
        (user) => user.id === currentUser?.id
      );

      // Check if the recipient is currently chatting with the sender
      const isRecipientInActiveChatWithSender = currentUser
        ? isUserInActiveChat(currentUser.id, toUserId)
        : false;

      if (currentUserForNotification && !isRecipientInActiveChatWithSender) {
        addNotification({
          type: "user_message",
          title: "New Message",
          message:
            message.length > 80 ? `${message.substring(0, 80)}...` : message,
          isRead: false,
          fromUser: {
            id: currentUserForNotification.id,
            firstName: currentUserForNotification.firstName,
            lastName: currentUserForNotification.lastName,
            username: currentUserForNotification.username,
            avatar: undefined,
            gender: currentUserForNotification.gender,
          },
        });
      }
    } catch (error) {
      console.error("❌ Failed to send message:", error);
      // You might want to show a toast or error message to the user here
    }
  };

  const addSystemMessage = async (
    message: Omit<SystemMessage, "id" | "createdAt">
  ) => {
    try {
      // Get current user info for creator field
      const userId = getUserIdFromAuth();
      if (!userId) {
        console.error("User not authenticated");
        return;
      }

      // Create the message data for backend
      const messageData = {
        title: message.title,
        content: message.content,
        type: message.type,
        priority: message.priority,
        targetUserId: message.targetUserId,
        creator: {
          id: message.creator?.id || userId,
          name: message.creator
            ? `${message.creator.firstName} ${message.creator.lastName}`
            : "System Admin",
          email: message.creator
            ? `${message.creator.username}@example.com`
            : "admin@atcloud.com",
        },
        expiresAt: undefined, // Can be extended later if needed
      };

      // Call backend API to create system message
      const success = await systemMessageService.createSystemMessage(
        messageData
      );

      if (success) {
        // Refresh system messages from backend to get the new message (force refresh)
        await refreshSystemMessages(true);
      } else {
        console.error("Failed to create system message");
      }
    } catch (error) {
      console.error("Error creating system message:", error);
    }
  };

  const addAutoSystemMessage = async (
    message: Omit<SystemMessage, "id" | "createdAt">
  ) => {
    try {
      // Get current user info for creator field
      const userId = getUserIdFromAuth();
      if (!userId) {
        console.error("User not authenticated");
        return;
      }

      // Create the message data for backend
      const messageData = {
        title: message.title,
        content: message.content,
        type: message.type,
        priority: message.priority,
        targetUserId: message.targetUserId,
        creator: {
          id: message.creator?.id || userId,
          name: message.creator
            ? `${message.creator.firstName} ${message.creator.lastName}`
            : "System Admin",
          email: message.creator
            ? `${message.creator.username}@example.com`
            : "admin@atcloud.com",
        },
        expiresAt: undefined, // Can be extended later if needed
      };

      // Call backend API to create auto system message (doesn't require admin)
      const success = await systemMessageService.createAutoSystemMessage(
        messageData
      );

      if (success) {
        // Refresh system messages from backend to get the new message (force refresh)
        await refreshSystemMessages(true);
      } else {
        console.error("Failed to create auto system message");
      }
    } catch (error) {
      console.error("Error creating auto system message:", error);
    }
  };

  const addRoleChangeSystemMessage = (data: {
    targetUserName: string;
    targetUserId: string;
    fromSystemAuthLevel: string;
    toSystemAuthLevel: string;
    actorUserId: string;
    actorName: string;
  }) => {
    const isPromotion =
      ["Super Admin", "Administrator", "Leader"].indexOf(
        data.toSystemAuthLevel
      ) >
      ["Super Admin", "Administrator", "Leader"].indexOf(
        data.fromSystemAuthLevel
      );

    const actionWord = isPromotion ? "promoted" : "updated";
    const emoji = isPromotion ? "🎯" : "🔄";

    const newMessage: SystemMessage = {
      id: `sys_${Math.random().toString(36).substr(2, 9)}`,
      title: `${emoji} System Auth Level ${
        isPromotion ? "Promotion" : "Update"
      }: ${data.targetUserName}`,
      content: isPromotion
        ? `Congratulations to ${data.targetUserName}! They have been ${actionWord} from ${data.fromSystemAuthLevel} to ${data.toSystemAuthLevel}. This promotion grants them access to expanded platform features and new responsibilities. Welcome to the enhanced authorization level!`
        : `${data.targetUserName}'s system authorization level has been ${actionWord} from ${data.fromSystemAuthLevel} to ${data.toSystemAuthLevel}. Their access permissions and available features have been adjusted accordingly.`,
      type: "auth_level_change",
      isRead: false,
      createdAt: new Date().toISOString(),
      priority: isPromotion ? "medium" : "low",
      targetUserId: data.targetUserId,
      creator: createSystemMessageCreator(data.actorUserId),
    };
    setSystemMessages((prev) => [newMessage, ...prev]);
  };

  const deleteSystemMessage = (messageId: string) => {
    setSystemMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  };

  const deleteConversation = (userId: string) => {
    setChatConversations((prev) =>
      prev.filter((conv) => conv.userId !== userId)
    );
  };

  const deleteMessage = (userId: string, messageId: string) => {
    setChatConversations((prev) =>
      prev.map((conv) =>
        conv.userId === userId
          ? {
              ...conv,
              messages: conv.messages.filter((msg) => msg.id !== messageId),
              lastMessage:
                conv.messages
                  .filter((msg) => msg.id !== messageId)
                  .slice(-1)[0] || undefined,
            }
          : conv
      )
    );
  };

  const loadMessagesForUser = async (userId: string) => {
    try {
      console.log("📥 Loading messages for user:", userId);
      const { messageService } = await import("../services/api");

      const messagesData = await messageService.getMessages({
        receiverId: userId,
        page: 1,
        limit: 50,
      });

      console.log("📥 Messages loaded:", messagesData);

      if (messagesData?.messages) {
        // Convert backend messages to frontend format
        const messages = messagesData.messages.reverse().map((msg: any) => ({
          id: msg._id,
          fromUserId:
            msg.senderId === currentUser?.id ? "current_user" : msg.senderId,
          toUserId: msg.receiverId,
          message: msg.content,
          isRead: true, // Assume loaded messages are read
          createdAt: msg.createdAt,
        }));

        // Update conversation with loaded messages
        setChatConversations((prev) =>
          prev.map((conv) =>
            conv.userId === userId
              ? {
                  ...conv,
                  messages: messages,
                  lastMessage:
                    messages.length > 0
                      ? messages[messages.length - 1]
                      : undefined,
                }
              : conv
          )
        );
      }
    } catch (error) {
      console.error("❌ Failed to load messages for user:", userId, error);
    }
  };

  const startConversation = async (
    userId: string,
    userName: string,
    userGender: "male" | "female"
  ) => {
    // Prevent self-chat - additional safety check
    // Note: This should be handled in the UI, but adding extra safety here
    if (currentUser && userId === currentUser.id) {
      console.warn("Attempted to start conversation with self - blocked");
      return;
    }

    // Check if conversation already exists
    const existingConv = chatConversations.find(
      (conv) => conv.userId === userId
    );
    if (existingConv) {
      // Load messages for existing conversation if not already loaded
      if (existingConv.messages.length === 0) {
        await loadMessagesForUser(userId);
      }
      return; // Conversation already exists
    }

    // Create new conversation
    const newConversation: ChatConversation = {
      userId,
      user: {
        id: userId,
        firstName: userName.split(" ")[0] || "Unknown",
        lastName: userName.split(" ")[1] || "User",
        username: userName.toLowerCase().replace(" ", "_"),
        avatar: undefined,
        gender: userGender,
      },
      lastMessage: undefined,
      messages: [],
      unreadCount: 0,
    };

    setChatConversations((prev) => [newConversation, ...prev]);

    // Load existing messages for the new conversation
    await loadMessagesForUser(userId);
  };

  const [allUsers, setAllUsers] = useState<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      username: string;
      avatar?: string;
      gender: "male" | "female";
    }>
  >([]);

  // Load all users for chat functionality
  useEffect(() => {
    const loadAllUsers = async () => {
      try {
        console.log("🔄 Loading users for chat...");
        const response = await fetch("/api/v1/users", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        });

        console.log("📊 Users API response status:", response.status);

        if (response.ok) {
          const data = await response.json();
          console.log("📊 Users API response data:", data);

          if (data.success && data.data?.users) {
            console.log(
              "🔍 Raw user data from API:",
              data.data.users.length,
              "users"
            );
            const users = data.data.users.map((user: any) => {
              return {
                id: user._id || user.id, // Try both _id and id fields
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                avatar: user.avatar || undefined,
                gender: user.gender,
              };
            });
            console.log("✅ Loaded", users.length, "users for chat:", users);
            setAllUsers(users);
          } else {
            console.warn("⚠️ Unexpected response format:", data);
          }
        } else {
          // Fallback to mock data if API fails
          console.warn("⚠️ Failed to load users from API, using mock data");
          const mockUsers = getCentralizedUsers().map((user) => ({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            avatar: user.avatar || undefined,
            gender: user.gender,
          }));
          console.log("📋 Using mock users:", mockUsers);
          setAllUsers(mockUsers);
        }
      } catch (error) {
        console.error("❌ Error loading users:", error);
        // Fallback to mock data on error
        const mockUsers = getCentralizedUsers().map((user) => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          avatar: user.avatar || undefined,
          gender: user.gender,
        }));
        console.log("📋 Using mock users after error:", mockUsers);
        setAllUsers(mockUsers);
      }
    };

    loadAllUsers();
  }, []);

  const getAllUsers = (): Array<{
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: "male" | "female";
  }> => {
    return allUsers;
  };

  // Active chat session tracking
  const setActiveChatUser = (userId: string | null) => {
    setActiveChatUserId(userId);
  };

  const isUserInActiveChat = (senderId: string, _recipientId: string) => {
    // In a real app, this would check if the recipient is currently viewing
    // the chat window with the sender. For now, we'll simulate this by checking
    // if the current user's active chat matches the sender's ID

    // If the recipient (current user) is currently chatting with the sender,
    // then no notification should be sent
    return activeChatUserId === senderId;
  };

  const scheduleEventReminder = (eventData: {
    id: string;
    title: string;
    date: string;
    time: string;
    endTime: string;
    location: string;
  }) => {
    // Calculate reminder time (1 day before event)
    const eventDateTime = new Date(`${eventData.date}T${eventData.time}`);
    const reminderTime = new Date(
      eventDateTime.getTime() - 24 * 60 * 60 * 1000
    );
    const now = new Date();

    // For demo purposes, create reminder immediately if event is within 2 days
    const timeDiff = eventDateTime.getTime() - now.getTime();
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    if (daysDiff <= 2 && daysDiff > 0) {
      // Create immediate reminder for demo (shows what users would see 1 day before)
      setTimeout(() => {
        // Use system message integration for event reminders
        // Note: In a real system, we'd need to get the organizer ID from the event data
        systemMessageIntegration.sendEventReminderSystemMessage(
          {
            id: eventData.id,
            title: eventData.title,
            date: eventData.date,
            time: eventData.time,
            endTime: eventData.endTime,
            location: eventData.location,
          },
          "organizer_id_placeholder" // In real system, get from event data
        );

        addNotification({
          type: "system",
          title: `[DEMO] Event Reminder: ${eventData.title}`,
          message: `Demo reminder for ${eventData.date} from ${eventData.time} - ${eventData.endTime}`,
          isRead: false,
        });
      }, 3000); // Show reminder after 3 seconds for demo with clear messaging
    }

    // In a real application, you would:
    // 1. Store the reminder in backend database
    // 2. Use a job scheduler (like cron) to send reminders
    // 3. Send email notifications via email service
    console.log(
      `Reminder scheduled for ${reminderTime.toISOString()} for event: ${
        eventData.title
      }`
    );
  };

  // Register notification service for welcome messages and security alerts
  useEffect(() => {
    setNotificationService({
      addSystemMessage: addAutoSystemMessage,
      addAutoSystemMessage,
      addNotification,
    });

    // Setup security alert service with notification context
    securityAlertService.setNotificationContext({
      addSystemMessage: addAutoSystemMessage,
      addNotification,
    });

    // Setup system message integration service
    systemMessageIntegration.setNotificationContext({
      addSystemMessage: addAutoSystemMessage,
    });
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        addNotification,
        removeNotification,
        allNotifications,
        totalUnreadCount,
        systemMessages,
        markSystemMessageAsRead,
        addSystemMessage,
        addAutoSystemMessage,
        addRoleChangeSystemMessage,
        deleteSystemMessage,
        chatConversations,
        markChatAsRead,
        sendMessage,
        startConversation,
        deleteConversation,
        deleteMessage,
        getAllUsers,
        setActiveChatUser,
        isUserInActiveChat,
        scheduleEventReminder,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }
  return context;
}
