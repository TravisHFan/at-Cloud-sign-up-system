import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
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
  removeNotification: (notificationId: string) => Promise<void>;

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
  markChatAsRead: (userId: string) => Promise<void>;
  markChatNotificationsAsRead: (fromUserId: string) => Promise<number>;
  sendMessage: (toUserId: string, message: string) => void;
  startConversation: (
    userId: string,
    userName: string,
    userGender: "male" | "female"
  ) => void;
  deleteConversation: (userId: string) => void;
  deleteMessage: (userId: string, messageId: string) => void;
  loadConversationsFromBackend: (forceReload?: boolean) => Promise<void>;

  // User management for chat
  getAllUsers: () => Array<{
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: "male" | "female";
  }>;
  getUserById: (userId: string) =>
    | {
        id: string;
        firstName: string;
        lastName: string;
        username: string;
        avatar?: string;
        gender: "male" | "female";
      }
    | undefined;

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

// Remove mock notifications - we now use backend data exclusively
const mockNotifications: Notification[] = [];

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
  >([]); // Will be loaded from localStorage or backend

  // Load chat conversations from localStorage on mount
  useEffect(() => {
    const loadStoredConversations = () => {
      try {
        // Clean up old global localStorage data
        const oldGlobalData = localStorage.getItem("chatConversations");
        if (oldGlobalData) {
          localStorage.removeItem("chatConversations");
        }

        const userStorageKey = `chatConversations_${currentUser?.id}`;
        const stored = localStorage.getItem(userStorageKey);
        if (stored && currentUser) {
          const conversations = JSON.parse(stored);
          setChatConversations(conversations);
        } else {
          // Clear conversations if no stored data for this user
          setChatConversations([]);
        }
      } catch (error) {
        console.error("❌ Failed to load stored conversations:", error);
        setChatConversations([]);
      }
    };

    if (currentUser) {
      loadStoredConversations();
    } else {
      // Clear conversations when no user is logged in
      setChatConversations([]);
    }
  }, [currentUser]);

  // Save chat conversations to localStorage whenever they change (throttled)
  useEffect(() => {
    if (chatConversations.length > 0 && currentUser) {
      // Throttle localStorage writes to prevent excessive saves
      const timeoutId = setTimeout(() => {
        try {
          // Use user-specific localStorage key
          const userStorageKey = `chatConversations_${currentUser.id}`;
          localStorage.setItem(
            userStorageKey,
            JSON.stringify(chatConversations)
          );
        } catch (error) {
          console.error("❌ Failed to save conversations:", error);
        }
      }, 1000); // Save after 1 second of no changes

      return () => clearTimeout(timeoutId);
    }
  }, [chatConversations, currentUser]);

  // Track which notifications have been dismissed from bell dropdown
  const [dismissedNotifications, setDismissedNotifications] = useState<
    Set<string>
  >(new Set());

  // Track which user the current user is actively chatting with
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);

  // Flag to prevent duplicate backend conversation loading
  const [
    hasLoadedConversationsFromBackend,
    setHasLoadedConversationsFromBackend,
  ] = useState(false);

  // Flag to prevent duplicate user loading
  const [hasLoadedUsers, setHasLoadedUsers] = useState(false);

  // Listen for incoming messages via WebSocket
  useEffect(() => {
    if (!socket || !currentUser) return;

    // Use the onNewMessage method from useSocket hook
    const unsubscribe = socket.onNewMessage((messageData: any) => {
      // Get current user ID to check if this is our own message
      const currentUserId = currentUser?.id;
      const isOwnMessage =
        currentUserId && messageData.fromUserId === currentUserId;

      // Skip processing our own messages
      if (isOwnMessage) {
        return;
      }

      // Debug: Check if messageData is being interpreted as a notification somehow
      if (messageData.title !== undefined || messageData.type !== undefined) {
        console.warn("🚨 Message data has notification-like properties:", {
          title: messageData.title,
          type: messageData.type,
          sender: messageData.sender,
        });
      }

      // Don't create local notifications for chat messages anymore
      // The backend already creates CHAT_MESSAGE notifications which will be fetched via API
      // This prevents duplicate notifications with inconsistent data
      const shouldShowBellNotification = false; // Disabled - handled by backend

      // Instead, refresh notifications from backend after a short delay
      // This ensures we get the properly formatted notification with sender info
      if (!isOwnMessage && messageData.fromUserId !== activeChatUserId) {
        setTimeout(() => {
          refreshNotifications();
        }, 1000); // Delay to allow backend to process the notification
      }

      if (shouldShowBellNotification) {
        const senderName =
          `${messageData.sender.firstName} ${messageData.sender.lastName}`.trim();
        const message = messageData.message || messageData.content || "";

        if (senderName && message) {
          // Add notification to bell
          addNotification({
            type: "user_message",
            title: "New Message",
            message:
              message.length > 80 ? `${message.substring(0, 80)}...` : message,
            isRead: false,
            fromUser: {
              id: messageData.fromUserId,
              firstName: messageData.sender.firstName,
              lastName: messageData.sender.lastName,
              username: messageData.sender.username,
              avatar: messageData.sender.avatar,
              gender: messageData.sender.gender,
            },
          });
        }
      }

      // Update the chat conversation with the new message (only for messages not from current user)
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
          isRead: messageData.fromUserId === activeChatUserId, // Mark as read if actively chatting
          createdAt:
            messageData.createdAt ||
            messageData.timestamp ||
            new Date().toISOString(),
        };

        if (conversationIndex >= 0) {
          // Add message to existing conversation
          const shouldIncrementUnread =
            messageData.fromUserId !== activeChatUserId;
          updatedConversations[conversationIndex] = {
            ...updatedConversations[conversationIndex],
            messages: [
              ...updatedConversations[conversationIndex].messages,
              newMessage,
            ],
            lastMessage: newMessage,
            unreadCount: shouldIncrementUnread
              ? updatedConversations[conversationIndex].unreadCount + 1
              : updatedConversations[conversationIndex].unreadCount,
          };
        } else {
          // Create new conversation for this sender
          // For now, we'll need the sender's details which should be included in messageData
          if (messageData.sender) {
            const shouldIncrementUnread =
              messageData.fromUserId !== activeChatUserId;
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
              unreadCount: shouldIncrementUnread ? 1 : 0,
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

        // Transform messages
        const transformedMessages: SystemMessage[] = backendSystemMessages.map(
          (msg) => {
            // Use the isRead field calculated by the backend (don't recalculate)
            const isRead = (msg as any).isRead || false;

            // Debug each message

            return {
              id: msg.id, // Use id instead of _id
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
                    firstName: msg.creator.firstName || "System",
                    lastName: msg.creator.lastName || "Admin",
                    username: msg.creator.username || "system",
                    avatar: msg.creator.avatar,
                    gender: msg.creator.gender || ("male" as const),
                    roleInAtCloud:
                      msg.creator.roleInAtCloud || "System Administrator",
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

    loadSystemMessages();
  }, []);

  // Set up smart polling for system messages with real-time updates
  useEffect(() => {
    // Increase polling interval to 5 minutes to reduce server load and prevent 429 errors
    const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes

    let interval: NodeJS.Timeout;

    const startPolling = () => {
      interval = setInterval(() => {
        // Only poll if document is visible (user is actively using the app)
        if (document.visibilityState === "visible") {
          refreshSystemMessages();
        } else {
        }
      }, POLLING_INTERVAL);
    };

    // Start polling
    startPolling();

    // Listen for visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // User came back to the app, refresh messages once
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
        return;
      }

      // Don't override recent local changes (within 10 seconds) unless forced
      if (!force) {
        const timeSinceLastUpdate = Date.now() - lastLocalUpdate;
        if (timeSinceLastUpdate < 10000) {
          return;
        }
      }

      // Mark as in progress
      (window as any)._systemMessageRefreshInProgress = true;

      try {
        const backendSystemMessages =
          await systemMessageService.getSystemMessages();

        // Transform backend system messages to frontend format
        const transformedMessages: SystemMessage[] = backendSystemMessages.map(
          (msg) => {
            // Use the isRead field calculated by the backend (don't recalculate)
            const isRead = (msg as any).isRead || false;

            // Debug each message during refresh

            return {
              id: msg.id, // Use id instead of _id
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
                    firstName: msg.creator.firstName || "System",
                    lastName: msg.creator.lastName || "Admin",
                    username: msg.creator.username || "system",
                    avatar: msg.creator.avatar,
                    gender: msg.creator.gender || ("male" as const),
                    roleInAtCloud:
                      msg.creator.roleInAtCloud || "System Administrator",
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

  // Helper function to refresh notifications from backend
  const refreshNotifications = async () => {
    try {
      const backendNotifications = await notificationService.getNotifications();
      setNotifications(backendNotifications || []);
    } catch (error) {
      console.error("Failed to refresh notifications from backend:", error);
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
      title: sysMsg.title || "System Message", // Fallback for empty titles
      message: sysMsg.content || "No content available", // Fallback for empty content
      isRead: sysMsg.isRead,
      createdAt: sysMsg.createdAt,
      systemMessage: sysMsg, // Include full system message data
    }))
    .filter((notification) => {
      // Additional safety check - remove notifications that still have empty content
      const hasValidContent =
        notification.title &&
        notification.title.trim() !== "" &&
        notification.message &&
        notification.message.trim() !== "";
      if (!hasValidContent) {
        console.warn("⚠️ Filtering out invalid notification:", notification);
      }
      return hasValidContent;
    });

  // Combine all notifications for bell dropdown and filter out dismissed ones
  const allNotifications = [...notifications, ...systemMessagesAsNotifications]
    .filter((notification) => !dismissedNotifications.has(notification.id))
    .filter((notification) => {
      // Additional safety check - remove notifications that have empty content
      const hasValidContent =
        notification.title &&
        notification.title.trim() !== "" &&
        notification.message &&
        notification.message.trim() !== "";
      if (!hasValidContent) {
        console.warn("⚠️ Filtering out notification with empty content:", {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
        });
      }
      return hasValidContent;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  // Calculate total unread count from all notifications (including system messages)
  const totalUnreadCount = allNotifications.filter((n) => !n.isRead).length;

  // Debug logging for notification issues

  // Log any notifications with missing content
  allNotifications.forEach((notification, index) => {
    if (!notification.title && !notification.message) {
      console.warn(`⚠️ Empty notification at index ${index}:`, notification);
    }
  });

  const markAsRead = async (notificationId: string) => {
    try {
      // First, determine what type of notification this is
      const regularNotification = notifications.find(
        (n) => n.id === notificationId
      );
      const systemMessageNotification = allNotifications.find(
        (n) => n.id === notificationId && n.type === "system" && n.systemMessage
      );

      if (systemMessageNotification?.systemMessage) {
        // This is a system message shown as notification - use system message API
        await markSystemMessageAsRead(notificationId);
      } else if (regularNotification) {
        // This is a regular notification (like chat message) - use notification API
        await notificationService.markAsRead(notificationId);

        // Update local state
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId
              ? { ...notification, isRead: true }
              : notification
          )
        );

        // For chat notifications, also refresh from backend to ensure consistency
        if (regularNotification.type === "user_message") {
          setTimeout(() => {
            refreshNotifications();
          }, 500);
        }
      } else {
        // Unknown notification type - try both approaches
        console.warn(
          "⚠️ Unknown notification type, trying notification API:",
          notificationId
        );
        await notificationService.markAsRead(notificationId);

        // Refresh notifications to ensure we get the latest state
        setTimeout(() => {
          refreshNotifications();
        }, 500);
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);

      // Fallback: try to update local state for regular notifications
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );

      // And refresh from backend as last resort
      setTimeout(() => {
        refreshNotifications();
      }, 1000);
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

  const removeNotification = async (notificationId: string) => {
    try {
      // Delete from backend first
      await notificationService.deleteNotification(notificationId);

      // Add to dismissed notifications to remove from bell dropdown
      setDismissedNotifications((prev) => new Set(prev).add(notificationId));

      // Also remove from regular notifications array if it exists there
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== notificationId)
      );
    } catch (error) {
      console.error("Failed to delete notification from backend:", error);

      // Still update local state even if backend call fails
      setDismissedNotifications((prev) => new Set(prev).add(notificationId));
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== notificationId)
      );
    }
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

  const markChatAsRead = async (userId: string) => {
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

    // Also mark chat notifications as read on the backend
    try {
      await markChatNotificationsAsRead(userId);
    } catch (error) {
      console.error("Failed to mark chat notifications as read:", error);

      // Fallback: just update local state
      setNotifications((prev) =>
        prev.map((notification: any) =>
          (notification.type === "user_message" ||
            notification.type === "CHAT_MESSAGE") &&
          (notification.fromUser?.id === userId ||
            notification.metadata?.fromUserId === userId)
            ? { ...notification, isRead: true }
            : notification
        )
      );
    }
  };

  const sendMessage = async (toUserId: string, message: string) => {
    // Prevent self-messaging - additional safety check
    if (currentUser && toUserId === currentUser.id) {
      console.warn("Attempted to send message to self - blocked");
      return;
    }

    try {
      // Import the HybridChatService to use the new API
      const { HybridChatService } = await import(
        "../services/hybridChatService"
      );

      // Send message to backend API
      const response = await HybridChatService.sendMessage({
        toUserId,
        content: message,
        messageType: "text",
      });

      // Create local message for immediate UI update
      const newMessage = {
        id: response?.messageId || Math.random().toString(36).substr(2, 9),
        fromUserId: "current_user",
        toUserId,
        message,
        isRead: false,
        createdAt: response?.timestamp || new Date().toISOString(),
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

      // Note: Bell notifications are now handled in the socket message handler
      // This ensures notifications are only shown to the recipient, not the sender
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
        creator: message.creator
          ? {
              id: message.creator.id,
              firstName: message.creator.firstName,
              lastName: message.creator.lastName,
              username: message.creator.username,
              avatar: message.creator.avatar,
              gender: message.creator.gender,
              roleInAtCloud: message.creator.roleInAtCloud,
            }
          : {
              id: userId,
              firstName: "System",
              lastName: "Admin",
              username: "system",
              avatar: undefined,
              gender: "male" as const,
              roleInAtCloud: "System Administrator",
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
        creator: message.creator
          ? {
              id: message.creator.id,
              firstName: message.creator.firstName,
              lastName: message.creator.lastName,
              username: message.creator.username,
              avatar: message.creator.avatar,
              gender: message.creator.gender,
              roleInAtCloud: message.creator.roleInAtCloud,
            }
          : {
              id: userId,
              firstName: "System",
              lastName: "Admin",
              username: "system",
              avatar: undefined,
              gender: "male" as const,
              roleInAtCloud: "System Administrator",
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
      const { HybridChatService } = await import(
        "../services/hybridChatService"
      );

      const messagesData = await HybridChatService.getConversationMessages(
        userId,
        50
      );

      if (messagesData && messagesData.length > 0) {
        // Convert backend messages to frontend format
        const messages = messagesData.map((msg: any) => ({
          id: msg.messageId,
          fromUserId: msg.isFromMe ? "current_user" : userId,
          toUserId: msg.isFromMe ? userId : "current_user",
          message: msg.content,
          isRead: true, // Assume loaded messages are read
          createdAt: msg.timestamp,
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
    if (hasLoadedUsers) return; // Prevent duplicate loading

    const loadAllUsers = async () => {
      // Prevent multiple simultaneous calls
      if ((window as any)._loadingUsersForChat) {
        return;
      }

      try {
        (window as any)._loadingUsersForChat = true;
        setHasLoadedUsers(true);

        const response = await fetch("/api/v1/users", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        });

        if (response.ok) {
          const data = await response.json();

          if (data.success && data.data?.users) {
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
        setAllUsers(mockUsers);
      } finally {
        (window as any)._loadingUsersForChat = false;
      }
    };

    loadAllUsers();
  }, [hasLoadedUsers]); // Add dependency to prevent re-runs

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

  // Get user by ID from loaded users
  const getUserById = (userId: string) => {
    return allUsers.find((user) => user.id === userId);
  };

  // Update conversations with complete user information after users are loaded
  useEffect(() => {
    if (allUsers.length > 0 && chatConversations.length > 0) {
      let hasUpdates = false;

      setChatConversations((prev) => {
        const updated = prev.map((conv) => {
          const fullUserData = getUserById(conv.userId);
          if (
            fullUserData &&
            (!conv.user.firstName || conv.user.firstName === "Unknown")
          ) {
            hasUpdates = true;
            return {
              ...conv,
              user: {
                ...conv.user,
                ...fullUserData,
              },
            };
          }
          return conv;
        });

        // Only update state if there were actual changes
        return hasUpdates ? updated : prev;
      });
    }
  }, [allUsers.length]); // Remove chatConversations.length to prevent loops

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

  // Load conversations from backend messages
  const loadConversationsFromBackend = async () => {
    if (!currentUser || hasLoadedConversationsFromBackend) return;

    // Prevent multiple simultaneous calls
    if ((window as any)._loadingConversationsFromBackend) {
      return;
    }

    try {
      (window as any)._loadingConversationsFromBackend = true;
      setHasLoadedConversationsFromBackend(true);

      const { HybridChatService } = await import(
        "../services/hybridChatService"
      );

      // Get conversations from the new hybrid chat API
      const conversationsData = await HybridChatService.getConversations();

      if (conversationsData && conversationsData.length > 0) {
        // Convert hybrid chat conversations to the format expected by NotificationContext
        const conversations: ChatConversation[] = [];

        for (const conv of conversationsData) {
          const partnerUser = getUserById(conv.partnerId);

          if (partnerUser) {
            conversations.push({
              userId: conv.partnerId,
              user: partnerUser,
              messages: [], // Messages are loaded separately in the new system
              lastMessage: conv.lastMessageContent
                ? {
                    id: conv.lastMessageId || "",
                    fromUserId: conv.lastMessageFromMe
                      ? currentUser.id
                      : conv.partnerId,
                    toUserId: conv.lastMessageFromMe
                      ? conv.partnerId
                      : currentUser.id,
                    message: conv.lastMessageContent,
                    isRead: conv.unreadCount === 0,
                    createdAt: conv.lastMessageTime,
                  }
                : undefined,
              unreadCount: conv.unreadCount,
            });
          }
        }

        setChatConversations(conversations);
      }
    } catch (error) {
      console.error("❌ Failed to load conversations from backend:", error);
    } finally {
      (window as any)._loadingConversationsFromBackend = false;
    }
  }; // Load conversations from backend when users are loaded and no stored conversations exist
  useEffect(() => {
    if (
      allUsers.length > 0 &&
      currentUser &&
      !hasLoadedConversationsFromBackend
    ) {
      // Check user-specific localStorage key
      const userStorageKey = `chatConversations_${currentUser.id}`;
      const hasStoredConversations = localStorage.getItem(userStorageKey);

      // Parse stored conversations to check if they actually contain data
      let hasValidStoredConversations = false;
      if (hasStoredConversations) {
        try {
          const parsed = JSON.parse(hasStoredConversations);
          hasValidStoredConversations =
            Array.isArray(parsed) && parsed.length > 0;
        } catch (e) {
          console.warn(
            "Invalid stored conversations data, will reload from backend"
          );
          hasValidStoredConversations = false;
        }
      }

      // Always try to load from backend if no valid conversations exist OR if chatConversations is empty
      if (!hasValidStoredConversations || chatConversations.length === 0) {
        loadConversationsFromBackend();
      } else {
      }
    }
  }, [
    allUsers.length,
    currentUser,
    hasLoadedConversationsFromBackend,
    chatConversations.length,
  ]); // Add chatConversations.length to dependencies

  const markChatNotificationsAsRead = async (fromUserId: string) => {
    try {
      // Find all unread chat notifications from this specific user
      const chatNotificationsToMarkRead = notifications.filter(
        (notification: any) =>
          (notification.type === "CHAT_MESSAGE" ||
            notification.type === "user_message") &&
          !notification.isRead &&
          (notification.fromUser?.id === fromUserId ||
            notification.metadata?.fromUserId === fromUserId)
      );

      // Mark each notification as read on the backend
      const markReadPromises = chatNotificationsToMarkRead.map(
        async (notification: any) => {
          try {
            await notificationService.markAsRead(notification.id);
            return notification.id;
          } catch (error) {
            console.error(
              `Failed to mark notification ${notification.id} as read:`,
              error
            );
            return null;
          }
        }
      );

      const markedReadIds = (await Promise.all(markReadPromises)).filter(
        Boolean
      );

      // Update local state for successfully marked notifications
      if (markedReadIds.length > 0) {
        setNotifications((prev) =>
          prev.map((notification) =>
            markedReadIds.includes(notification.id)
              ? { ...notification, isRead: true }
              : notification
          )
        );
      }

      return markedReadIds.length;
    } catch (error) {
      console.error("Failed to mark chat notifications as read:", error);
      return 0;
    }
  };

  // Listen for real-time bell notifications via WebSocket
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleNewNotification = (notificationData: any) => {
      // Validate notification structure
      const isValidNotification =
        notificationData.id && notificationData.type && notificationData.title;

      if (!isValidNotification) {
        console.warn(
          "🚫 [NotificationContext] Invalid notification received:",
          notificationData
        );
        return;
      }

      // Show toast notification for immediate feedback (temporary UI notification)
      toast.success(`${notificationData.title}: ${notificationData.message}`, {
        duration: 5000,
      });

      // IMPORTANT: The backend has already saved this notification to the database.
      // Refresh the bell notifications from the database to get the persistent version.

      setTimeout(() => {
        refreshNotifications();
      }, 500); // Small delay to ensure backend has saved the notification
    };

    // Subscribe to notification events
    const unsubscribeNotifications = socket.onNewNotification?.(
      handleNewNotification
    );

    return () => {
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
      }
    };
  }, [socket, currentUser]);

  // Load bell notifications from backend on component mount (CRITICAL FOR PERSISTENCE)
  useEffect(() => {
    const loadNotifications = async () => {
      if (!currentUser) return;

      try {
        const backendNotifications =
          await notificationService.getNotifications();

        // Update bell notifications with database data (this ensures persistence)
        setNotifications(backendNotifications || []);
      } catch (error) {
        console.error(
          "❌ [NotificationContext] Failed to load notifications from database:",
          error
        );
        setNotifications([]);
      }
    };

    loadNotifications();
  }, [currentUser]);

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
        getUserById,
        setActiveChatUser,
        isUserInActiveChat,
        scheduleEventReminder,
        loadConversationsFromBackend,
        markChatNotificationsAsRead,
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
