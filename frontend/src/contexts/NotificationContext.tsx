import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type {
  Notification,
  SystemMessage,
  ChatConversation,
} from "../types/notification";

interface NotificationContextType {
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  addNotification: (
    notification: Omit<Notification, "id" | "createdAt">
  ) => void;
  removeNotification: (notificationId: string) => void;

  // System Messages
  systemMessages: SystemMessage[];
  markSystemMessageAsRead: (messageId: string) => void;
  addSystemMessage: (message: Omit<SystemMessage, "id" | "createdAt">) => void;
  deleteSystemMessage: (messageId: string) => void;

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
    id: "1",
    type: "system",
    title: "System Maintenance",
    message: "Scheduled maintenance tonight from 2:00 AM to 4:00 AM",
    isRead: false,
    createdAt: "2025-07-10T10:00:00Z",
  },
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
  {
    id: "3",
    type: "management_action",
    title: "Role Updated",
    message: "Your role has been updated from Participant to Leader",
    isRead: true,
    createdAt: "2025-07-09T15:00:00Z",
    actionType: "promotion",
    actionDetails: {
      fromRole: "Participant",
      toRole: "Leader",
      actorName: "Admin User",
    },
  },
];

const mockSystemMessages: SystemMessage[] = [
  {
    id: "sys_1",
    title: "System Maintenance Schedule",
    content:
      "We will be performing scheduled maintenance on our servers tonight from 2:00 AM to 4:00 AM EST. During this time, the system may be temporarily unavailable. We apologize for any inconvenience.",
    type: "maintenance",
    isRead: false,
    createdAt: "2025-07-10T10:00:00Z",
    priority: "medium",
  },
  {
    id: "sys_2",
    title: "New Feature: Event Notifications",
    content:
      "We're excited to announce our new event notification system! You'll now receive real-time updates about events you're interested in.",
    type: "update",
    isRead: true,
    createdAt: "2025-07-09T12:00:00Z",
    priority: "low",
  },
];

const mockChatConversations: ChatConversation[] = [
  {
    userId: "user_2",
    user: {
      id: "user_2",
      firstName: "Jane",
      lastName: "Smith",
      username: "jane_smith",
      avatar: undefined,
      gender: "female",
    },
    lastMessage: {
      id: "msg_1",
      fromUserId: "user_2",
      toUserId: "current_user",
      message: "Hey, are you available for the event tomorrow?",
      isRead: false,
      createdAt: "2025-07-10T09:30:00Z",
    },
    unreadCount: 2,
    messages: [
      {
        id: "msg_0",
        fromUserId: "current_user",
        toUserId: "user_2",
        message: "Hi Jane! How are you doing?",
        isRead: true,
        createdAt: "2025-07-10T09:00:00Z",
      },
      {
        id: "msg_1",
        fromUserId: "user_2",
        toUserId: "current_user",
        message: "Hey, are you available for the event tomorrow?",
        isRead: false,
        createdAt: "2025-07-10T09:30:00Z",
      },
    ],
  },
];

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] =
    useState<Notification[]>(mockNotifications);
  const [systemMessages, setSystemMessages] =
    useState<SystemMessage[]>(mockSystemMessages);
  const [chatConversations, setChatConversations] = useState<
    ChatConversation[]
  >(mockChatConversations);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, isRead: true }))
    );
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
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== notificationId)
    );
  };

  const markSystemMessageAsRead = (messageId: string) => {
    setSystemMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, isRead: true } : message
      )
    );
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

  const sendMessage = (toUserId: string, message: string) => {
    // Prevent self-messaging - additional safety check
    if (toUserId === "550e8400-e29b-41d4-a716-446655440000") {
      console.warn("Attempted to send message to self - blocked");
      return;
    }

    const newMessage = {
      id: Math.random().toString(36).substr(2, 9),
      fromUserId: "current_user",
      toUserId,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

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
  };

  const addSystemMessage = (
    message: Omit<SystemMessage, "id" | "createdAt">
  ) => {
    const newMessage: SystemMessage = {
      ...message,
      id: `sys_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
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

  const startConversation = (
    userId: string,
    userName: string,
    userGender: "male" | "female"
  ) => {
    // Prevent self-chat - additional safety check
    // Note: This should be handled in the UI, but adding extra safety here
    if (userId === "550e8400-e29b-41d4-a716-446655440000") {
      console.warn("Attempted to start conversation with self - blocked");
      return;
    }

    // Check if conversation already exists
    const existingConv = chatConversations.find(
      (conv) => conv.userId === userId
    );
    if (existingConv) {
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
  };

  const getAllUsers = () => {
    // Mock user list - in real app this would come from API
    return [
      // Current user should be included but will be filtered out in search
      {
        id: "550e8400-e29b-41d4-a716-446655440000", // Matches AuthContext current user ID
        firstName: "John",
        lastName: "Doe",
        username: "john_doe",
        gender: "male" as const,
      },
      {
        id: "user_2",
        firstName: "Jane",
        lastName: "Smith",
        username: "jane_smith",
        gender: "female" as const,
      },
      {
        id: "user_3",
        firstName: "Mike",
        lastName: "Johnson",
        username: "mike_j",
        gender: "male" as const,
      },
      {
        id: "user_4",
        firstName: "Sarah",
        lastName: "Wilson",
        username: "sarah_w",
        gender: "female" as const,
      },
      {
        id: "user_5",
        firstName: "David",
        lastName: "Brown",
        username: "david_brown",
        gender: "male" as const,
      },
    ];
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
      // Create immediate reminder for demo
      setTimeout(() => {
        addSystemMessage({
          title: `Event Reminder: ${eventData.title}`,
          content: `Don't forget! "${eventData.title}" is scheduled for tomorrow from ${eventData.time} - ${eventData.endTime} at ${eventData.location}. Make sure you're prepared!`,
          type: "announcement",
          priority: "high",
          isRead: false,
        });

        addNotification({
          type: "system",
          title: `Event Reminder: ${eventData.title}`,
          message: `Tomorrow from ${eventData.time} - ${eventData.endTime} - ${eventData.location}`,
          isRead: false,
        });
      }, 2000); // Show reminder after 2 seconds for demo
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

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        addNotification,
        removeNotification,
        systemMessages,
        markSystemMessageAsRead,
        addSystemMessage,
        deleteSystemMessage,
        chatConversations,
        markChatAsRead,
        sendMessage,
        startConversation,
        deleteConversation,
        deleteMessage,
        getAllUsers,
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
