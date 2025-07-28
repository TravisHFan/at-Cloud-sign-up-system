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
}
