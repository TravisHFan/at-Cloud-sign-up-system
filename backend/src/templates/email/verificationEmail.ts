/**
 * Email Verification Template
 *
 * Generates HTML email for email verification during user registration
 */

export interface VerificationEmailData {
  name: string;
  verificationUrl: string;
}

export function generateVerificationEmail(data: VerificationEmailData): string {
  const { name, verificationUrl } = data;

  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to @Cloud Ministry!</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>Thank you for joining @Cloud Ministry! We're excited to have you as part of our community.</p>
              <p>To complete your registration and start participating in our events, please verify your email address by clicking the button below:</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify My Email</a>
              </div>
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p><a href="${verificationUrl}">${verificationUrl}</a></p>
              <p>This verification link will expire in 24 hours for security purposes.</p>
              <p>If you didn't create an account with @Cloud Ministry, please ignore this email.</p>
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
