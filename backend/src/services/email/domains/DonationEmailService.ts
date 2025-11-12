/**
 * DonationEmailService
 *
 * Handles all donation-related emails:
 * - Donation receipts (one-time and recurring)
 * - Transaction confirmations
 * - Thank you messages
 *
 * Sends automatic emails after each successful donation transaction.
 */
export class DonationEmailService {
  /**
   * Send donation receipt email after successful transaction
   */
  static async sendDonationReceipt(params: {
    email: string;
    name: string;
    amount: number; // in cents
    type: "one-time" | "recurring";
    frequency?: "weekly" | "biweekly" | "monthly" | "quarterly" | "annually";
    transactionDate: Date;
    paymentMethod?: {
      cardBrand?: string;
      last4?: string;
    };
    isFirstPayment?: boolean; // For recurring donations
  }): Promise<boolean> {
    const {
      email,
      name,
      amount,
      type,
      frequency,
      transactionDate,
      paymentMethod,
      isFirstPayment = false,
    } = params;

    // Format amount
    const amountInDollars = (amount / 100).toFixed(2);
    const formattedDate = new Date(transactionDate).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );

    // Build payment method display
    let paymentMethodDisplay = "Card";
    if (paymentMethod?.cardBrand && paymentMethod?.last4) {
      const brandFormatted =
        paymentMethod.cardBrand.charAt(0).toUpperCase() +
        paymentMethod.cardBrand.slice(1);
      paymentMethodDisplay = `${brandFormatted} •••• ${paymentMethod.last4}`;
    }

    // Build frequency display for recurring donations
    const frequencyDisplay = frequency
      ? {
          weekly: "Weekly",
          biweekly: "Bi-weekly",
          monthly: "Monthly",
          quarterly: "Quarterly",
          annually: "Annually",
        }[frequency]
      : "";

    // Determine subject and message based on donation type
    let subject: string;
    let messageTitle: string;
    let messageDescription: string;

    if (type === "recurring") {
      if (isFirstPayment) {
        subject = "Thank You for Your Recurring Donation!";
        messageTitle = "Recurring Donation Started";
        messageDescription = `Thank you for setting up a ${frequencyDisplay.toLowerCase()} recurring donation! Your first gift has been processed successfully.`;
      } else {
        subject = "Recurring Donation Processed";
        messageTitle = "Recurring Donation Payment";
        messageDescription = `Your ${frequencyDisplay.toLowerCase()} recurring donation has been processed successfully. Thank you for your continued support!`;
      }
    } else {
      subject = "Thank You for Your Donation!";
      messageTitle = "Donation Received";
      messageDescription =
        "Thank you for your generous one-time donation to our ministry. Your support makes a real difference!";
    }

    // Build HTML email
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Donation Receipt</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .success-icon {
              font-size: 48px;
              margin-bottom: 10px;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content {
              padding: 40px 30px;
            }
            .message {
              font-size: 16px;
              color: #666;
              margin-bottom: 30px;
              text-align: center;
            }
            .receipt-box {
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 24px;
              margin: 30px 0;
            }
            .receipt-row {
              display: flex;
              justify-content: space-between;
              padding: 12px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .receipt-row:last-child {
              border-bottom: none;
            }
            .label {
              color: #6b7280;
              font-size: 14px;
            }
            .value {
              color: #111827;
              font-weight: 500;
              font-size: 14px;
            }
            .amount-row {
              background-color: #fff;
              margin: -8px -12px -8px -12px;
              padding: 16px 12px;
              border-radius: 6px;
            }
            .amount-row .value {
              color: #22c55e;
              font-size: 24px;
              font-weight: 700;
            }
            .footer {
              background-color: #f9fafb;
              padding: 30px;
              text-align: center;
              font-size: 14px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              margin: 8px 0;
            }
            .tax-notice {
              background-color: #eff6ff;
              border-left: 4px solid #3b82f6;
              padding: 16px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .tax-notice p {
              margin: 0;
              font-size: 14px;
              color: #1e40af;
            }
            .button {
              display: inline-block;
              background-color: #22c55e;
              color: white;
              padding: 14px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              margin: 20px 0;
              transition: background-color 0.2s;
            }
            .button:hover {
              background-color: #16a34a;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            @media only screen and (max-width: 600px) {
              .container {
                margin: 0;
                border-radius: 0;
              }
              .content {
                padding: 30px 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-icon">✓</div>
              <h1>${messageTitle}</h1>
            </div>
            
            <div class="content">
              <p class="message">${messageDescription}</p>
              
              <div class="receipt-box">
                <div class="receipt-row">
                  <span class="label">Donation Type:</span>
                  <span class="value">${
                    type === "recurring"
                      ? `Recurring (${frequencyDisplay})`
                      : "One-time"
                  }</span>
                </div>
                <div class="receipt-row">
                  <span class="label">Transaction Date:</span>
                  <span class="value">${formattedDate}</span>
                </div>
                <div class="receipt-row">
                  <span class="label">Payment Method:</span>
                  <span class="value">${paymentMethodDisplay}</span>
                </div>
                <div class="receipt-row amount-row">
                  <span class="label">Amount:</span>
                  <span class="value">$${amountInDollars}</span>
                </div>
              </div>

              <div class="tax-notice">
                <p><strong>Tax Deductible:</strong> This donation is tax-deductible to the extent allowed by law. Please keep this receipt for your tax records.</p>
                <p style="margin-top: 12px;">For a detailed donation history for any year, please log in to the ERP system and download it.</p>
              </div>

              <div class="button-container">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/dashboard/donate" class="button">
                  View Donation History
                </a>
              </div>

              <p style="text-align: center; margin-top: 30px; color: #6b7280;">
                Thank you for your generosity and support of our ministry!
              </p>
            </div>
            
            <div class="footer">
              <p><strong>Questions?</strong></p>
              <p>Contact us if you have any questions about your donation.</p>
              <p style="margin-top: 20px; font-size: 12px;">
                This is an automated receipt. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Plain text version
    const text = `
${messageTitle}

${messageDescription}

DONATION RECEIPT
===============
Donation Type: ${
      type === "recurring" ? `Recurring (${frequencyDisplay})` : "One-time"
    }
Transaction Date: ${formattedDate}
Payment Method: ${paymentMethodDisplay}
Amount: $${amountInDollars}

TAX DEDUCTIBLE: This donation is tax-deductible to the extent allowed by law. Please keep this receipt for your tax records.

For a detailed donation history for any year, please log in to the ERP system and download it.

Thank you for your generosity and support of our ministry!

Questions? Contact us if you have any questions about your donation.

This is an automated receipt. Please do not reply to this email.
    `;

    // Import EmailServiceFacade dynamically to avoid circular dependency
    const { EmailService } = await import(
      "../../infrastructure/EmailServiceFacade"
    );

    return EmailService.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }
}
