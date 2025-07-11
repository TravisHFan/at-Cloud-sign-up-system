// Development utility to test welcome message functionality
import {
  resetWelcomeMessageStatus,
  sendWelcomeMessage,
} from "./welcomeMessageService";
import { CURRENT_USER } from "../data/mockUserData";

// Function to test welcome message (can be called from browser console)
declare global {
  interface Window {
    testWelcomeMessage: () => void;
    resetWelcomeStatus: () => void;
  }
}

// Reset welcome message status for testing
export const resetWelcomeStatusForTesting = () => {
  resetWelcomeMessageStatus(CURRENT_USER.id);
  console.log(
    "Welcome message status reset. Log out and log in again to see welcome message."
  );
};

// Test welcome message directly
export const testWelcomeMessage = () => {
  sendWelcomeMessage(CURRENT_USER, true);
  console.log("Welcome message sent!");
};

// Make functions available globally for testing
if (typeof window !== "undefined") {
  window.testWelcomeMessage = testWelcomeMessage;
  window.resetWelcomeStatus = resetWelcomeStatusForTesting;
}
