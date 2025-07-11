// Welcome message service for new users
import type { AuthUser } from "../types";
import { SUPER_ADMIN_USER } from "../data/mockUserData";

export interface WelcomeMessageService {
  sendWelcomeMessage: (user: AuthUser) => void;
}

// This will be injected by the NotificationProvider
let notificationService: {
  addSystemMessage: (message: any) => void;
  addNotification: (notification: any) => void;
} | null = null;

// Function to inject the notification service
export const setNotificationService = (service: {
  addSystemMessage: (message: any) => void;
  addNotification: (notification: any) => void;
}) => {
  notificationService = service;
};

// Send welcome message to new users
export const sendWelcomeMessage = (
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

  // Create welcome system message from Super Admin
  notificationService.addSystemMessage({
    title: "🎉 Welcome to @Cloud Event Management System!",
    content: `Hello ${user.firstName}! Welcome to the @Cloud Event Management System. We're excited to have you join our community! Here you can discover upcoming events, connect with other members, and participate in exciting activities. Feel free to explore the platform and don't hesitate to reach out if you need any assistance. Happy networking!`,
    type: "announcement",
    priority: "high",
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

  // Also add to bell notification dropdown
  notificationService.addNotification({
    type: "system",
    title: "🎉 Welcome to @Cloud!",
    message: `Welcome ${user.firstName}! Your account has been successfully set up.`,
    isRead: false,
  });

  // Store that welcome message has been sent for this user
  localStorage.setItem(`welcomeSent_${user.id}`, "true");
};

// Check if welcome message was already sent
export const hasWelcomeMessageBeenSent = (userId: string): boolean => {
  return localStorage.getItem(`welcomeSent_${userId}`) === "true";
};

// Reset welcome message status (for testing purposes)
export const resetWelcomeMessageStatus = (userId: string) => {
  localStorage.removeItem(`welcomeSent_${userId}`);
};
