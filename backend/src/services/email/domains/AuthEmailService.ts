import { EmailTransporter, EmailOptions } from "../../email";
import {
  generateVerificationEmail,
  generatePasswordResetEmail,
  generatePasswordChangeRequestEmail,
  generatePasswordResetSuccessEmail,
  generateWelcomeEmail,
} from "../../../templates/email";

/**
 * AuthEmailService
 *
 * Handles all authentication and account-related email notifications:
 * - Email verification
 * - Password reset flows
 * - Welcome messages
 * - Account status changes (activation/deactivation)
 *
 * Extracted from EmailService.ts for better organization and maintainability.
 */
export class AuthEmailService {
  /**
   * Core email sending method - delegates to EmailTransporter
   * This is a convenience method to avoid importing EmailTransporter in every method
   */
  private static async sendEmail(options: EmailOptions): Promise<boolean> {
    // Import EmailServiceFacade dynamically to avoid circular dependency
    const { EmailService } = await import(
      "../../infrastructure/EmailServiceFacade"
    );
    return EmailService.sendEmail(options);
  }

  // ===== EXACT COPIES OF METHODS FROM ORIGINAL EmailService.ts =====
  // Methods will be extracted using sed to ensure exact copies
  // Lines will be added below this comment

  static async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<boolean> {
    const verificationUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/verify-email/${verificationToken}`;

    const html = generateVerificationEmail({ name, verificationUrl });

    return this.sendEmail({
      to: email,
      subject: "Welcome to @Cloud Ministry - Please Verify Your Email",
      html,
      text: `Welcome to @Cloud Ministry! Please verify your email by visiting: ${verificationUrl}`,
    });
  }

  static async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string
  ): Promise<boolean> {
    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/reset-password/${resetToken}`;

    const html = generatePasswordResetEmail({ name, resetUrl });

    return this.sendEmail({
      to: email,
      subject: "Password Reset Request - @Cloud Ministry",
      html,
      text: `Password reset requested. Please visit: ${resetUrl} (expires in 10 minutes)`,
    });
  }

  static async sendPasswordChangeRequestEmail(
    email: string,
    name: string,
    confirmToken: string
  ): Promise<boolean> {
    const confirmUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/change-password/confirm/${confirmToken}`;

    const html = generatePasswordChangeRequestEmail({ name, confirmUrl });

    return this.sendEmail({
      to: email,
      subject: "Password Change Request - @Cloud Ministry",
      html,
      text: `Password change requested. Please confirm by visiting: ${confirmUrl} (expires in 10 minutes)`,
    });
  }

  // ===== Guest Email Helpers =====
  /**
   * Stub notification for auto-unpublish events.
   * The integration test spies on this method. Implemented as a thin wrapper around sendEmail
   * (currently no-op under test env). Future enhancement: include list of missing fields.
   */
  static async sendPasswordResetSuccessEmail(
    email: string,
    name: string
  ): Promise<boolean> {
    const resetDateTime = new Date().toLocaleString();
    const html = generatePasswordResetSuccessEmail({ name, resetDateTime });

    return this.sendEmail({
      to: email,
      subject: "Password Changed Successfully - @Cloud Ministry",
      html,
      text: `Your @Cloud Ministry password was changed successfully on ${resetDateTime}. If you didn't make this change, please contact support immediately.`,
    });
  }

  static async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const dashboardUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/dashboard`;

    const html = generateWelcomeEmail({ name, dashboardUrl });

    return this.sendEmail({
      to: email,
      subject: "Welcome to @Cloud Ministry - Account Verified!",
      html,
      text: `Welcome to @Cloud Ministry! Your account has been verified. Visit your dashboard: ${dashboardUrl}`,
    });
  }

  static async sendAccountDeactivationEmail(
    userEmail: string,
    userName: string,
    deactivatedBy: { role: string; firstName?: string; lastName?: string }
  ): Promise<boolean> {
    const actorName = `${deactivatedBy.firstName || ""} ${
      deactivatedBy.lastName || ""
    }`.trim();

    const subject = "Account Deactivation Notification";
    const plainText = `Hello ${userName},\n\nWe wanted to let you know that your account has been deactivated by ${deactivatedBy.role} ${actorName}.\n\nIf you'd like your access restored, our Administrators are happy to help—please reach out to an Admin to request reactivation.\n\nThank you for your understanding.\n\nBest regards,\n\n@Cloud Marketplace Ministry`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; padding: 24px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background: #f9f9f9; padding: 28px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Deactivation Notification</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>We wanted to let you know that your account has been deactivated by <strong>${deactivatedBy.role}</strong> <strong>${actorName}</strong>.</p>
              <p>If you'd like your access restored, our Administrators are happy to help—please reach out to an Admin to request reactivation.</p>
              <p>Thank you for your understanding.</p>
              <p>Best regards,</p>
              <p><strong>@Cloud Marketplace Ministry</strong></p>
            </div>
            <div class="footer">
              <p>@Cloud Marketplace Ministry</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({ to: userEmail, subject, html, text: plainText });
  }

  /**
   * Send account reactivation email to the user (no system message needed)
   */
  static async sendAccountReactivationEmail(
    userEmail: string,
    userName: string,
    reactivatedBy: { role: string; firstName?: string; lastName?: string }
  ): Promise<boolean> {
    const actorName = `${reactivatedBy.firstName || ""} ${
      reactivatedBy.lastName || ""
    }`.trim();

    const subject = "Your @Cloud Account Has Been Reactivated";
    const plainText = `Hello ${userName},\n\nGood news—your account has been reactivated by ${reactivatedBy.role} ${actorName}. You can log in to your account now.\n\nWelcome back!\n\nBest regards,\n\n@Cloud Marketplace Ministry`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 24px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background: #f9f9f9; padding: 28px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Account Has Been Reactivated</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Good news—your account has been reactivated by <strong>${
                reactivatedBy.role
              }</strong> <strong>${actorName}</strong>.</p>
              <p>You can log in to your account now.</p>
              <p style="text-align:center;">
                <a class="button" href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/login">Log In</a>
              </p>
              <p>Welcome back!</p>
              <p>Best regards,</p>
              <p><strong>@Cloud Marketplace Ministry</strong></p>
            </div>
            <div class="footer">
              <p>@Cloud Marketplace Ministry</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({ to: userEmail, subject, html, text: plainText });
  }

  /**
   * Admin alert: user deactivated
   */
}
