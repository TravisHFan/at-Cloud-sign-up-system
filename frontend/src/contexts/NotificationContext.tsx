import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type {
  Notification,
  SystemMessage,
  ChatConversation,
} from "../types/notification";

interface NotificationContextType {
  // Notifications (for bell dropdown - includes system messages)
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  addNotification: (
    notification: Omit<Notification, "id" | "createdAt">
  ) => void;
  removeNotification: (notificationId: string) => void;

  // Combined notifications for bell dropdown (includes system messages converted to notifications)
  allNotifications: Notification[];
  totalUnreadCount: number;

  // System Messages (for dedicated system messages page)
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
  // ANNOUNCEMENT MESSAGES
  {
    id: "sys_1",
    title: "🎉 Welcome to @Cloud Event Management System!",
    content:
      "We're thrilled to announce the launch of our new comprehensive event management platform! This system will streamline event creation, participant management, and communication across all @Cloud initiatives. Explore the dashboard to discover powerful features like real-time notifications, advanced analytics, and seamless role-based access control.",
    type: "announcement",
    isRead: false,
    createdAt: "2025-07-11T09:00:00Z",
    priority: "high",
    creator: {
      id: "ceo_1",
      firstName: "Michael",
      lastName: "Chen",
      username: "m_chen",
      avatar: undefined,
      gender: "male",
      roleInAtCloud: "Chief Executive Officer",
    },
  },
  {
    id: "sys_2",
    title: "New Partnership Announcement",
    content:
      "@Cloud is excited to announce our strategic partnership with TechForward Solutions! This collaboration will enhance our event capabilities and provide additional resources for our community members. Stay tuned for joint events and expanded networking opportunities.",
    type: "announcement",
    isRead: true,
    createdAt: "2025-07-10T14:30:00Z",
    priority: "medium",
    creator: {
      id: "marketing_1",
      firstName: "Emma",
      lastName: "Rodriguez",
      username: "e_rodriguez",
      avatar: undefined,
      gender: "female",
      roleInAtCloud: "Marketing Director",
    },
  },
  {
    id: "sys_3",
    title: "Annual Conference 2025 - Save the Date!",
    content:
      "Mark your calendars! Our annual @Cloud Conference 2025 will be held on October 15-17 at the Grand Convention Center. This year's theme is 'Innovation Through Collaboration.' Early bird registration opens next month with special rates for community members.",
    type: "announcement",
    isRead: false,
    createdAt: "2025-07-09T16:45:00Z",
    priority: "high",
    creator: {
      id: "events_1",
      firstName: "David",
      lastName: "Kim",
      username: "d_kim",
      avatar: undefined,
      gender: "male",
      roleInAtCloud: "Events Coordinator",
    },
  },

  // MAINTENANCE MESSAGES
  {
    id: "sys_4",
    title: "Scheduled System Maintenance Tonight",
    content:
      "We will be performing critical server upgrades and security patches tonight from 2:00 AM to 4:00 AM EST. During this maintenance window, the platform may be temporarily unavailable. All data will be preserved, and we expect minimal downtime. Thank you for your patience as we enhance system performance and security.",
    type: "maintenance",
    isRead: false,
    createdAt: "2025-07-11T10:00:00Z",
    priority: "medium",
    creator: {
      id: "it_1",
      firstName: "Alex",
      lastName: "Thompson",
      username: "a_thompson",
      avatar: undefined,
      gender: "male",
      roleInAtCloud: "IT Operations Manager",
    },
  },
  {
    id: "sys_5",
    title: "Database Optimization Complete",
    content:
      "Good news! Our recent database optimization efforts have been successfully completed. You should notice improved page load times and faster search functionality across the platform. The maintenance was performed during off-peak hours with zero data loss.",
    type: "maintenance",
    isRead: true,
    createdAt: "2025-07-08T08:15:00Z",
    priority: "low",
    creator: {
      id: "it_2",
      firstName: "Sarah",
      lastName: "Wilson",
      username: "s_wilson",
      avatar: undefined,
      gender: "female",
      roleInAtCloud: "Database Administrator",
    },
  },

