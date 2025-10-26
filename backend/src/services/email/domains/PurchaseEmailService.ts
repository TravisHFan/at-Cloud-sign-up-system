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
                <a href="${receiptUrl}" class="button">View Receipt</a>
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
}
