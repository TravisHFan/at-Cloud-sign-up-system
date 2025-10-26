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
}
