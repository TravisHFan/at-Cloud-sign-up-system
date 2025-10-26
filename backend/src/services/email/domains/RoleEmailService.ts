import { EmailOptions, EmailHelpers } from "../../email";
import { createLogger } from "../../../services/LoggerService";

const log = createLogger("RoleEmailService");

interface EmailTemplateData {
  name?: string;
  email?: string;
  [key: string]: any;
}

/**
 * RoleEmailService
 *
 * Handles all role-related email notifications for both general users and AtCloud-specific roles:
 * - User promotions (to admins and to user)
 * - User demotions (to admins and to user)
 * - AtCloud role changes (Leader, Class Rep, Participant)
 * - AtCloud role assignments and removals (notifications to admins)
 * - New Leader signup notifications
 *
 * Extracted from EmailService.ts for better organization and maintainability.
 */
export class RoleEmailService {
  /**
   * Core email sending method - delegates to EmailTransporter
   * This is a convenience method to avoid importing EmailTransporter in every method
   */
  private static async sendEmail(options: EmailOptions): Promise<boolean> {
    // Import EmailServiceFacade dynamically to avoid circular dependency
    const { EmailService } = await import(
      "../../infrastructure/EmailServiceFacade"
    );
    return EmailService.sendEmail(options);
  }

  /**
   * Helper method for formatting date/time ranges in emails
   */
  private static formatDateTimeRange(
    date: string,
    startTime: string,
    endTime?: string,
    endDate?: string,
    timeZone?: string
  ): string {
    return EmailHelpers.formatDateTimeRange(
      date,
      startTime,
      endTime,
      endDate,
      timeZone
    );
  }

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
              <p>If you have any questions about your new role, please contact us at atcloudministry@gmail.com</p>
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

  static async sendAtCloudRoleAssignedToAdmins(
    adminEmail: string,
    adminName: string,
    userData: {
      firstName: string;
      lastName: string;
      email: string;
      roleInAtCloud: string;
    }
  ): Promise<boolean> {
    const userName = `${userData.firstName} ${userData.lastName}`.trim();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>@Cloud Co-worker Role Invited - Admin Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .admin-alert { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .user-details { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ @Cloud Co-worker Role Invited</h1>
              <p>Administrative Oversight Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName},</h2>
              <div class="admin-alert">
                <h3>@Cloud Co-worker Role Invited</h3>
                <p>A user has been assigned an @Cloud co-worker role.</p>
              </div>
              <div class="user-details">
                <h4>User Details</h4>
                <p><strong>Name:</strong> ${userName}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>@Cloud Role:</strong> ${userData.roleInAtCloud}</p>
                <p><strong>Status:</strong> Now an @Cloud Co-worker</p>
              </div>
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/users" class="button">
                  Review in Admin Dashboard
                </a>
              </div>
              <p>Please review the new co-worker assignment and provide any necessary guidance.</p>
              <p>Best regards,<br>@Cloud Ministry System</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Administrative Oversight</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: adminEmail,
      subject: `✅ @Cloud Co-worker Role Invited - ${userName}`,
      html,
      text: `@Cloud Co-worker Role Invited: ${userName} (${userData.email}) has been invited to the @Cloud role: ${userData.roleInAtCloud}`,
    });
  }

  static async sendAtCloudRoleRemovedToAdmins(
    adminEmail: string,
    adminName: string,
    userData: {
      firstName: string;
      lastName: string;
      email: string;
      previousRoleInAtCloud: string;
    }
  ): Promise<boolean> {
    const userName = `${userData.firstName} ${userData.lastName}`.trim();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>@Cloud Co-worker Role Removed - Admin Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #fd7e14 0%, #ffc107 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .admin-alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .user-details { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #fd7e14; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ @Cloud Co-worker Role Removed</h1>
              <p>Administrative Oversight Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName},</h2>
              <div class="admin-alert">
                <h3>@Cloud Co-worker Role Removal</h3>
                <p>A user has removed their @Cloud co-worker role.</p>
              </div>
              <div class="user-details">
                <h4>User Details</h4>
                <p><strong>Name:</strong> ${userName}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>Previous @Cloud Role:</strong> ${
                  userData.previousRoleInAtCloud
                }</p>
                <p><strong>Status:</strong> No longer an @Cloud Co-worker</p>
              </div>
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/users" class="button">
                  Review in Admin Dashboard
                </a>
              </div>
              <p>Please review this role removal and ensure appropriate ministry transitions are handled.</p>
              <p>Best regards,<br>@Cloud Ministry System</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Administrative Oversight</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: adminEmail,
      subject: `⚠️ @Cloud Co-worker Role Removed - ${userName}`,
      html,
      text: `@Cloud Co-worker Role Removed: ${userName} (${userData.email}) has removed his or her @Cloud co-worker role. 
      Previous role: ${userData.previousRoleInAtCloud}`,
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
      endTime?: string;
      endDate?: string;
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
                <p><strong>Date & Time:</strong> ${RoleEmailService.formatDateTimeRange(
                  eventData.date,
                  eventData.time,
                  eventData.endTime,
                  eventData.endDate,
                  (eventData as any).timeZone
                )}</p>
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
                <a href="#{EVENT_DASHBOARD_URL}/events/${
                  eventData.title
                }" class="button">View Event Details</a>
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
      text: `You have been assigned as Co-Organizer for "${
        eventData.title
      }" on ${RoleEmailService.formatDateTimeRange(
        eventData.date,
        eventData.time,
        eventData.endTime,
        eventData.endDate,
        (eventData as any).timeZone
      )}. Location: ${
        eventData.location
      }. Assigned by: ${organizerName}. Please check the event management dashboard for more details.`,
    });
  }
}
