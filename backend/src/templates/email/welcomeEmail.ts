/**
 * Welcome Email Template
 *
 * Generates HTML email to welcome newly verified users
 */

export interface WelcomeEmailData {
  name: string;
  dashboardUrl: string;
}

export function generateWelcomeEmail(data: WelcomeEmailData): string {
  const { name, dashboardUrl } = data;

  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to @Cloud Ministry</title>
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
              <p>Your email has been verified and your account is now active! Welcome to the @Cloud Ministry community.</p>
              <p>Here's what you can do now:</p>
              <ul>
                <li>Browse and sign up for upcoming events</li>
                <li>Connect with other community members</li>
                <li>Update your profile with your interests</li>
                <li>Participate in our ministry activities</li>
              </ul>
              <div style="text-align: center;">
                <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
              </div>
              <p>We're excited to have you as part of our family and look forward to growing together in faith!</p>
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
