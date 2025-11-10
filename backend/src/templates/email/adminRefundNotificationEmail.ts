/**
 * Admin Refund Notification Email Template
 *
 * Generates HTML email to notify admins about refund requests
 */

export interface AdminRefundNotificationEmailData {
  userName: string;
  userEmail: string;
  orderNumber: string;
  programTitle: string;
  refundAmount: number; // in cents
  purchaseDate: Date;
  refundInitiatedAt: Date;
}

export function generateAdminRefundNotificationEmail(
  data: AdminRefundNotificationEmailData
): string {
  const {
    userName,
    userEmail,
    orderNumber,
    programTitle,
    refundAmount,
    purchaseDate,
    refundInitiatedAt,
  } = data;

  // Format amount (cents to dollars)
  const formattedAmount = (refundAmount / 100).toFixed(2);

  // Format dates
  const formattedPurchaseDate = new Date(purchaseDate).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  const formattedRefundDate = new Date(refundInitiatedAt).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  return `
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
                  <span class="info-value">${formattedPurchaseDate}</span>
                </div>
              </div>

              <div class="section-title">Refund Information:</div>
              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Refund Amount:</span>
                  <span class="info-value"><strong>$${formattedAmount}</strong></span>
                </div>
                <div class="info-row">
                  <span class="info-label">Refund Initiated:</span>
                  <span class="info-value">${formattedRefundDate}</span>
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
}
