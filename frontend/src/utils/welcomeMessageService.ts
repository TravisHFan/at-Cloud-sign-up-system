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
    // Re-throw to let caller handle the error
    throw error;
  }
};

// Check if welcome message was already sent (now uses backend)
export const hasWelcomeMessageBeenSent = async (
  _userId: string
): Promise<boolean> => {
  try {
    const result = await systemMessageService.checkWelcomeMessageStatus();
    return result;
  } catch (error) {
    console.error("Error checking welcome message status:", error);
    // If we can't check, assume not sent to be safe
    return false;
  }
};