  // UPDATE MESSAGES
  {
    id: "sys_6",
    title: "New Feature: Enhanced Event Analytics",
    content:
      "We've just released powerful new analytics features! Event organizers can now access detailed participant insights, engagement metrics, and export comprehensive reports. Navigate to the Analytics section in your dashboard to explore real-time event statistics and historical data trends.",
    type: "update",
    isRead: false,
    createdAt: "2025-07-11T11:30:00Z",
    priority: "medium",
    creator: {
      id: "dev_1",
      firstName: "Jennifer",
      lastName: "Park",
      username: "j_park",
      avatar: undefined,
      gender: "female",
      roleInAtCloud: "Product Development Lead",
    },
  },
  {
    id: "sys_7",
    title: "Mobile App Update Available",
    content:
      "Version 2.1.0 of the @Cloud mobile app is now available on iOS and Android! This update includes push notifications for event reminders, improved offline functionality, and a refreshed user interface. Update now for the best experience.",
    type: "update",
    isRead: true,
    createdAt: "2025-07-07T13:20:00Z",
    priority: "low",
    creator: {
      id: "mobile_1",
      firstName: "Ryan",
      lastName: "Martinez",
      username: "r_martinez",
      avatar: undefined,
      gender: "male",
      roleInAtCloud: "Mobile Development Lead",
    },
  },
  {
    id: "sys_8",
    title: "Security Enhancement: Two-Factor Authentication",
    content:
      "We've implemented optional two-factor authentication (2FA) to enhance account security. You can enable 2FA in your profile settings for an additional layer of protection. We highly recommend activating this feature, especially for users with administrative privileges.",
    type: "update",
    isRead: false,
    createdAt: "2025-07-06T15:45:00Z",
    priority: "high",
    creator: {
      id: "security_1",
      firstName: "Lisa",
      lastName: "Zhang",
      username: "l_zhang",
      avatar: undefined,
      gender: "female",
      roleInAtCloud: "Security Officer",
    },
  },

  // WARNING MESSAGES
  {
    id: "sys_9",
    title: "⚠️ Suspicious Login Activity Detected",
    content:
      "Our security system has detected unusual login patterns from multiple IP addresses. If you notice any unauthorized access to your account, please change your password immediately and contact our support team. We've temporarily enhanced monitoring for all accounts as a precautionary measure.",
    type: "warning",
    isRead: false,
    createdAt: "2025-07-11T12:15:00Z",
    priority: "high",
    creator: {
      id: "security_2",
      firstName: "James",
      lastName: "Cooper",
      username: "j_cooper",
      avatar: undefined,
      gender: "male",
      roleInAtCloud: "Security Analyst",
    },
  },
  {
    id: "sys_10",
    title: "Service Degradation Alert",
    content:
      "We're currently experiencing slower than normal response times due to higher than expected traffic. Our engineering team is actively working to resolve this issue. Event registration and core features remain functional, but you may notice delays in loading. Updates will be provided as the situation improves.",
    type: "warning",
    isRead: false,
    createdAt: "2025-07-11T07:45:00Z",
    priority: "medium",
    creator: {
      id: "ops_1",
      firstName: "Maria",
      lastName: "Garcia",
      username: "m_garcia",
      avatar: undefined,
      gender: "female",
      roleInAtCloud: "Operations Manager",
    },
  },
  {
    id: "sys_11",
    title: "Important: Password Policy Update",
    content:
      "Effective immediately, all passwords must meet enhanced security requirements: minimum 12 characters, including uppercase, lowercase, numbers, and special characters. Existing users have 30 days to update their passwords. This change helps protect against increasingly sophisticated cyber threats.",
    type: "warning",
    isRead: true,
    createdAt: "2025-07-05T10:30:00Z",
    priority: "high",
    creator: {
      id: "compliance_1",
      firstName: "Robert",
      lastName: "Johnson",
      username: "r_johnson",
      avatar: undefined,
      gender: "male",
      roleInAtCloud: "Compliance Officer",
    },
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

  // Track which user the current user is actively chatting with
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Convert system messages to notification format for bell dropdown
  const systemMessagesAsNotifications: Notification[] = systemMessages.map(
    (sysMsg) => ({
      id: sysMsg.id,
      type: "system" as const,
      title: sysMsg.title,
      message: sysMsg.content,
      isRead: sysMsg.isRead,
      createdAt: sysMsg.createdAt,
      systemMessage: sysMsg, // Include full system message data
    })
  );

  // Combine all notifications for bell dropdown
  const allNotifications = [
    ...notifications,
    ...systemMessagesAsNotifications,
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const totalUnreadCount = allNotifications.filter((n) => !n.isRead).length;

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
    setSystemMessages((prev) =>
      prev.map((message) => ({ ...message, isRead: true }))
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

    // Update chat conversations
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
    const currentUser = getAllUsers().find(
      (user) => user.id === "550e8400-e29b-41d4-a716-446655440000"
    );

    // Check if the recipient is currently chatting with the sender
    const isRecipientInActiveChatWithSender = isUserInActiveChat(
      "550e8400-e29b-41d4-a716-446655440000",
      toUserId
    );

    if (currentUser && !isRecipientInActiveChatWithSender) {
      addNotification({
        type: "user_message",
        title: "New Message",
        message:
          message.length > 80 ? `${message.substring(0, 80)}...` : message,
        isRead: false,
        fromUser: {
          id: currentUser.id,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          username: currentUser.username,
          avatar: undefined,
          gender: currentUser.gender,
        },
      });
    }
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
        allNotifications,
        totalUnreadCount,
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
