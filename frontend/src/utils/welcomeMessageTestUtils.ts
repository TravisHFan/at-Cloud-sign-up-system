// Development utility to test welcome message functionality
// DISABLED FOR CSP COMPLIANCE - Global window modifications can trigger CSP eval violations

/* 
CSP Safe implementation - utilities available as named exports instead of global functions

import {
  resetWelcomeMessageStatus,
  sendWelcomeMessage,
} from "./welcomeMessageService";
import { CURRENT_USER } from "../data/mockUserData";

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

// Note: To use these functions in development, import them directly:
// import { testWelcomeMessage, resetWelcomeStatusForTesting } from './utils/welcomeMessageTestUtils';
*/

// Placeholder export to prevent module errors
export const CSP_SAFE_MODE = true;
