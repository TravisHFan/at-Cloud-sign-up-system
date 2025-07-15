// Welcome message service for new users
import type { AuthUser } from "../types";
import { SUPER_ADMIN_USER } from "../data/mockUserData";
import { systemMessageService } from "../services/api";

export interface WelcomeMessageService {
  sendWelcomeMessage: (user: AuthUser) => void;
}

// This will be injected by the NotificationProvider
let notificationService: {
  addSystemMessage: (message: any) => void;
  addAutoSystemMessage: (message: any) => void;
  addNotification: (notification: any) => void;
} | null = null;

// Function to inject the notification service
export const setNotificationService = (service: {
  addSystemMessage: (message: any) => void;
  addAutoSystemMessage: (message: any) => void;
  addNotification: (notification: any) => void;
}) => {
  notificationService = service;
};

// Send welcome message to new users
export const sendWelcomeMessage = async (
  user: AuthUser,
  isFirstLogin: boolean = true
) => {
  if (!notificationService) {
    console.warn("Notification service not available for welcome message");
    return;
  }

  if (!isFirstLogin) {
    return; // Only send welcome message on first login
  }

  try {
    // Check with backend if user already received welcome message
    const hasReceived = await systemMessageService.checkWelcomeMessageStatus();
    if (hasReceived) {
      console.log(
        `User ${user.id} already received welcome message, skipping...`
      );
      return;
    }
  } catch (error) {
    console.error("Error checking welcome message status:", error);
    // If we can't check, proceed anyway - backend will handle duplicates
  }

  // Create welcome system message from Super Admin (targeted to specific user)
  notificationService.addAutoSystemMessage({
    title: "🎉 Welcome to @Cloud Event Management System!",
    content: `Hello ${user.firstName}! Welcome to the @Cloud Event Management System. We're excited to have you join our community! Here you can discover upcoming events, connect with other members, and participate in exciting activities. Feel free to explore the platform and don't hesitate to reach out if you need any assistance. Happy networking!`,
    type: "announcement",
    priority: "high",
    targetUserId: user.id, // Target this message specifically to the new user
    isRead: false,
    creator: {
      id: SUPER_ADMIN_USER.id,
      firstName: SUPER_ADMIN_USER.firstName,
      lastName: SUPER_ADMIN_USER.lastName,
      role: SUPER_ADMIN_USER.role,
      avatar: SUPER_ADMIN_USER.avatar,
      gender: SUPER_ADMIN_USER.gender,
    },
  });
};

// Check if welcome message was already sent (now uses backend)
export const hasWelcomeMessageBeenSent = async (
  _userId: string
): Promise<boolean> => {
  try {
    return await systemMessageService.checkWelcomeMessageStatus();
  } catch (error) {
    console.error("Error checking welcome message status:", error);
    return false; // If we can't check, assume not sent
  }
};

// Reset welcome message status (for testing purposes) - now backend-based
export const resetWelcomeMessageStatus = (userId: string) => {
  console.warn(
    "resetWelcomeMessageStatus is deprecated - use backend admin tools to reset user.hasReceivedWelcomeMessage"
  );
  // Remove localStorage fallback
  localStorage.removeItem(`welcomeSent_${userId}`);
};
