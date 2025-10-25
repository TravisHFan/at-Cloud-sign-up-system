/**
 * Password Reset Success Email Template
 *
 * Generates HTML email to confirm successful password reset
 */

export interface PasswordResetSuccessEmailData {
  name: string;
  resetDateTime: string;
}

export function generatePasswordResetSuccessEmail(
  data: PasswordResetSuccessEmailData
): string {
  const { name, resetDateTime } = data;

  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed Successfully - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .security-tip { background: #e3f2fd; border: 1px solid #bbdefb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Changed Successfully</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              
              <div class="success">
                <strong>✅ Success!</strong> Your password has been changed successfully.
              </div>
              
              <p>Your @Cloud Ministry account password was updated on ${resetDateTime}.</p>
              
              <div class="security-tip">
                <strong>Security Reminder:</strong> If you didn't make this change, please contact our support team immediately and consider securing your account.
              </div>
              
              <p>You can now use your new password to log in to your account.</p>
              
              <div class="footer">
                <p>This is an automated security notification from @Cloud Ministry.<br>
                If you need help, please contact our support team.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
}
