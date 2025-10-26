/**
 * PromoCodeEmailService.ts
 * Domain service for promo code-related email notifications
 *
 * Handles notifications for promo code lifecycle events:
 * - Staff promo code assignment (new codes granted to users)
 * - Promo code deactivation (code disabled by admin)
 * - Promo code reactivation (code re-enabled by admin)
 */

import { EmailService } from "../../infrastructure/emailService";
import { createLogger } from "../../LoggerService";

const log = createLogger("PromoCodeEmailService");

export class PromoCodeEmailService {
  /**
   * Send staff promo code notification to user
   */
  static async sendStaffPromoCodeEmail(params: {
    recipientEmail: string;
    recipientName: string;
    promoCode: string;
    discountPercent: number;
    allowedPrograms?: string;
    expiresAt?: string;
    createdBy: string;
  }): Promise<boolean> {
    const {
      recipientEmail,
      recipientName,
      promoCode,
      discountPercent,
      allowedPrograms,
      expiresAt,
      createdBy,
    } = params;

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
    const promoCodesUrl = `${frontend}/dashboard/promo-codes`;

    const expiryText = expiresAt
      ? `This code expires on ${new Date(expiresAt).toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        )}.`
      : "This code never expires.";

    const programText = allowedPrograms
      ? `for ${allowedPrograms}`
      : "for all programs";

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You've Received a Staff Access Code - @Cloud Ministry</title>
    <style>
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; }
      .container { max-width: 600px; margin: 0 auto; background: white; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
      .header h1 { color: white; margin: 0; font-size: 28px; }
      .content { padding: 40px 30px; }
      .code-card { background: #f9fafb; border: 2px dashed #9333ea; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
      .code { font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; color: #9333ea; letter-spacing: 2px; margin: 15px 0; }
      .details { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0; }
      .details h3 { margin: 0 0 15px 0; color: #92400e; font-size: 18px; }
      .details p { margin: 8px 0; color: #78350f; }
      .cta-button { display: inline-block; background: #9333ea; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
      .cta-button:hover { background: #7e22ce; }
      .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
      .emoji { font-size: 48px; margin-bottom: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="emoji">🎁</div>
        <h1>You've Received a Staff Access Code!</h1>
      </div>
      
      <div class="content">
        <p>Hi ${escapeHtml(recipientName)},</p>
        
        <p>Great news! You've been granted a <strong>${discountPercent}% discount code</strong> ${programText} by ${escapeHtml(
      createdBy
    )}.</p>
        
        <div class="code-card">
          <div style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Your Promo Code</div>
          <div class="code">${escapeHtml(promoCode)}</div>
          <div style="color: #6b7280; font-size: 14px; margin-top: 10px;">Copy this code to use at checkout</div>
        </div>
        
        <div class="details">
          <h3>📋 Code Details</h3>
          <p><strong>Discount:</strong> ${discountPercent}% off</p>
          <p><strong>Valid for:</strong> ${
            allowedPrograms || "All programs"
          }</p>
          <p><strong>Status:</strong> ${expiryText}</p>
        </div>
        
        <p style="margin-top: 30px;">Ready to use your code? View it anytime in your promo codes dashboard:</p>
        
        <div style="text-align: center;">
          <a href="${promoCodesUrl}" class="cta-button" style="display: inline-block; background: #9333ea; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0;">View My Promo Codes →</a>
        </div>
        
        <p style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <strong>How to use:</strong> When enrolling in a program, enter this code at checkout to receive your discount.
        </p>
      </div>
      
      <div class="footer">
        <p>This is an automated message from @Cloud Ministry.</p>
        <p>If you have any questions, please contact atcloudministry@gmail.com</p>
        <p style="margin-top: 20px;">
          <a href="${promoCodesUrl}" style="color: #9333ea; text-decoration: none;">Manage My Promo Codes</a>
        </p>
      </div>
    </div>
  </body>
</html>
    `.trim();

    const text = `
You've Received a Staff Access Code!

Hi ${recipientName},

Great news! You've been granted a ${discountPercent}% discount code ${programText} by ${createdBy}.

Your Promo Code: ${promoCode}

Code Details:
- Discount: ${discountPercent}% off
- Valid for: ${allowedPrograms || "All programs"}
- Status: ${expiryText}

View your promo codes: ${promoCodesUrl}

How to use: When enrolling in a program, enter this code at checkout to receive your discount.

Blessings,
The @Cloud Ministry Team
    `.trim();

    log.info(
      `Sending staff promo code email to ${recipientEmail} with code ${promoCode}`
    );

    return EmailService.sendEmail({
      to: recipientEmail,
      subject: `🎁 You've Received a ${discountPercent}% Discount Code!`,
      html,
      text,
    });
  }

  /**
   * Send promo code deactivation notification to user
   */
  static async sendPromoCodeDeactivatedEmail(params: {
    recipientEmail: string;
    recipientName: string;
    promoCode: string;
    discountPercent: number;
    allowedPrograms?: string;
    deactivatedBy: string;
  }): Promise<boolean> {
    const {
      recipientEmail,
      recipientName,
      promoCode,
      discountPercent,
      allowedPrograms,
      deactivatedBy,
    } = params;

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
    const promoCodesUrl = `${frontend}/dashboard/promo-codes`;

    const programText = allowedPrograms
      ? `for ${allowedPrograms}`
      : "for all programs";

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Promo Code Deactivated - @Cloud Ministry</title>
    <style>
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; }
      .container { max-width: 600px; margin: 0 auto; background: white; }
      .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 20px; text-align: center; }
      .header h1 { color: white; margin: 0; font-size: 28px; }
      .content { padding: 40px 30px; }
      .code-card { background: #fef2f2; border: 2px solid #ef4444; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
      .code { font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; color: #dc2626; letter-spacing: 2px; margin: 15px 0; text-decoration: line-through; }
      .details { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0; }
      .details h3 { margin: 0 0 15px 0; color: #92400e; font-size: 18px; }
      .details p { margin: 8px 0; color: #78350f; }
      .cta-button { display: inline-block; background: #ef4444; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
      .cta-button:hover { background: #dc2626; }
      .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
      .emoji { font-size: 48px; margin-bottom: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="emoji">⛔</div>
        <h1>Promo Code Deactivated</h1>
      </div>
      
      <div class="content">
        <p>Hi ${escapeHtml(recipientName)},</p>
        
        <p>Your promo code has been <strong>deactivated</strong> by ${escapeHtml(
          deactivatedBy
        )}. This code can no longer be used for enrollment.</p>
        
        <div class="code-card">
          <div style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Deactivated Code</div>
          <div class="code">${escapeHtml(promoCode)}</div>
          <div style="color: #dc2626; font-size: 14px; margin-top: 10px; font-weight: 600;">⚠️ This code is no longer active</div>
        </div>
        
        <div class="details">
          <h3>📋 Code Details</h3>
          <p><strong>Discount:</strong> ${discountPercent}% off</p>
          <p><strong>Valid for:</strong> ${
            allowedPrograms || "All programs"
          }</p>
          <p><strong>Status:</strong> <span style="color: #dc2626; font-weight: 600;">Deactivated</span></p>
        </div>
        
        <p style="margin-top: 30px;">If you have questions about this deactivation, please contact the administrator.</p>
        
        <div style="text-align: center;">
          <a href="${promoCodesUrl}" class="cta-button" style="display: inline-block; background: #ef4444; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0;">View My Promo Codes →</a>
        </div>
      </div>
      
      <div class="footer">
        <p>This is an automated message from @Cloud Ministry.</p>
        <p>If you have any questions, please contact atcloudministry@gmail.com</p>
        <p style="margin-top: 20px;">
          <a href="${promoCodesUrl}" style="color: #ef4444; text-decoration: none;">Manage My Promo Codes</a>
        </p>
      </div>
    </div>
  </body>
</html>
    `.trim();

    const text = `
Promo Code Deactivated

Hi ${recipientName},

Your promo code has been deactivated by ${deactivatedBy}. This code can no longer be used for enrollment.

Deactivated Code: ${promoCode}

Code Details:
- Discount: ${discountPercent}% off
- Valid for: ${allowedPrograms || "All programs"}
- Status: Deactivated

If you have questions about this deactivation, please contact the administrator.

View your promo codes: ${promoCodesUrl}

@Cloud Ministry Team
    `.trim();

    log.info(
      `Sending promo code deactivation email to ${recipientEmail} for code ${promoCode}`
    );

    return EmailService.sendEmail({
      to: recipientEmail,
      subject: `⛔ Your Promo Code ${promoCode} Has Been Deactivated`,
      html,
      text,
    });
  }

  /**
   * Send promo code reactivation notification to user
   */
  static async sendPromoCodeReactivatedEmail(params: {
    recipientEmail: string;
    recipientName: string;
    promoCode: string;
    discountPercent: number;
    allowedPrograms?: string;
    expiresAt?: string;
    reactivatedBy: string;
  }): Promise<boolean> {
    const {
      recipientEmail,
      recipientName,
      promoCode,
      discountPercent,
      allowedPrograms,
      expiresAt,
      reactivatedBy,
    } = params;

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
    const promoCodesUrl = `${frontend}/dashboard/promo-codes`;

    const expiryText = expiresAt
      ? `This code expires on ${new Date(expiresAt).toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        )}.`
      : "This code never expires.";

    const programText = allowedPrograms
      ? `for ${allowedPrograms}`
      : "for all programs";

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Promo Code Reactivated - @Cloud Ministry</title>
    <style>
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; }
      .container { max-width: 600px; margin: 0 auto; background: white; }
      .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; }
      .header h1 { color: white; margin: 0; font-size: 28px; }
      .content { padding: 40px 30px; }
      .code-card { background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
      .code { font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 2px; margin: 15px 0; }
      .details { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0; }
      .details h3 { margin: 0 0 15px 0; color: #92400e; font-size: 18px; }
      .details p { margin: 8px 0; color: #78350f; }
      .cta-button { display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
      .cta-button:hover { background: #059669; }
      .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
      .emoji { font-size: 48px; margin-bottom: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="emoji">✅</div>
        <h1>Promo Code Reactivated!</h1>
      </div>
      
      <div class="content">
        <p>Hi ${escapeHtml(recipientName)},</p>
        
        <p>Good news! Your promo code has been <strong>reactivated</strong> by ${escapeHtml(
          reactivatedBy
        )}. You can now use this code for enrollment.</p>
        
        <div class="code-card">
          <div style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Your Active Promo Code</div>
          <div class="code">${escapeHtml(promoCode)}</div>
          <div style="color: #059669; font-size: 14px; margin-top: 10px; font-weight: 600;">✓ Ready to use</div>
        </div>
        
        <div class="details">
          <h3>📋 Code Details</h3>
          <p><strong>Discount:</strong> ${discountPercent}% off</p>
          <p><strong>Valid for:</strong> ${
            allowedPrograms || "All programs"
          }</p>
          <p><strong>Status:</strong> ${expiryText}</p>
        </div>
        
        <p style="margin-top: 30px;">Ready to use your code? View it anytime in your promo codes dashboard:</p>
        
        <div style="text-align: center;">
          <a href="${promoCodesUrl}" class="cta-button" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0;">View My Promo Codes →</a>
        </div>
        
        <p style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <strong>How to use:</strong> When enrolling in a program, enter this code at checkout to receive your discount.
        </p>
      </div>
      
      <div class="footer">
        <p>This is an automated message from @Cloud Ministry.</p>
        <p>If you have any questions, please contact atcloudministry@gmail.com</p>
        <p style="margin-top: 20px;">
          <a href="${promoCodesUrl}" style="color: #10b981; text-decoration: none;">Manage My Promo Codes</a>
        </p>
      </div>
    </div>
  </body>
</html>
    `.trim();

    const text = `
Promo Code Reactivated!

Hi ${recipientName},

Good news! Your promo code has been reactivated by ${reactivatedBy}. You can now use this code for enrollment.

Your Promo Code: ${promoCode}

Code Details:
- Discount: ${discountPercent}% off
- Valid for: ${allowedPrograms || "All programs"}
- Status: ${expiryText}

View your promo codes: ${promoCodesUrl}

How to use: When enrolling in a program, enter this code at checkout to receive your discount.

@Cloud Ministry Team
    `.trim();

    log.info(
      `Sending promo code reactivation email to ${recipientEmail} for code ${promoCode}`
    );

    return EmailService.sendEmail({
      to: recipientEmail,
      subject: `✅ Your Promo Code ${promoCode} Has Been Reactivated!`,
      html,
      text,
    });
  }
}
