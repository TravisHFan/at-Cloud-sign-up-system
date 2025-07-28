import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailTemplateData {
  name?: string;
  email?: string;
  verificationUrl?: string;
  resetUrl?: string;
  eventTitle?: string;
  eventDate?: string;
  [key: string]: any;
}

export class EmailService {
  private static transporter: nodemailer.Transporter;

  private static getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      // Check if real SMTP credentials are configured
      const hasRealCredentials =
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        !process.env.SMTP_USER.includes("your-email") &&
        !process.env.SMTP_PASS.includes("your-app-password");

      if (process.env.NODE_ENV === "production" && hasRealCredentials) {
        // Production email configuration
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      } else if (hasRealCredentials) {
        // Development with real credentials
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: false, // Use TLS
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      } else {
        // Development: Use console logging instead of real email
        console.log(
          "🔧 Development mode: Email service will use console logging"
        );
        this.transporter = nodemailer.createTransport({
          jsonTransport: true, // This will just return JSON instead of sending
        });
      }
    }
    return this.transporter;
  }

  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Skip email sending in test environment
      if (process.env.NODE_ENV === "test") {
        console.log(
          `📧 Email skipped in test environment: ${options.subject} to ${options.to}`
        );
        return true;
      }

      const transporter = this.getTransporter();

      const mailOptions = {
        from:
          process.env.EMAIL_FROM || '"@Cloud Ministry" <noreply@atcloud.org>',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const info = await transporter.sendMail(mailOptions);

      // Check if we're using jsonTransport (development mode without real credentials)
      if (
        info.response &&
        typeof info.response === "string" &&
        info.response.includes('"jsonTransport":true')
      ) {
        console.log("📧 Development Email (not actually sent):");
        console.log(`   To: ${options.to}`);
        console.log(`   Subject: ${options.subject}`);
        console.log(`   Preview URL would be available in production`);
        return true;
      }

      if (process.env.NODE_ENV !== "production") {
        console.log("📧 Email sent successfully:");
        console.log(`   To: ${options.to}`);
        console.log(`   Subject: ${options.subject}`);
        if (info.messageId) {
          console.log(`   Message ID: ${info.messageId}`);
        }
      }

      return true;
    } catch (error) {
      console.error("❌ Email send failed:", error);
      return false;
    }
  }

  static async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<boolean> {
    const verificationUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/verify-email/${verificationToken}`;

    const html = `
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
              <p>If you have any questions, please contact us at support@atcloud.org</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: "Welcome to @Cloud Ministry - Please Verify Your Email",
      html,
      text: `Welcome to @Cloud Ministry! Please verify your email by visiting: ${verificationUrl}`,
    });
  }

  static async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string
  ): Promise<boolean> {
    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/reset-password/${resetToken}`;

    const html = `
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
              <p>If you have any questions, please contact us at support@atcloud.org</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: "Password Reset Request - @Cloud Ministry",
      html,
      text: `Password reset requested. Please visit: ${resetUrl} (expires in 10 minutes)`,
    });
  }

  static async sendEventNotificationEmail(
    email: string,
    name: string,
    data: EmailTemplateData
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Event Notification - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #4facfe; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Event Update</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>We have an update regarding the event: <strong>${
                data.eventTitle
              }</strong></p>
              <p>Event Date: <strong>${data.eventDate}</strong></p>
              <p>${
                data.message || "Please check your dashboard for more details."
              }</p>
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/dashboard" class="button">View Dashboard</a>
              </div>
              <p>Thank you for your participation in @Cloud Ministry events!</p>
              <p>Blessings,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `Event Update: ${data.eventTitle}`,
      html,
    });
  }

  static async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const html = `
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
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/dashboard" class="button">Go to Dashboard</a>
              </div>
              <p>We're excited to have you as part of our family and look forward to growing together in faith!</p>
              <p>Blessings,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
              <p>If you have any questions, please contact us at support@atcloud.org</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: "Welcome to @Cloud Ministry - Account Verified!",
      html,
      text: `Welcome to @Cloud Ministry! Your account has been verified. Visit your dashboard: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/dashboard`,
    });
  }

  static async sendEventCreatedEmail(
    email: string,
    name: string,
    eventData: {
      title: string;
      date: string;
      time: string;
      endTime: string;
      location?: string;
      zoomLink?: string;
      organizer: string;
      purpose: string;
      format: string;
    }
  ): Promise<boolean> {
    const formatDateTime = (date: string, time: string) => {
      const eventDate = new Date(`${date}T${time}`);
      return eventDate.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    };

    const eventLocation =
      eventData.format === "Online"
        ? "Online Meeting"
        : eventData.location || "Location TBD";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Event Created - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .event-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4facfe; }
            .event-detail { margin: 10px 0; }
            .event-detail strong { color: #4facfe; }
            .button { display: inline-block; padding: 12px 30px; background: #4facfe; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 New Event Created!</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>A new event has been created and is now available for registration!</p>
              
              <div class="event-card">
                <h3>${eventData.title}</h3>
                <div class="event-detail">
                  <strong>📅 Date & Time:</strong> ${formatDateTime(
                    eventData.date,
                    eventData.time
                  )} - ${eventData.endTime}
                </div>
                <div class="event-detail">
                  <strong>📍 Location:</strong> ${eventLocation}
                </div>
                <div class="event-detail">
                  <strong>👤 Organizer:</strong> ${eventData.organizer}
                </div>
                <div class="event-detail">
                  <strong>🎯 Purpose:</strong> ${eventData.purpose}
                </div>
                <div class="event-detail">
                  <strong>💻 Format:</strong> ${eventData.format}
                </div>
                ${
                  eventData.zoomLink
                    ? `
                <div class="event-detail">
                  <strong>🔗 Join Link:</strong> <a href="${eventData.zoomLink}">Online Meeting</a>
                </div>
                `
                    : ""
                }
              </div>

              <p>Don't miss out! Sign up now to secure your spot.</p>
              
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/dashboard/upcoming" class="button">View & Register for Event</a>
              </div>
              
              <p>We look forward to seeing you there!</p>
              <p>Blessings,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
              <p>If you have any questions, please contact us at support@atcloud.org</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `🎉 New Event: ${eventData.title}`,
      html,
      text: `New event created: ${eventData.title} on ${formatDateTime(
        eventData.date,
        eventData.time
      )} at ${eventLocation}. Visit your dashboard to register: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/dashboard/upcoming`,
    });
  }

  /**
   * Send promotion notification to the promoted user
   */
  static async sendPromotionNotificationToUser(
    email: string,
    userData: {
      firstName: string;
      lastName: string;
      oldRole: string;
      newRole: string;
    },
    changedBy: {
      firstName: string;
      lastName: string;
      role: string;
    }
  ): Promise<boolean> {
    const userName = `${userData.firstName} ${userData.lastName}`.trim();
    const adminName = `${changedBy.firstName} ${changedBy.lastName}`.trim();

    // Get role-specific welcome message and permissions
    const getRoleWelcomeContent = (role: string) => {
      switch (role) {
        case "Super Admin":
          return {
            welcome: "Welcome to the highest level of system administration!",
            permissions:
              "You now have full system control, user management, and ministry oversight capabilities.",
            responsibilities:
              "Guide the ministry's digital presence and ensure smooth operations for all members.",
            icon: "👑",
          };
        case "Administrator":
          return {
            welcome: "Welcome to the administrative team!",
            permissions:
              "You can now manage users, oversee events, and handle system configurations.",
            responsibilities:
              "Help maintain the ministry's operations and support other members.",
            icon: "⚡",
          };
        case "Leader":
          return {
            welcome: "Welcome to ministry leadership!",
            permissions:
              "You can now create and manage events, lead ministry initiatives, and guide participants.",
            responsibilities:
              "Shepherd others in their faith journey and organize meaningful ministry activities.",
            icon: "🌟",
          };
        default:
          return {
            welcome: "Welcome to your new role!",
            permissions:
              "You have been granted new capabilities within the ministry.",
            responsibilities:
              "Continue to grow in faith and serve the community.",
            icon: "✨",
          };
      }
    };

    const roleContent = getRoleWelcomeContent(userData.newRole);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Congratulations on Your Promotion - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .promotion-card { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
            .role-change { background: linear-gradient(90deg, #e9ecef 0%, #f8f9fa 100%); padding: 20px; border-radius: 8px; margin: 15px 0; }
            .role-item { display: inline-block; padding: 8px 16px; margin: 5px; border-radius: 20px; font-weight: bold; }
            .old-role { background: #6c757d; color: white; }
            .new-role { background: #28a745; color: white; }
            .arrow { font-size: 20px; margin: 0 10px; color: #28a745; }
            .permissions-section { background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 15px 0; }
            .button { display: inline-block; padding: 12px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .icon { font-size: 48px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon">${roleContent.icon}</div>
              <h1>🎉 Congratulations on Your Promotion!</h1>
            </div>
            <div class="content">
              <h2>Dear ${userName},</h2>
              
              <div class="promotion-card">
                <p>We are excited to inform you that you have been promoted within @Cloud Ministry!</p>
                
                <div class="role-change">
                  <div style="text-align: center;">
                    <span class="role-item old-role">${userData.oldRole}</span>
                    <span class="arrow">→</span>
                    <span class="role-item new-role">${userData.newRole}</span>
                  </div>
                </div>

                <p><strong>${roleContent.welcome}</strong></p>
                
                <div class="permissions-section">
                  <h3>🔑 Your New Capabilities:</h3>
                  <p>${roleContent.permissions}</p>
                  
                  <h3>💼 Your Responsibilities:</h3>
                  <p>${roleContent.responsibilities}</p>
                </div>

                <p>This promotion was approved by <strong>${adminName}</strong> (${
      changedBy.role
    }).</p>
              </div>

              <p>We believe in your ability to excel in this new role and make a positive impact on our ministry community. Your dedication and service have not gone unnoticed.</p>

              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/dashboard" class="button">
                  Explore Your New Dashboard
                </a>
              </div>

              <p><em>"For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, to give you hope and a future." - Jeremiah 29:11</em></p>

              <p>Congratulations once again, and may God bless your new journey in ministry leadership!</p>
              
              <p>In His service,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
              <p>If you have any questions about your new role, please contact us at support@atcloud.org</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `🎉 Congratulations! You've been promoted to ${userData.newRole}`,
      html,
      text: `Congratulations ${userName}! You have been promoted from ${
        userData.oldRole
      } to ${userData.newRole} by ${adminName}. ${
        roleContent.welcome
      } Visit your dashboard to explore your new capabilities: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/dashboard`,
    });
  }

  /**
   * Send promotion notification to Super Admins and Administrators
   */
  static async sendPromotionNotificationToAdmins(
    adminEmail: string,
    adminName: string,
    userData: {
      firstName: string;
      lastName: string;
      email: string;
      oldRole: string;
      newRole: string;
    },
    changedBy: {
      firstName: string;
      lastName: string;
      role: string;
    }
  ): Promise<boolean> {
    const promotedUserName =
      `${userData.firstName} ${userData.lastName}`.trim();
    const administratorName =
      `${changedBy.firstName} ${changedBy.lastName}`.trim();

    // Get impact level for different promotions
    const getPromotionImpact = (newRole: string) => {
      switch (newRole) {
        case "Super Admin":
          return {
            impact: "High Impact",
            color: "#dc3545",
            description: "Full system administration access granted",
            actions:
              "Review system permissions and monitor administrative activities",
            icon: "🚨",
          };
        case "Administrator":
          return {
            impact: "Medium Impact",
            color: "#fd7e14",
            description:
              "User management and system configuration access granted",
            actions: "Monitor user management activities and system changes",
            icon: "⚠️",
          };
        case "Leader":
          return {
            impact: "Standard",
            color: "#28a745",
            description:
              "Event management and ministry leadership access granted",
            actions: "Support new leader in ministry responsibilities",
            icon: "📈",
          };
        default:
          return {
            impact: "Standard",
            color: "#6f42c1",
            description: "Role permissions updated",
            actions: "Monitor user activity",
            icon: "📝",
          };
      }
    };

    const promotionInfo = getPromotionImpact(userData.newRole);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>User Promotion Alert - @Cloud Ministry Admin</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #495057 0%, #6c757d 100%); color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .admin-alert { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${
              promotionInfo.color
            }; }
            .user-info { background: #e9ecef; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .role-change { text-align: center; margin: 20px 0; }
            .role-item { display: inline-block; padding: 8px 16px; margin: 5px; border-radius: 20px; font-weight: bold; }
            .old-role { background: #6c757d; color: white; }
            .new-role { background: ${promotionInfo.color}; color: white; }
            .arrow { font-size: 18px; margin: 0 10px; color: ${
              promotionInfo.color
            }; }
            .impact-badge { display: inline-block; padding: 6px 12px; border-radius: 15px; font-size: 12px; font-weight: bold; color: white; background: ${
              promotionInfo.color
            }; margin: 10px 0; }
            .action-section { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .button { display: inline-block; padding: 10px 25px; background: #495057; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .button.primary { background: ${promotionInfo.color}; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .timestamp { color: #6c757d; font-size: 14px; }
            .icon { font-size: 24px; margin-right: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${promotionInfo.icon} User Promotion Alert</h1>
              <p>Administrative Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName},</h2>
              
              <div class="admin-alert">
                <div class="impact-badge">${promotionInfo.impact}</div>
                
                <h3>User Role Promotion Completed</h3>
                
                <div class="user-info">
                  <strong>👤 Promoted User:</strong> ${promotedUserName}<br>
                  <strong>📧 Email:</strong> ${userData.email}<br>
                  <strong>🔄 Role Change:</strong>
                  <div class="role-change">
                    <span class="role-item old-role">${userData.oldRole}</span>
                    <span class="arrow">→</span>
                    <span class="role-item new-role">${userData.newRole}</span>
                  </div>
                  <strong>👤 Performed By:</strong> ${administratorName} (${
      changedBy.role
    })<br>
                  <strong>⏰ Date:</strong> <span class="timestamp">${new Date().toLocaleString()}</span>
                </div>

                <div class="action-section">
                  <h4>🎯 Impact & Next Steps:</h4>
                  <p><strong>Access Level:</strong> ${
                    promotionInfo.description
                  }</p>
                  <p><strong>Recommended Actions:</strong> ${
                    promotionInfo.actions
                  }</p>
                </div>

                <p>Please monitor the promoted user's activities and provide any necessary guidance for their new role responsibilities.</p>
              </div>

              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/users/${userData.email}" class="button primary">
                  View User Profile
                </a>
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/audit-log" class="button">
                  View Audit Log
                </a>
              </div>

              <p><strong>Note:</strong> This is an automated notification for administrative oversight. If you have any concerns about this promotion, please review the change with the promoting administrator.</p>
              
              <p>Best regards,<br>@Cloud Ministry System</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Administrative Notifications</p>
              <p>This email was sent to all Super Admins and Administrators</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: adminEmail,
      subject: `🚨 Admin Alert: User Promoted to ${userData.newRole} - ${promotedUserName}`,
      html,
      text: `Admin Alert: ${promotedUserName} (${
        userData.email
      }) has been promoted from ${userData.oldRole} to ${
        userData.newRole
      } by ${administratorName}. Impact: ${
        promotionInfo.impact
      }. Please review user management dashboard: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/admin/users`,
    });
  }

  /**
   * Send demotion notification to the demoted user
   * Pattern 3: Sensitive, respectful communication about role changes
   */
  static async sendDemotionNotificationToUser(
    userEmail: string,
    userData: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      oldRole: string;
      newRole: string;
    },
    changedBy: {
      firstName: string;
      lastName: string;
      email: string;
      role: string;
    },
    reason?: string
  ): Promise<boolean> {
    const userName = `${userData.firstName || ""} ${
      userData.lastName || ""
    }`.trim();
    const administratorName = `${changedBy.firstName || ""} ${
      changedBy.lastName || ""
    }`.trim();

    // Role-specific guidance and support messages
    const getRoleTransitionGuidance = (newRole: string) => {
      switch (newRole.toLowerCase()) {
        case "participant":
          return {
            message:
              "You remain a valued member of our ministry community with opportunities to grow and serve.",
            responsibilities:
              "Continue participating in events, fellowship activities, and spiritual growth opportunities.",
            encouragement:
              "This transition allows you to focus on personal spiritual development and find new ways to contribute.",
            icon: "🤝",
            color: "#6c757d",
          };
        case "leader":
          return {
            message:
              "You continue to serve in an important leadership capacity within our ministry.",
            responsibilities:
              "Guide and support ministry participants while organizing meaningful activities.",
            encouragement:
              "Your leadership experience remains valuable, and this adjustment helps optimize our ministry structure.",
            icon: "🌟",
            color: "#ffc107",
          };
        case "administrator":
          return {
            message:
              "You maintain significant responsibilities in our ministry administration.",
            responsibilities:
              "Continue managing system operations and supporting our ministry community.",
            encouragement:
              "Your administrative skills are still crucial to our ministry's success.",
            icon: "⚙️",
            color: "#17a2b8",
          };
        default:
          return {
            message: "You remain an important part of our ministry family.",
            responsibilities:
              "Continue growing in faith and finding ways to serve our community.",
            encouragement:
              "Every role in ministry has value, and your contribution matters.",
            icon: "✨",
            color: "#28a745",
          };
      }
    };

    const transitionInfo = getRoleTransitionGuidance(userData.newRole);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ministry Role Update - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .transition-card { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${
              transitionInfo.color
            }; }
            .role-change { text-align: center; margin: 20px 0; background: #e9ecef; padding: 20px; border-radius: 8px; }
            .role-item { display: inline-block; padding: 8px 16px; margin: 5px; border-radius: 20px; font-weight: bold; }
            .old-role { background: #6c757d; color: white; }
            .new-role { background: ${transitionInfo.color}; color: white; }
            .arrow { font-size: 18px; margin: 0 10px; color: #6c757d; }
            .support-section { background: #e8f4fd; border: 1px solid #b3d7ff; padding: 20px; border-radius: 8px; margin: 15px 0; }
            .reason-section { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .encouragement-section { background: #d1ecf1; border: 1px solid #86cfda; padding: 20px; border-radius: 8px; margin: 15px 0; }
            .button { display: inline-block; padding: 12px 30px; background: ${
              transitionInfo.color
            }; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .button.support { background: #17a2b8; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .icon { font-size: 32px; margin-bottom: 10px; }
            .timestamp { color: #6c757d; font-size: 14px; }
            .verse { font-style: italic; color: #495057; text-align: center; margin: 20px 0; padding: 15px; background: #f1f3f4; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon">${transitionInfo.icon}</div>
              <h1>Ministry Role Update</h1>
              <p>Your Role in @Cloud Ministry</p>
            </div>
            <div class="content">
              <h2>Dear ${userName},</h2>
              
              <div class="transition-card">
                <h3>Your Ministry Role Has Been Updated</h3>
                
                <p>We hope this message finds you well. We want to inform you that your role within @Cloud Ministry has been updated.</p>
                
                <div class="role-change">
                  <strong>Role Transition:</strong><br>
                  <span class="role-item old-role">${userData.oldRole}</span>
                  <span class="arrow">→</span>
                  <span class="role-item new-role">${userData.newRole}</span>
                  <br>
                  <span class="timestamp">Updated on ${new Date().toLocaleDateString()}</span>
                </div>

                ${
                  reason
                    ? `
                <div class="reason-section">
                  <h4>📋 Context for This Change:</h4>
                  <p>${reason}</p>
                </div>`
                    : ""
                }

                <div class="encouragement-section">
                  <h4>💙 Your Continued Value in Ministry</h4>
                  <p>${transitionInfo.message}</p>
                  <p><strong>Your Focus Areas:</strong> ${
                    transitionInfo.responsibilities
                  }</p>
                  <p>${transitionInfo.encouragement}</p>
                </div>

                <div class="support-section">
                  <h4>🤝 Support & Next Steps</h4>
                  <p>We're here to support you through this transition:</p>
                  <ul>
                    <li><strong>Questions or Concerns:</strong> Please don't hesitate to reach out to ${administratorName} or any ministry leader</li>
                    <li><strong>Continued Participation:</strong> All ministry activities and fellowship remain open to you</li>
                    <li><strong>Growth Opportunities:</strong> We encourage you to explore new ways to serve and grow spiritually</li>
                    <li><strong>Feedback:</strong> Your perspective and input continue to be valued and welcomed</li>
                  </ul>
                </div>
              </div>

              <div class="verse">
                "And we know that in all things God works for the good of those who love him, who have been called according to his purpose."<br>
                <strong>- Romans 8:28</strong>
              </div>

              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/dashboard" class="button">
                  Access Your Dashboard
                </a>
                <a href="mailto:${changedBy.email}" class="button support">
                  Contact ${administratorName}
                </a>
              </div>

              <p>Please remember that every role in ministry has purpose and value. This change doesn't diminish your worth or your importance to our community. We're grateful for your continued participation and look forward to your ongoing contributions.</p>
              
              <p>If you have any questions or would like to discuss this change, please feel free to reach out. We're here to support you.</p>

              <p>Grace and peace,<br>@Cloud Ministry Leadership</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Faith Community Together</p>
              <p>Role change processed by ${administratorName} (${
      changedBy.role
    })</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: `Ministry Role Update - Your Position in @Cloud Ministry`,
      html,
      text: `Dear ${userName}, Your role in @Cloud Ministry has been updated from ${
        userData.oldRole
      } to ${userData.newRole}. ${transitionInfo.message} ${
        reason ? `Context: ${reason}` : ""
      } Please contact ${administratorName} (${
        changedBy.email
      }) if you have any questions. Dashboard: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/dashboard`,
    });
  }

  /**
   * Send demotion notification to administrators
   * Pattern 4: Administrative record and oversight notification for role demotions
   */
  static async sendDemotionNotificationToAdmins(
    adminEmail: string,
    adminName: string,
    userData: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      oldRole: string;
      newRole: string;
    },
    changedBy: {
      firstName: string;
      lastName: string;
      email: string;
      role: string;
    },
    reason?: string
  ): Promise<boolean> {
    const demotedUserName = `${userData.firstName || ""} ${
      userData.lastName || ""
    }`.trim();
    const administratorName = `${changedBy.firstName || ""} ${
      changedBy.lastName || ""
    }`.trim();

    // Demotion impact assessment for administrative oversight
    const getDemotionImpact = (oldRole: string, newRole: string) => {
      const getImpactLevel = (from: string, to: string) => {
        if (from === "Super Admin" && to !== "Super Admin") return "Critical";
        if (from === "Administrator" && to === "Participant") return "High";
        if (from === "Leader" && to === "Participant") return "Medium";
        if (from === "Administrator" && to === "Leader") return "Medium";
        if (from === "Leader" && to === "Administrator") return "Low"; // This would be promotion, but safety check
        return "Standard";
      };

      const impact = getImpactLevel(oldRole, newRole);

      switch (impact) {
        case "Critical":
          return {
            level: impact,
            color: "#dc3545",
            description:
              "Critical system access reduction - requires immediate attention",
            actions:
              "Review all recent system changes, audit user activity, ensure security protocols",
            icon: "🚨",
            priority: "URGENT",
          };
        case "High":
          return {
            level: impact,
            color: "#fd7e14",
            description:
              "Significant privilege reduction from administrative level",
            actions:
              "Monitor user access patterns, review administrative changes, consider transition support",
            icon: "⚠️",
            priority: "HIGH",
          };
        case "Medium":
          return {
            level: impact,
            color: "#ffc107",
            description: "Moderate role adjustment within operational levels",
            actions:
              "Update access permissions, notify relevant teams, provide role transition guidance",
            icon: "📊",
            priority: "MEDIUM",
          };
        default:
          return {
            level: "Standard",
            color: "#6c757d",
            description: "Standard role adjustment",
            actions: "Update user permissions, document change for records",
            icon: "📝",
            priority: "STANDARD",
          };
      }
    };

    const demotionInfo = getDemotionImpact(userData.oldRole, userData.newRole);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>User Demotion Alert - @Cloud Ministry Admin</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .admin-alert { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${
              demotionInfo.color
            }; }
            .user-info { background: #e9ecef; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .role-change { text-align: center; margin: 20px 0; }
            .role-item { display: inline-block; padding: 8px 16px; margin: 5px; border-radius: 20px; font-weight: bold; }
            .old-role { background: #6c757d; color: white; }
            .new-role { background: ${demotionInfo.color}; color: white; }
            .arrow { font-size: 18px; margin: 0 10px; color: ${
              demotionInfo.color
            }; }
            .impact-badge { display: inline-block; padding: 6px 12px; border-radius: 15px; font-size: 12px; font-weight: bold; color: white; background: ${
              demotionInfo.color
            }; margin: 10px 0; }
            .priority-badge { display: inline-block; padding: 4px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; color: white; background: ${
              demotionInfo.color
            }; margin-left: 10px; }
            .reason-section { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .action-section { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .oversight-section { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .button { display: inline-block; padding: 10px 25px; background: #495057; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .button.primary { background: ${demotionInfo.color}; }
            .button.urgent { background: #dc3545; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .timestamp { color: #6c757d; font-size: 14px; }
            .icon { font-size: 24px; margin-right: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${demotionInfo.icon} User Demotion Alert</h1>
              <p>Administrative Oversight Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName},</h2>
              
              <div class="admin-alert">
                <div class="impact-badge">${demotionInfo.level} Impact</div>
                <span class="priority-badge">${demotionInfo.priority}</span>
                
                <h3>User Role Demotion Processed</h3>
                
                <div class="user-info">
                  <strong>👤 Affected User:</strong> ${demotedUserName}<br>
                  <strong>📧 Email:</strong> ${userData.email}<br>
                  <strong>🔄 Role Change:</strong>
                  <div class="role-change">
                    <span class="role-item old-role">${userData.oldRole}</span>
                    <span class="arrow">→</span>
                    <span class="role-item new-role">${userData.newRole}</span>
                  </div>
                  <strong>👤 Processed By:</strong> ${administratorName} (${
      changedBy.role
    })<br>
                  <strong>⏰ Date:</strong> <span class="timestamp">${new Date().toLocaleString()}</span>
                </div>

                ${
                  reason
                    ? `
                <div class="reason-section">
                  <h4>📋 Reason for Demotion:</h4>
                  <p>${reason}</p>
                </div>`
                    : ""
                }

                <div class="action-section">
                  <h4>⚠️ Impact Assessment & Required Actions:</h4>
                  <p><strong>Impact Level:</strong> ${
                    demotionInfo.description
                  }</p>
                  <p><strong>Required Actions:</strong> ${
                    demotionInfo.actions
                  }</p>
                  ${
                    demotionInfo.level === "Critical"
                      ? "<p><strong>⚡ URGENT:</strong> This change requires immediate administrative review and security verification.</p>"
                      : ""
                  }
                </div>

                <div class="oversight-section">
                  <h4>🔍 Administrative Oversight</h4>
                  <p>Please ensure the following oversight activities are completed:</p>
                  <ul>
                    <li><strong>Access Review:</strong> Verify user permissions have been properly updated</li>
                    <li><strong>Security Check:</strong> Ensure no unauthorized access remains</li>
                    <li><strong>Documentation:</strong> Record this change in the administrative log</li>
                    <li><strong>Follow-up:</strong> Monitor user activity for the next 7 days</li>
                    ${
                      reason
                        ? "<li><strong>Communication:</strong> Ensure user has received appropriate guidance</li>"
                        : ""
                    }
                  </ul>
                </div>

                <p><strong>Administrative Note:</strong> This demotion has been processed and logged for compliance and security purposes. Please review the user's current access level and ensure all security protocols are maintained.</p>
              </div>

              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/users/${userData.email}" class="button primary">
                  Review User Profile
                </a>
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/audit-log" class="button">
                  View Audit Log
                </a>
                ${
                  demotionInfo.level === "Critical"
                    ? `
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/security-review" class="button urgent">
                  Security Review
                </a>`
                    : ""
                }
              </div>

              <p><strong>Security Reminder:</strong> All role demotions are permanently logged for compliance. If this change was unauthorized or you have concerns, please escalate immediately to senior administration.</p>
              
              <p>Best regards,<br>@Cloud Ministry Security System</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Administrative Security Notifications</p>
              <p>Demotion processed by ${administratorName} (${
      changedBy.role
    }) | Impact: ${demotionInfo.level}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: adminEmail,
      subject: `🚨 Admin Alert: User Demoted from ${userData.oldRole} to ${userData.newRole} - ${demotedUserName}`,
      html,
      text: `Admin Alert: ${demotedUserName} (${
        userData.email
      }) has been demoted from ${userData.oldRole} to ${
        userData.newRole
      } by ${administratorName}. Impact: ${demotionInfo.level}. ${
        reason ? `Reason: ${reason}` : ""
      } Please review user management dashboard: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/admin/users`,
    });
  }

  /**
   * Send AtCloud Ministry role change notification to the user
   * Simple, functional notification about ministry role changes
   */
  static async sendAtCloudRoleChangeToUser(
    userEmail: string,
    userData: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      oldRoleInAtCloud: string;
      newRoleInAtCloud: string;
    }
  ): Promise<boolean> {
    const userName = `${userData.firstName || ""} ${
      userData.lastName || ""
    }`.trim();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ministry Role Update - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .role-change { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ministry Role Update</h1>
              <p>@Cloud Ministry</p>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              
              <p>Your ministry role has been updated in our system.</p>
              
              <div class="role-change">
                <h3>Role Change Details</h3>
                <p><strong>Previous Role:</strong> ${
                  userData.oldRoleInAtCloud
                }</p>
                <p><strong>New Role:</strong> ${userData.newRoleInAtCloud}</p>
              </div>

              <p>You can access your updated ministry dashboard and role-specific resources using the button below.</p>

              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/ministry/dashboard" class="button">
                  View Ministry Dashboard
                </a>
              </div>

              <p>If you have any questions about this change, please contact our ministry leadership.</p>
              
              <p>Blessings,<br>@Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Ministry Role Notification</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: `Ministry Role Update: ${userData.newRoleInAtCloud}`,
      html,
      text: `Hello ${userName}, Your ministry role has been updated from ${
        userData.oldRoleInAtCloud
      } to ${userData.newRoleInAtCloud}. Access your ministry dashboard: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/ministry/dashboard`,
    });
  }

  /**
   * Send AtCloud Ministry role change notification to admins
   */
  static async sendAtCloudRoleChangeToAdmins(
    adminEmail: string,
    adminName: string,
    userData: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      oldRoleInAtCloud: string;
      newRoleInAtCloud: string;
    }
  ): Promise<boolean> {
    const userName = `${userData.firstName || ""} ${
      userData.lastName || ""
    }`.trim();
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Admin Alert: Ministry Role Change</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .admin-alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .user-details { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Admin Alert</h1>
              <p>Ministry Role Change Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName},</h2>
              <div class="admin-alert">
                <h3>Ministry Role Change Alert</h3>
                <p>A ministry role change has occurred in the system.</p>
              </div>
              <div class="user-details">
                <h4>User Details</h4>
                <p><strong>Name:</strong> ${userName}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>Previous Role:</strong> ${
                  userData.oldRoleInAtCloud
                }</p>
                <p><strong>New Role:</strong> ${userData.newRoleInAtCloud}</p>
              </div>
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/users" class="button">
                  Review in Admin Dashboard
                </a>
              </div>
              <p>Best regards,<br>@Cloud Ministry System</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Administrative Notifications</p>
            </div>
          </div>
        </body>
      </html>
    `;
    return this.sendEmail({
      to: adminEmail,
      subject: `🚨 Admin Alert: Ministry Role Change - ${userName}`,
      html,
      text: `Admin Alert: ${userName} (${userData.email}) ministry role changed from ${userData.oldRoleInAtCloud} to ${userData.newRoleInAtCloud}. Please review in admin dashboard.`,
    });
  }

  /**
   * Send new leader signup notification to admins
   * Pattern: Admin notification when new leader registers
   */
  static async sendNewLeaderSignupEmail(
    adminEmail: string,
    adminName: string,
    newLeaderData: {
      firstName: string;
      lastName: string;
      email: string;
      roleInAtCloud: string;
      signupDate: string;
    }
  ): Promise<boolean> {
    const leaderName = `${newLeaderData.firstName || ""} ${
      newLeaderData.lastName || ""
    }`.trim();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Leader Signup - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .leader-info { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .signup-details { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .button:hover { background: #218838; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌟 New Leader Signup</h1>
              <p>A new leader has joined @Cloud Ministry</p>
            </div>
            <div class="content">
              <p>Hello ${adminName},</p>
              
              <div class="leader-info">
                <h3>🆕 New Leader Registration</h3>
                <p>A new leader has registered for @Cloud Ministry and requires admin review.</p>
              </div>

              <div class="signup-details">
                <h4>Leader Details:</h4>
                <p><strong>Name:</strong> ${leaderName}</p>
                <p><strong>Email:</strong> ${newLeaderData.email}</p>
                <p><strong>Ministry Role:</strong> ${newLeaderData.roleInAtCloud}</p>
                <p><strong>Signup Date:</strong> ${newLeaderData.signupDate}</p>
              </div>

              <p>Please review this new leader's registration and take appropriate action:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="#{ADMIN_DASHBOARD_URL}/leaders" class="button">Review Leader</a>
                <a href="#{ADMIN_DASHBOARD_URL}/users" class="button" style="background: #6c757d;">Manage Users</a>
              </div>

              <p><em>This is an automated notification. Please review the new leader's information in the admin dashboard.</em></p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry Admin System</p>
              <p>This email was sent to admins for new leader signup notifications.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: adminEmail,
      subject: `🌟 New Leader Signup: ${leaderName} - ${newLeaderData.roleInAtCloud}`,
      html,
      text: `New Leader Signup: ${leaderName} (${newLeaderData.email}) has registered as ${newLeaderData.roleInAtCloud} on ${newLeaderData.signupDate}. Please review in admin dashboard.`,
    });
  }

  /**
   * Send co-organizer assignment notification
   * Pattern: Notification to the newly assigned co-organizer
   */
  static async sendCoOrganizerAssignedEmail(
    coOrganizerEmail: string,
    assignedUser: {
      firstName: string;
      lastName: string;
    },
    eventData: {
      title: string;
      date: string;
      time: string;
      location: string;
    },
    assignedBy: {
      firstName: string;
      lastName: string;
    }
  ): Promise<boolean> {
    const coOrganizerName = `${assignedUser.firstName || ""} ${
      assignedUser.lastName || ""
    }`.trim();

    const organizerName = `${assignedBy.firstName || ""} ${
      assignedBy.lastName || ""
    }`.trim();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Co-Organizer Assignment - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .welcome-message { background: #e7e3ff; border-left: 4px solid #6f42c1; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .event-details { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid #dee2e6; }
            .responsibility-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #6f42c1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .button:hover { background: #5a32a3; }
            .button.secondary { background: #6c757d; }
            .button.secondary:hover { background: #545b62; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
            .contact-info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to the Team!</h1>
              <p>You've been assigned as Co-Organizer</p>
            </div>
            <div class="content">
              <p>Hello ${coOrganizerName},</p>
              
              <div class="welcome-message">
                <h3>🤝 Co-Organizer Assignment</h3>
                <p>You have been assigned as a <strong>Co-Organizer</strong> for an upcoming event. Welcome to the organizing team!</p>
              </div>

              <div class="event-details">
                <h4>📅 Event Details:</h4>
                <p><strong>Event:</strong> ${eventData.title}</p>
                <p><strong>Date:</strong> ${eventData.date}</p>
                <p><strong>Time:</strong> ${eventData.time}</p>
                <p><strong>Location:</strong> ${eventData.location}</p>
                <p><strong>Assigned by:</strong> ${organizerName}</p>
              </div>

              <div class="responsibility-box">
                <h4>🎯 Your Responsibilities:</h4>
                <ul>
                  <li>Help coordinate event logistics and planning</li>
                  <li>Assist with participant communication and management</li>
                  <li>Support the main organizer during the event</li>
                  <li>Help ensure the event runs smoothly</li>
                </ul>
              </div>

              <div class="contact-info">
                <h4>📞 Main Organizer Contact:</h4>
                <p><strong>${organizerName}</strong> is the main organizer for this event. Please reach out if you have any questions or need guidance.</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="#{EVENT_DASHBOARD_URL}/events/${eventData.title}" class="button">View Event Details</a>
                <a href="#{EVENT_DASHBOARD_URL}/organize" class="button secondary">Event Management</a>
              </div>

              <p>Thank you for volunteering to help organize this event. Your contribution makes a difference in our ministry!</p>
              
              <p><em>If you have any questions about your role or the event, please don't hesitate to contact the main organizer.</em></p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry Event Management</p>
              <p>This email was sent regarding your co-organizer assignment.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: coOrganizerEmail,
      subject: `🎉 Co-Organizer Assignment: ${eventData.title}`,
      html,
      text: `You have been assigned as Co-Organizer for "${eventData.title}" on ${eventData.date} at ${eventData.time}. Location: ${eventData.location}. Assigned by: ${organizerName}. Please check the event management dashboard for more details.`,
    });
  }

  /**
   * Send event reminder notification to participants
   * Pattern: Time-sensitive reminder to event participants
   */
  static async sendEventReminderEmail(
    email: string,
    userName: string,
    eventData: {
      title: string;
      date: string;
      time: string;
      location: string;
      zoomLink?: string;
      format: string;
    },
    reminderType: "1h" | "24h" | "1week"
  ): Promise<boolean> {
    const reminderLabels = {
      "1h": { label: "1 Hour", urgency: "high", emoji: "🚨" },
      "24h": { label: "24 Hours", urgency: "medium", emoji: "⏰" },
      "1week": { label: "1 Week", urgency: "low", emoji: "📅" },
    };

    const reminder = reminderLabels[reminderType];
    const isUrgent = reminderType === "1h";
    const isVirtual = eventData.format === "virtual" || eventData.zoomLink;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Event Reminder - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%); color: white; padding: 30px; text-align: center; }
            .header.urgent { background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); }
            .header.medium { background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); }
            .header.low { background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%); }
            .content { padding: 30px; }
            .reminder-badge { display: inline-block; background: #dc3545; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
            .reminder-badge.medium { background: #ffc107; color: #212529; }
            .reminder-badge.low { background: #17a2b8; }
            .event-details { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid #dee2e6; }
            .countdown { background: #ffe8e8; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 4px; text-align: center; font-size: 18px; font-weight: bold; }
            .countdown.medium { background: #fff3cd; border-left-color: #ffc107; }
            .countdown.low { background: #d1ecf1; border-left-color: #17a2b8; }
            .virtual-info { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .location-info { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; font-weight: bold; }
            .button:hover { background: #c82333; }
            .button.virtual { background: #28a745; }
            .button.virtual:hover { background: #218838; }
            .button.calendar { background: #6c757d; }
            .button.calendar:hover { background: #545b62; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header ${reminder.urgency}">
              <h1>${reminder.emoji} Event Reminder</h1>
              <p>${reminder.label} Until Event</p>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              
              <div class="reminder-badge ${reminder.urgency}">
                ${reminder.emoji} ${reminder.label} Reminder
              </div>

              <div class="countdown ${reminder.urgency}">
                ${
                  isUrgent
                    ? "🚨 STARTING SOON! 🚨"
                    : reminder.urgency === "medium"
                    ? "⏰ Tomorrow!"
                    : "📅 Coming Up!"
                }
              </div>

              <div class="event-details">
                <h3>📋 Event Details:</h3>
                <p><strong>Event:</strong> ${eventData.title}</p>
                <p><strong>Date:</strong> ${eventData.date}</p>
                <p><strong>Time:</strong> ${eventData.time}</p>
                <p><strong>Format:</strong> ${eventData.format}</p>
                ${
                  isVirtual
                    ? `<p><strong>Platform:</strong> Virtual Meeting</p>`
                    : `<p><strong>Location:</strong> ${eventData.location}</p>`
                }
              </div>

              ${
                isVirtual && eventData.zoomLink
                  ? `
                <div class="virtual-info">
                  <h4>💻 Virtual Event Access:</h4>
                  <p>This is a virtual event. Use the link below to join:</p>
                  <div style="text-align: center; margin: 15px 0;">
                    <a href="${eventData.zoomLink}" class="button virtual">Join Virtual Event</a>
                  </div>
                  <p><em>Please test your audio and video before the event starts.</em></p>
                </div>
              `
                  : !isVirtual
                  ? `
                <div class="location-info">
                  <h4>📍 In-Person Event Location:</h4>
                  <p><strong>Address:</strong> ${eventData.location}</p>
                  <p><em>Please arrive 10-15 minutes early for check-in.</em></p>
                </div>
              `
                  : ""
              }

              <div style="text-align: center; margin: 30px 0;">
                ${
                  isVirtual && eventData.zoomLink
                    ? `<a href="${eventData.zoomLink}" class="button virtual">Join Now</a>`
                    : `<a href="#{EVENT_DETAILS_URL}/${eventData.title}" class="button">View Event Details</a>`
                }
                <a href="#{CALENDAR_URL}" class="button calendar">Add to Calendar</a>
              </div>

              <p>
                ${
                  isUrgent
                    ? "<strong>The event is starting very soon! Please make sure you're ready to participate.</strong>"
                    : reminder.urgency === "medium"
                    ? "The event is tomorrow! Please make your final preparations."
                    : "Just a friendly reminder about this upcoming event. Mark your calendar!"
                }
              </p>

              <p>We look forward to seeing you there!</p>
              
              <p><em>If you need to cancel your attendance, please let us know as soon as possible.</em></p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry Event Notifications</p>
              <p>This reminder was sent for your registered event participation.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `${reminder.emoji} Reminder: ${eventData.title} - ${reminder.label}`,
      html,
      text: `${reminder.emoji} Event Reminder: "${
        eventData.title
      }" is ${reminder.label.toLowerCase()} away! Date: ${eventData.date} at ${
        eventData.time
      }. ${
        isVirtual
          ? `Join link: ${eventData.zoomLink || "Virtual event"}`
          : `Location: ${eventData.location}`
      }. Format: ${eventData.format}.`,
    });
  }
}
