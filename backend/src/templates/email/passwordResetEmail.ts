/**
 * Password Reset Email Template
 *
 * Generates HTML email for password reset requests
 */

export interface PasswordResetEmailData {
  name: string;
  resetUrl: string;
}

export function generatePasswordResetEmail(
  data: PasswordResetEmailData
): string {
  const { name, resetUrl } = data;

  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #f5576c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>We received a request to reset your password for your @Cloud Ministry account.</p>
              <p>If you requested this password reset, please click the button below to create a new password:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset My Password</a>
              </div>
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p><a href="${resetUrl}">${resetUrl}</a></p>
              <p><strong>Important:</strong> This reset link will expire in 10 minutes for security purposes.</p>
              <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
              <p>Blessings,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
              <p>If you have any questions, please contact us at atcloudministry@gmail.com</p>
            </div>
          </div>
        </body>
      </html>
    `;
}
