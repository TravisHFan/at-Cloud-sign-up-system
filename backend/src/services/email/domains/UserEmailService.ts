import { EmailService } from "../../infrastructure/emailService";
import { createLogger } from "../../LoggerService";

const log = createLogger("UserEmailService");

/**
 * UserEmailService
 *
 * Handles all user account management notification emails sent to administrators:
 * - User account deactivation alerts
 * - User account reactivation alerts
 * - User account deletion alerts (security notifications)
 *
 * Extracted from EmailService.ts as part of domain-driven refactoring.
 * All methods are exact copies to maintain backward compatibility.
 */
export class UserEmailService {
  /**
   * Send admin alert when a user account is deactivated.
   * Notifies administrators of account status changes for auditing purposes.
   *
   * @param adminEmail - Email address of the administrator to notify
   * @param adminName - Name of the administrator
   * @param target - User whose account was deactivated
   * @param actor - Admin/Leader who performed the deactivation
   * @returns Promise<boolean> - true if email sent successfully
   */
  static async sendUserDeactivatedAlertToAdmin(
    adminEmail: string,
    adminName: string,
    target: { firstName?: string; lastName?: string; email: string },
    actor: {
      firstName?: string;
      lastName?: string;
      email: string;
      role: string;
    }
  ): Promise<boolean> {
    const targetName =
      `${target.firstName || ""} ${target.lastName || ""}`.trim() ||
      target.email;
    const actorName =
      `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email;
    const subject = `Admin Alert: User Account Deactivated (${targetName})`;
    const text = `Hello ${adminName},\n\n${
      actor.role
    } ${actorName} deactivated the account of ${targetName} (${
      target.email
    }).\n\nTime: ${new Date().toLocaleString()}\n\n— @Cloud System`;
    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>${subject}</title>
      <style>body{font-family:Arial,sans-serif;color:#333} .container{max-width:600px;margin:0 auto;padding:20px} .header{background:#ffc107;color:#212529;padding:16px;border-radius:8px 8px 0 0} .content{background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px}</style>
      </head><body><div class="container">
      <div class="header"><h2>Admin Alert: User Deactivated</h2></div>
      <div class="content">
        <p>Hello ${adminName},</p>
        <p><strong>${
          actor.role
        }</strong> <strong>${actorName}</strong> deactivated the account of <strong>${targetName}</strong> (${
      target.email
    }).</p>
        <p><small>Time: ${new Date().toLocaleString()}</small></p>
        <p>— @Cloud System</p>
      </div></div></body></html>`;
    return EmailService.sendEmail({ to: adminEmail, subject, html, text });
  }

  /**
   * Send admin alert when a user account is reactivated.
   * Notifies administrators of account status changes for auditing purposes.
   *
   * @param adminEmail - Email address of the administrator to notify
   * @param adminName - Name of the administrator
   * @param target - User whose account was reactivated
   * @param actor - Admin/Leader who performed the reactivation
   * @returns Promise<boolean> - true if email sent successfully
   */
  static async sendUserReactivatedAlertToAdmin(
    adminEmail: string,
    adminName: string,
    target: { firstName?: string; lastName?: string; email: string },
    actor: {
      firstName?: string;
      lastName?: string;
      email: string;
      role: string;
    }
  ): Promise<boolean> {
    const targetName =
      `${target.firstName || ""} ${target.lastName || ""}`.trim() ||
      target.email;
    const actorName =
      `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email;
    const subject = `Admin Alert: User Account Reactivated (${targetName})`;
    const text = `Hello ${adminName},\n\n${
      actor.role
    } ${actorName} reactivated the account of ${targetName} (${
      target.email
    }).\n\nTime: ${new Date().toLocaleString()}\n\n— @Cloud System`;
    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>${subject}</title>
      <style>body{font-family:Arial,sans-serif;color:#333} .container{max-width:600px;margin:0 auto;padding:20px} .header{background:#28a745;color:#fff;padding:16px;border-radius:8px 8px 0 0} .content{background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px}</style>
      </head><body><div class="container">
      <div class="header"><h2>Admin Alert: User Reactivated</h2></div>
      <div class="content">
        <p>Hello ${adminName},</p>
        <p><strong>${
          actor.role
        }</strong> <strong>${actorName}</strong> reactivated the account of <strong>${targetName}</strong> (${
      target.email
    }).</p>
        <p><small>Time: ${new Date().toLocaleString()}</small></p>
        <p>— @Cloud System</p>
      </div></div></body></html>`;
    return EmailService.sendEmail({ to: adminEmail, subject, html, text });
  }

