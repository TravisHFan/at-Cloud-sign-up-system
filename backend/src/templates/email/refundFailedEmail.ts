/**
 * Refund Failed Email Template
 *
 * Generates HTML email to notify user that their refund request failed
 */

export interface RefundFailedEmailData {
  userName: string;
  orderNumber: string;
  programTitle: string;
  failureReason: string;
}

export function generateRefundFailedEmail(data: RefundFailedEmailData): string {
  const { userName, orderNumber, programTitle, failureReason } = data;

  return `
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
}
