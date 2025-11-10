/**
 * Refund Initiated Email Template
 *
 * Generates HTML email to notify user that their refund has been initiated
 */

export interface RefundInitiatedEmailData {
  userName: string;
  orderNumber: string;
  programTitle: string;
  refundAmount: number; // in cents
  purchaseDate: Date;
}

export function generateRefundInitiatedEmail(
  data: RefundInitiatedEmailData
): string {
  const { userName, orderNumber, programTitle, refundAmount, purchaseDate } =
    data;

  // Format amount (cents to dollars)
  const formattedAmount = (refundAmount / 100).toFixed(2);

  // Format date
  const formattedDate = new Date(purchaseDate).toLocaleDateString("en-US", {
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
                  <span class="info-value">$${formattedAmount}</span>
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
}
