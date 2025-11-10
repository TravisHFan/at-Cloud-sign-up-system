/**
 * PurchaseEmailService.ts
 * Domain service for purchase-related email notifications
 *
 * Handles confirmation emails for program enrollments with purchase details,
 * receipts, discounts (Class Rep, Early Bird), and payment summaries.
 */

import Stripe from "stripe";
import nodemailer from "nodemailer";
import { EmailService } from "../../infrastructure/EmailServiceFacade";
import { EmailOptions } from "../../email";
import { createLogger } from "../../LoggerService";
import { EmailRecipientUtils } from "../../../utils/emailRecipientUtils";

const log = createLogger("PurchaseEmailService");

export class PurchaseEmailService {
  /**
   * Send purchase confirmation email after successful program enrollment
   */
  static async sendPurchaseConfirmationEmail(params: {
    email: string;
    name: string;
    orderNumber: string;
    programTitle: string;
    programType: string;
    purchaseDate: Date;
    fullPrice: number;
    finalPrice: number;
    classRepDiscount?: number;
    earlyBirdDiscount?: number;
    isClassRep: boolean;
    isEarlyBird: boolean;
    receiptUrl: string;
  }): Promise<boolean> {
    const {
      email,
      name,
      orderNumber,
      programTitle,
      programType,
      purchaseDate,
      fullPrice,
      finalPrice,
      classRepDiscount = 0,
      earlyBirdDiscount = 0,
      isClassRep,
      isEarlyBird,
      receiptUrl,
    } = params;

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const formattedDate = new Date(purchaseDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formatCurrency = (amount: number) => `$${(amount / 100).toFixed(2)}`;

    const totalSavings = classRepDiscount + earlyBirdDiscount;
    const hasDiscounts = totalSavings > 0;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Purchase Confirmation - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #9333ea 0%, #7e22ce 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .success-icon { font-size: 48px; margin-bottom: 10px; }
            .order-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9333ea; }
            .order-detail { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .order-detail:last-child { border-bottom: none; }
            .label { color: #666; font-weight: 600; }
            .value { color: #333; font-weight: normal; }
            .program-info { background: #f3e8ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .pricing-table { width: 100%; margin: 20px 0; }
            .pricing-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .pricing-total { border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; font-weight: bold; font-size: 18px; }
            .discount { color: #059669; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-left: 8px; }
            .badge-blue { background: #dbeafe; color: #1e40af; }
            .badge-amber { background: #fef3c7; color: #92400e; }
            .button { display: inline-block; padding: 12px 30px; background: #9333ea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .button:hover { background: #7e22ce; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; padding: 20px; }
            .support-box { background: #fff7ed; border: 1px solid #fed7aa; padding: 15px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-icon">✓</div>
              <h1 style="margin: 0;">Thank You for Your Enrollment!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your payment was successful</p>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>Congratulations! You have successfully enrolled in our program. We're excited to have you join us on this journey of growth and learning.</p>
              
              <div class="program-info">
                <h3 style="margin-top: 0; color: #7e22ce;">${programTitle}</h3>
                <p style="margin: 5px 0; color: #666;">${programType}</p>
              </div>

              <div class="order-box">
                <div class="order-detail">
                  <span class="label">Order Number:</span>
                  <span class="value">${orderNumber}</span>
                </div>
                <div class="order-detail">
                  <span class="label">Purchase Date:</span>
                  <span class="value">${formattedDate}</span>
                </div>
                <div class="order-detail">
                  <span class="label">Amount Paid:</span>
                  <span class="value">${formatCurrency(finalPrice)}</span>
                </div>
              </div>

              ${
                hasDiscounts
                  ? `
              <div class="pricing-table">
                <h3>Payment Summary</h3>
                <div class="pricing-row">
                  <span>Program Enrollment</span>
                  <span>${formatCurrency(fullPrice)}</span>
                </div>
                ${
                  isClassRep && classRepDiscount > 0
                    ? `
                <div class="pricing-row discount">
                  <span>Class Representative Discount <span class="badge badge-blue">Class Rep</span></span>
                  <span>-${formatCurrency(classRepDiscount)}</span>
                </div>
                `
                    : ""
                }
                ${
                  isEarlyBird && earlyBirdDiscount > 0
                    ? `
                <div class="pricing-row discount">
                  <span>Early Bird Discount <span class="badge badge-amber">Early Bird</span></span>
                  <span>-${formatCurrency(earlyBirdDiscount)}</span>
                </div>
                `
                    : ""
                }
                <div class="pricing-row pricing-total">
                  <span>Total Paid</span>
                  <span>${formatCurrency(finalPrice)}</span>
                </div>
                <div class="pricing-row" style="color: #059669; font-weight: 600; font-size: 14px;">
                  <span>You Saved</span>
                  <span>${formatCurrency(totalSavings)}</span>
                </div>
              </div>
              `
                  : ""
              }

              <div style="text-align: center;">
                <a href="${receiptUrl}" class="button" style="display: inline-block; padding: 12px 30px; background: #9333ea; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0;">View Receipt</a>
              </div>

              <div class="support-box">
                <h4 style="margin-top: 0; color: #92400e;">What's Next?</h4>
                <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
                  <li>Access all events within this program from your dashboard</li>
                  <li>Connect with mentors and fellow participants</li>
                  <li>Check your email for program updates and reminders</li>
                  <li>Download your receipt for your records</li>
                </ul>
              </div>

              <p><strong>Questions?</strong> If you have any questions about your enrollment or the program, please don't hesitate to reach out to our support team.</p>
              
              <p>Blessings on your journey,<br><strong>The @Cloud Ministry Team</strong></p>
            </div>
            <div class="footer">
              <p><strong>@Cloud Ministry</strong> | Building Community Through Faith</p>
              <p>Support: <a href="mailto:atcloudministry@gmail.com" style="color: #9333ea;">atcloudministry@gmail.com</a></p>
              <p style="font-size: 12px; color: #999; margin-top: 15px;">
                This is a confirmation email for order ${orderNumber}. Please save this email for your records.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Thank You for Your Enrollment!

Hello ${name},

You have successfully enrolled in:
${programTitle} (${programType})

Order Details:
- Order Number: ${orderNumber}
- Purchase Date: ${formattedDate}
- Amount Paid: ${formatCurrency(finalPrice)}
${
  hasDiscounts
    ? `\nPayment Breakdown:\n- Program Enrollment: ${formatCurrency(fullPrice)}`
    : ""
}
${
  isClassRep && classRepDiscount > 0
    ? `- Class Representative Discount: -${formatCurrency(classRepDiscount)}`
    : ""
}
${
  isEarlyBird && earlyBirdDiscount > 0
    ? `- Early Bird Discount: -${formatCurrency(earlyBirdDiscount)}`
    : ""
}
${
  hasDiscounts
    ? `- Total Paid: ${formatCurrency(
        finalPrice
      )}\n- You Saved: ${formatCurrency(totalSavings)}`
    : ""
}

View your receipt online: ${receiptUrl}

What's Next?
- Access all events within this program from your dashboard
- Connect with mentors and fellow participants
- Check your email for program updates and reminders
- Download your receipt for your records

If you have any questions, please contact us at atcloudministry@gmail.com

Blessings,
The @Cloud Ministry Team
    `.trim();

    log.info(
      `Sending purchase confirmation email to ${email} for order ${orderNumber}`
    );

    return EmailService.sendEmail({
      to: email,
      subject: `Enrollment Confirmed: ${programTitle} - Order ${orderNumber}`,
      html,
      text,
    });
  }

  /**
   * Send refund initiated email to user
   */
  static async sendRefundInitiatedEmail(params: {
    userEmail: string;
    userName: string;
    orderNumber: string;
    programTitle: string;
    refundAmount: number;
    purchaseDate: Date;
  }): Promise<boolean> {
    const {
      userEmail,
      userName,
      orderNumber,
      programTitle,
      refundAmount,
      purchaseDate,
    } = params;

    const formatCurrency = (amount: number) => `$${(amount / 100).toFixed(2)}`;
    const formattedDate = new Date(purchaseDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Refund Request Received</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: bold; color: #666; }
            .info-value { color: #333; }
            .notice { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Refund Request Received</h1>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>We have received your refund request and have initiated the process. Here are the details:</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Order Number:</span>
                  <span class="info-value">${orderNumber}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Program:</span>
                  <span class="info-value">${programTitle}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Purchase Date:</span>
                  <span class="info-value">${formattedDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Refund Amount:</span>
                  <span class="info-value">${formatCurrency(
                    refundAmount
                  )}</span>
                </div>
              </div>

              <div class="notice">
                <strong>What happens next?</strong>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>Your refund is being processed by our payment provider</li>
                  <li>You will receive a confirmation email once the refund is completed</li>
                  <li>The refund will appear in your original payment method within 5-10 business days</li>
                </ul>
              </div>

              <p>If you have any questions about your refund, please contact our support team.</p>
              
              <p>Best regards,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
              <p>Questions? Contact us at atcloudministry@gmail.com</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Refund Request Received

Hello ${userName},

We have received your refund request and have initiated the process.

Order Details:
- Order Number: ${orderNumber}
- Program: ${programTitle}
- Purchase Date: ${formattedDate}
- Refund Amount: ${formatCurrency(refundAmount)}

What happens next?
- Your refund is being processed by our payment provider
- You will receive a confirmation email once the refund is completed
- The refund will appear in your original payment method within 5-10 business days

If you have any questions, please contact atcloudministry@gmail.com

Best regards,
The @Cloud Ministry Team
    `.trim();

    log.info(
      `Sending refund initiated email to ${userEmail} for order ${orderNumber}`
    );

    return EmailService.sendEmail({
      to: userEmail,
      subject: `Refund Request Received - Order ${orderNumber}`,
      html,
      text,
    });
  }

  /**
   * Send refund completed email to user
   */
  static async sendRefundCompletedEmail(params: {
    userEmail: string;
    userName: string;
    orderNumber: string;
    programTitle: string;
    refundAmount: number;
    refundDate: Date;
  }): Promise<boolean> {
    const {
      userEmail,
      userName,
      orderNumber,
      programTitle,
      refundAmount,
      refundDate,
    } = params;

    const formatCurrency = (amount: number) => `$${(amount / 100).toFixed(2)}`;
    const formattedDate = new Date(refundDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Refund Completed</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .success-icon { font-size: 60px; text-align: center; margin: 20px 0; }
            .info-box { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: bold; color: #666; }
            .info-value { color: #333; }
            .notice { background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Refund Completed</h1>
            </div>
            <div class="content">
              <div class="success-icon">✅</div>
              <h2>Hello ${userName},</h2>
              <p>Good news! Your refund has been successfully processed.</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Order Number:</span>
                  <span class="info-value">${orderNumber}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Program:</span>
                  <span class="info-value">${programTitle}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Refund Date:</span>
                  <span class="info-value">${formattedDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Refund Amount:</span>
                  <span class="info-value"><strong>${formatCurrency(
                    refundAmount
                  )}</strong></span>
                </div>
              </div>

              <div class="notice">
                <strong>When will I see the refund?</strong>
                <p style="margin: 10px 0 0 0;">The refund will appear in your original payment method within <strong>5-10 business days</strong>, depending on your bank or card issuer.</p>
              </div>

              <p>Thank you for being a part of @Cloud Ministry. We hope to serve you again in the future!</p>
              
              <p>Blessings,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
              <p>Questions? Contact us at atcloudministry@gmail.com</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Refund Completed ✓

Hello ${userName},

Good news! Your refund has been successfully processed.

Refund Details:
- Order Number: ${orderNumber}
- Program: ${programTitle}
- Refund Date: ${formattedDate}
- Refund Amount: ${formatCurrency(refundAmount)}

When will I see the refund?
The refund will appear in your original payment method within 5-10 business days, depending on your bank or card issuer.

Thank you for being a part of @Cloud Ministry. We hope to serve you again in the future!

Blessings,
The @Cloud Ministry Team
    `.trim();

    log.info(
      `Sending refund completed email to ${userEmail} for order ${orderNumber}`
    );

    return EmailService.sendEmail({
      to: userEmail,
      subject: `Refund Completed - Order ${orderNumber}`,
      html,
      text,
    });
  }

  /**
   * Send refund failed email to user
   */
  static async sendRefundFailedEmail(params: {
    userEmail: string;
    userName: string;
    orderNumber: string;
    programTitle: string;
    failureReason: string;
  }): Promise<boolean> {
    const { userEmail, userName, orderNumber, programTitle, failureReason } =
      params;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Refund Request Failed</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .error-icon { font-size: 60px; text-align: center; margin: 20px 0; }
            .info-box { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: bold; color: #666; }
            .info-value { color: #333; }
            .error-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Refund Request Failed</h1>
            </div>
            <div class="content">
              <div class="error-icon">❌</div>
              <h2>Hello ${userName},</h2>
              <p>We're sorry, but we encountered an issue while processing your refund request.</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Order Number:</span>
                  <span class="info-value">${orderNumber}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Program:</span>
                  <span class="info-value">${programTitle}</span>
                </div>
              </div>

              <div class="error-box">
                <strong>Reason:</strong>
                <p style="margin: 10px 0 0 0;">${failureReason}</p>
              </div>

              <p><strong>What should I do next?</strong></p>
              <ul>
                <li>You can try requesting a refund again from your Purchase History</li>
                <li>If the issue persists, please contact our support team with your order number</li>
                <li>Our team will assist you in resolving this issue as quickly as possible</li>
              </ul>

              <div style="text-align: center;">
                <a href="mailto:atcloudministry@gmail.com" class="button">Contact Support</a>
              </div>

              <p>We apologize for any inconvenience and appreciate your patience.</p>
              
              <p>Best regards,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
              <p>Questions? Contact us at atcloudministry@gmail.com</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Refund Request Failed

Hello ${userName},

We're sorry, but we encountered an issue while processing your refund request.

Order Details:
- Order Number: ${orderNumber}
- Program: ${programTitle}

Failure Reason:
${failureReason}

What should I do next?
- You can try requesting a refund again from your Purchase History
- If the issue persists, please contact our support team with your order number
- Our team will assist you in resolving this issue as quickly as possible

Contact support at: atcloudministry@gmail.com

We apologize for any inconvenience and appreciate your patience.

Best regards,
The @Cloud Ministry Team
    `.trim();

    log.info(
      `Sending refund failed email to ${userEmail} for order ${orderNumber}`
    );

    return EmailService.sendEmail({
      to: userEmail,
      subject: `Refund Request Failed - Order ${orderNumber}`,
      html,
      text,
    });
  }

  /**
   * Send admin notification email for refund requests
   */
  static async sendAdminRefundNotification(params: {
    userName: string;
    userEmail: string;
    orderNumber: string;
    programTitle: string;
    refundAmount: number;
    purchaseDate: Date;
    refundInitiatedAt: Date;
  }): Promise<boolean> {
    const {
      userName,
      userEmail,
      orderNumber,
      programTitle,
      refundAmount,
      purchaseDate,
      refundInitiatedAt,
    } = params;

    const formatCurrency = (amount: number) => `$${(amount / 100).toFixed(2)}`;
    const formatDate = (date: Date) =>
      new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Refund Request - Admin Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: bold; color: #666; width: 40%; }
            .info-value { color: #333; width: 60%; text-align: right; }
            .section-title { color: #f59e0b; font-weight: bold; margin-top: 20px; margin-bottom: 10px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 Refund Request Notification</h1>
            </div>
            <div class="content">
              <p><strong>A refund has been initiated and is being processed.</strong></p>
              
              <div class="section-title">User Information:</div>
              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Name:</span>
                  <span class="info-value">${userName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Email:</span>
                  <span class="info-value">${userEmail}</span>
                </div>
              </div>

              <div class="section-title">Purchase Information:</div>
              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Order Number:</span>
                  <span class="info-value">${orderNumber}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Program:</span>
                  <span class="info-value">${programTitle}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Purchase Date:</span>
                  <span class="info-value">${formatDate(purchaseDate)}</span>
                </div>
              </div>

              <div class="section-title">Refund Information:</div>
              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Refund Amount:</span>
                  <span class="info-value"><strong>${formatCurrency(
                    refundAmount
                  )}</strong></span>
                </div>
                <div class="info-row">
                  <span class="info-label">Refund Initiated:</span>
                  <span class="info-value">${formatDate(
                    refundInitiatedAt
                  )}</span>
                </div>
              </div>

              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                <em>This is an automated notification. The refund has been processed with Stripe and will be completed automatically. The user will receive confirmation emails at each stage of the refund process.</em>
              </p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry Admin Notifications</p>
              <p>This email was sent to admins for record-keeping purposes</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Admin Notification: Refund Request

A refund has been initiated and is being processed.

User Information:
- Name: ${userName}
- Email: ${userEmail}

Purchase Information:
- Order Number: ${orderNumber}
- Program: ${programTitle}
- Purchase Date: ${formatDate(purchaseDate)}

Refund Information:
- Refund Amount: ${formatCurrency(refundAmount)}
- Refund Initiated: ${formatDate(refundInitiatedAt)}

This is an automated notification. The refund has been processed with Stripe and will be completed automatically. The user will receive confirmation emails at each stage of the refund process.
    `.trim();

    // Get all admin users
    const admins = await EmailRecipientUtils.getAdminUsers();

    if (admins.length === 0) {
      log.warn(
        `No admin users found to send refund notification for order ${orderNumber}`
      );
      return false;
    }

    log.info(
      `Sending admin refund notification for order ${orderNumber} to ${admins.length} admins`
    );

    // Send email to each admin
    const emailPromises = admins.map((admin) =>
      EmailService.sendEmail({
        to: admin.email,
        subject: `[Admin] Refund Request - Order ${orderNumber}`,
        html,
        text,
      })
    );

    try {
      await Promise.all(emailPromises);
      log.info(
        `Successfully sent refund notification to all ${admins.length} admins for order ${orderNumber}`
      );
      return true;
    } catch (error) {
      log.error(
        `Failed to send refund notification to some admins:`,
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }
}
