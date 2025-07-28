// Welcome message service for new users
import type { AuthUser } from "../types";
import { systemMessageService } from "../services/api";

export interface WelcomeMessageService {
  sendWelcomeMessage: (user: AuthUser) => Promise<void>;
}

// Send welcome message to new users
export const sendWelcomeMessage = async (
  _user?: AuthUser,
  isFirstLogin: boolean = true
): Promise<void> => {
  if (!isFirstLogin) {
    return; // Only send welcome message on first login
  }

  try {
    await systemMessageService.sendWelcomeNotification();
  } catch (error) {
    console.error("Failed to send welcome notification:", error);
  }
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