  /**
   * Send security alert when a user account is permanently deleted.
   * Critical notification for administrators about permanent data deletion.
   *
   * @param adminEmail - Email address of the administrator to notify
   * @param adminName - Name of the administrator
   * @param target - User whose account was deleted
   * @param actor - Admin who performed the deletion
   * @returns Promise<boolean> - true if email sent successfully
   */
  static async sendUserDeletedAlertToAdmin(
    adminEmail: string,
    adminName: string,
    target: { firstName?: string; lastName?: string; email: string },
    actor: {
      firstName?: string;
      lastName?: string;
      email: string;
      role: string;
    }
  ): Promise<boolean> {
    const targetName =
      `${target.firstName || ""} ${target.lastName || ""}`.trim() ||
      target.email;
    const actorName =
      `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email;
    const subject = `Security Alert: User Deleted (${targetName})`;
    const text = `Hello ${adminName},\n\n${
      actor.role
    } ${actorName} permanently deleted the user ${targetName} (${
      target.email
    }).\n\nTime: ${new Date().toLocaleString()}\n\n— @Cloud System`;
    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>${subject}</title>
      <style>body{font-family:Arial,sans-serif;color:#333} .container{max-width:600px;margin:0 auto;padding:20px} .header{background:#dc3545;color:#fff;padding:16px;border-radius:8px 8px 0 0} .content{background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px}</style>
      </head><body><div class="container">
      <div class="header"><h2>Security Alert: User Deleted</h2></div>
      <div class="content">
        <p>Hello ${adminName},</p>
        <p><strong>${
          actor.role
        }</strong> <strong>${actorName}</strong> permanently deleted the user <strong>${targetName}</strong> (${
      target.email
    }).</p>
        <p><small>Time: ${new Date().toLocaleString()}</small></p>
        <p>— @Cloud System</p>
      </div></div></body></html>`;
    return EmailService.sendEmail({ to: adminEmail, subject, html, text });
  }

  /**
   * Send new @Cloud co-worker signup notification to admins.
   * Notifies administrators when a new user signs up with @Cloud co-worker role.
   *
   * @param adminEmail - Email address of the administrator to notify
   * @param adminName - Name of the administrator
   * @param userData - New user's registration data
   * @returns Promise<boolean> - true if email sent successfully
   */
  static async sendNewAtCloudLeaderSignupToAdmins(
    adminEmail: string,
    adminName: string,
    userData: {
      firstName: string;
      lastName: string;
      email: string;
      roleInAtCloud: string;
    }
  ): Promise<boolean> {
    const userName = `${userData.firstName} ${userData.lastName}`.trim();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New @Cloud Co-worker Signup - Admin Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .admin-alert { background: #e2e3f1; border-left: 4px solid #6f42c1; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .user-details { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #6f42c1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 New @Cloud Co-worker Signup</h1>
              <p>Administrative Oversight Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName},</h2>
              <div class="admin-alert">
                <h3>New @Cloud Co-worker Registration</h3>
                <p>A new user has signed up as an @Cloud co-worker.</p>
              </div>
              <div class="user-details">
                <h4>New User Details</h4>
                <p><strong>Name:</strong> ${userName}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>@Cloud Role:</strong> ${userData.roleInAtCloud}</p>
                <p><strong>Status:</strong> New @Cloud Co-worker</p>
              </div>
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/users" class="button">
                  Review in Admin Dashboard
                </a>
              </div>
              <p>Please welcome the new leader and provide ministry onboarding as appropriate.</p>
              <p>Best regards,<br>@Cloud Ministry System</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Administrative Oversight</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return EmailService.sendEmail({
      to: adminEmail,
      subject: `🎉 New @Cloud Co-worker Signup - ${userName}`,
      html,
      text: `New @Cloud Co-worker Signup: ${userName} (${userData.email}) has signed up as an @Cloud co-worker with role: ${userData.roleInAtCloud}`,
    });
  }
}
