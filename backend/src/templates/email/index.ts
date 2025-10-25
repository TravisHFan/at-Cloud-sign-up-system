/**
 * Email Templates Index
 *
 * Central export point for all email templates
 */

export {
  generateVerificationEmail,
  type VerificationEmailData,
} from "./verificationEmail";

export {
  generatePasswordResetEmail,
  type PasswordResetEmailData,
} from "./passwordResetEmail";

export {
  generatePasswordChangeRequestEmail,
  type PasswordChangeRequestEmailData,
} from "./passwordChangeRequestEmail";

export {
  generatePasswordResetSuccessEmail,
  type PasswordResetSuccessEmailData,
} from "./passwordResetSuccessEmail";

export { generateWelcomeEmail, type WelcomeEmailData } from "./welcomeEmail";
