/**
 * Password Change Request Email Template
 *
 * Generates HTML email for password change confirmation requests
 */

export interface PasswordChangeRequestEmailData {
  name: string;
  confirmUrl: string;
}

export function generatePasswordChangeRequestEmail(
  data: PasswordChangeRequestEmailData
): string {
  const { name, confirmUrl } = data;

  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Change Request - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #4facfe; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Change Request</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>We received a request to change your password for your @Cloud Ministry account.</p>
              
              <div class="warning">
                <strong>Security Notice:</strong> If you didn't request this password change, please ignore this email. Your password will remain unchanged.
              </div>
              
              <p>To confirm and complete your password change, click the button below:</p>
              <p style="text-align: center;">
                <a href="${confirmUrl}" class="button">Confirm Password Change</a>
              </p>
              <p>Or copy and paste this link into your browser:<br>
                <a href="${confirmUrl}">${confirmUrl}</a>
              </p>
              
              <p><strong>This link will expire in 10 minutes for security.</strong></p>
              
              <div class="footer">
                <p>This is an automated message from @Cloud Ministry.<br>
                If you need help, please contact our support team.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
}
