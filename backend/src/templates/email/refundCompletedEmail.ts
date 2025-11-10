/**
 * Refund Completed Email Template
 *
 * Generates HTML email to notify user that their refund has been successfully processed
 */

export interface RefundCompletedEmailData {
  userName: string;
  orderNumber: string;
  programTitle: string;
  refundAmount: number; // in cents
  refundDate: Date;
}

export function generateRefundCompletedEmail(
  data: RefundCompletedEmailData
): string {
  const { userName, orderNumber, programTitle, refundAmount, refundDate } =
    data;

  // Format amount (cents to dollars)
  const formattedAmount = (refundAmount / 100).toFixed(2);

  // Format date
  const formattedDate = new Date(refundDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
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
                  <span class="info-value"><strong>$${formattedAmount}</strong></span>
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
}
