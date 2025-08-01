import { EmailService } from "./emailService";
import { EmailRecipientUtils } from "../../utils/emailRecipientUtils";
import Message from "../../models/Message";
import { socketService } from "./SocketService";

/**
 * AutoEmailNotificationService
 *
 * This service bridges the gap between email notifications and the unified message system.
 * It ensures that every email notification also creates corresponding system messages
 * and bell notifications for a consistent user experience.
 *
 * Pattern: Email → System Message → Bell Notification (automatically)
 */
export class AutoEmailNotificationService {
  // Global call counter for debugging
  private static callCounter = 0;

  /**
   * Reset the call counter (for testing)
   */
  static resetCallCounter(): void {
    this.callCounter = 0;
    console.log("🔄 [AutoEmailNotificationService] Call counter reset to 0");
  }

  /**
   * Send role change notification with unified messaging
   * Handles both promotions and demotions
   */
  static async sendRoleChangeNotification(changeData: {
    userData: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      oldRole: string;
      newRole: string;
    };
    changedBy: {
      _id?: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
    };
    reason?: string;
    isPromotion: boolean;
  }): Promise<{
    emailsSent: number;
    messagesCreated: number;
    success: boolean;
  }> {
    try {
      this.callCounter++;
      console.log(
        `🚨 [AutoEmailNotificationService] sendRoleChangeNotification called #${this.callCounter} at:`,
        new Date().toISOString()
      );
      console.log("🚨 [AutoEmailNotificationService] Call stack trace:");
      console.trace();

      let emailsSent = 0;
      let messagesCreated = 0;

      const { userData, changedBy, reason, isPromotion } = changeData;

      // Step 1: Send emails (existing functionality) with timeout protection
      console.log("📧 Sending emails for role change...");

      if (isPromotion) {
        // Send promotion email to user with timeout
        try {
          const userEmailPromise = EmailService.sendPromotionNotificationToUser(
            userData.email,
            userData,
            changedBy
          );
          const userEmailSuccess = await Promise.race([
            userEmailPromise,
            new Promise<boolean>((_, reject) =>
              setTimeout(() => reject(new Error("Email timeout")), 10000)
            ),
          ]);
          if (userEmailSuccess) emailsSent++;
          console.log(`✅ User promotion email sent to ${userData.email}`);
        } catch (error: any) {
          console.error(
            `❌ Failed to send promotion email to user: ${
              error?.message || error
            }`
          );
        }

        // Send promotion email to admins with timeout
        try {
          const adminRecipients =
            await EmailRecipientUtils.getSystemAuthorizationChangeRecipients(
              userData._id
            );
          const adminEmailPromises = adminRecipients.map((admin) =>
            Promise.race([
              EmailService.sendPromotionNotificationToAdmins(
                admin.email,
                `${admin.firstName} ${admin.lastName}`.trim(),
                userData,
                changedBy
              ),
              new Promise<boolean>((_, reject) =>
                setTimeout(() => reject(new Error("Email timeout")), 10000)
              ),
            ])
          );

          const adminEmailResults = await Promise.allSettled(
            adminEmailPromises
          );
          const successfulAdminEmails = adminEmailResults.filter(
            (result) => result.status === "fulfilled" && result.value === true
          ).length;
          emailsSent += successfulAdminEmails;
          console.log(
            `✅ Admin promotion emails sent: ${successfulAdminEmails}/${adminRecipients.length}`
          );
        } catch (error: any) {
          console.error(
            `❌ Failed to send promotion emails to admins: ${
              error?.message || error
            }`
          );
        }
      } else {
        // Send demotion email to user with timeout
        try {
          const userEmailPromise = EmailService.sendDemotionNotificationToUser(
            userData.email,
            userData,
            changedBy,
            reason
          );
          const userEmailSuccess = await Promise.race([
            userEmailPromise,
            new Promise<boolean>((_, reject) =>
              setTimeout(() => reject(new Error("Email timeout")), 10000)
            ),
          ]);
          if (userEmailSuccess) emailsSent++;
          console.log(`✅ User demotion email sent to ${userData.email}`);
        } catch (error: any) {
          console.error(
            `❌ Failed to send demotion email to user: ${
              error?.message || error
            }`
          );
        }

        // Send demotion email to admins with timeout
        try {
          const adminRecipients =
            await EmailRecipientUtils.getSystemAuthorizationChangeRecipients(
              userData._id
            );
          const adminEmailPromises = adminRecipients.map((admin) =>
            Promise.race([
              EmailService.sendDemotionNotificationToAdmins(
                admin.email,
                `${admin.firstName} ${admin.lastName}`.trim(),
                userData,
                changedBy,
                reason
              ),
              new Promise<boolean>((_, reject) =>
                setTimeout(() => reject(new Error("Email timeout")), 10000)
              ),
            ])
          );

          const adminEmailResults = await Promise.allSettled(
            adminEmailPromises
          );
          const successfulAdminEmails = adminEmailResults.filter(
            (result) => result.status === "fulfilled" && result.value === true
          ).length;
          emailsSent += successfulAdminEmails;
          console.log(
            `✅ Admin demotion emails sent: ${successfulAdminEmails}/${adminRecipients.length}`
          );
        } catch (error: any) {
          console.error(
            `❌ Failed to send demotion emails to admins: ${
              error?.message || error
            }`
          );
        }
      }

      // Step 2: Create unified system messages (NEW FUNCTIONALITY)
      console.log("📱 Creating system messages and bell notifications...");

      // Create message for the user whose role changed
      const userMessage = await this.createUserRoleChangeMessage({
        userId: userData._id,
        userData,
        changedBy,
        reason,
        isPromotion,
      });
      if (userMessage) {
        messagesCreated++;
        console.log(
          `✅ User system message created for ${userData.firstName} ${userData.lastName}`
        );
      }

      // Create messages for admins
      const adminMessage = await this.createAdminRoleChangeMessage({
        userData,
        changedBy,
        reason,
        isPromotion,
      });
      if (adminMessage) {
        messagesCreated++;
        console.log(`✅ Admin system messages created`);
      }

      console.log(
        `📊 Final results: ${emailsSent} emails sent, ${messagesCreated} system messages created`
      );

      return {
        emailsSent,
        messagesCreated,
        success: true,
      };
    } catch (error) {
      console.error("Error in sendRoleChangeNotification:", error);
      return {
        emailsSent: 0,
        messagesCreated: 0,
        success: false,
      };
    }
  }

  /**
   * Create system message for the user whose role changed
   */
  private static async createUserRoleChangeMessage({
    userId,
    userData,
    changedBy,
    reason,
    isPromotion,
  }: {
    userId: string;
    userData: any;
    changedBy: any;
    reason?: string;
    isPromotion: boolean;
  }): Promise<any> {
    try {
      const messageTitle = isPromotion
        ? `🎉 Your System Access Level Changed`
        : `📋 Your System Access Level Updated`;

      const messageContent = isPromotion
        ? `Congratulations! Your role has been updated from ${userData.oldRole} to ${userData.newRole} by ${changedBy.firstName} ${changedBy.lastName}. This change grants you additional system permissions and capabilities. Welcome to your new responsibilities!`
        : `Your role has been updated from ${userData.oldRole} to ${
            userData.newRole
          } by ${changedBy.firstName} ${
            changedBy.lastName
          }. This change affects your system permissions and access levels.${
            reason ? ` Context: ${reason}` : ""
          }`;

      // Create message for the specific user
      const message = await Message.createForAllUsers(
        {
          title: messageTitle,
          content: messageContent,
          type: "auth_level_change",
          priority: "high",
          targetUserId: userId, // Add targetUserId for frontend filtering
          creator: {
            id: changedBy._id || "system",
            firstName: changedBy.firstName,
            lastName: changedBy.lastName,
            username: changedBy.email.split("@")[0],
            avatar: changedBy.avatar, // Use actual avatar from changedBy user
            gender: changedBy.gender || "male", // Use actual gender or default to male
            roleInAtCloud: changedBy.role,
            authLevel: changedBy.role,
          },
          isActive: true,
        },
        [userId] // Only send to the specific user
      );

      // Emit real-time notifications
      if (message) {
        socketService.emitSystemMessageUpdate(userId, "message_created", {
          message: {
            id: message._id,
            title: message.title,
            content: message.content,
            type: message.type,
            priority: message.priority,
            creator: message.creator,
            createdAt: message.createdAt,
          },
        });

        socketService.emitBellNotificationUpdate(userId, "notification_added", {
          messageId: message._id,
          title: message.getBellDisplayTitle(),
          content: message.content,
          type: message.type,
          priority: message.priority,
          createdAt: message.createdAt,
          isRead: false,
        });

        // Update unread counts
        const updatedCounts = await Message.getUnreadCountsForUser(userId);
        socketService.emitUnreadCountUpdate(userId, updatedCounts);
      }

      return message;
    } catch (error) {
      console.error("Error creating user role change message:", error);
      return null;
    }
  }

  /**
   * Create system message for admins about role change
   */
  private static async createAdminRoleChangeMessage({
    userData,
    changedBy,
    reason,
    isPromotion,
  }: {
    userData: any;
    changedBy: any;
    reason?: string;
    isPromotion: boolean;
  }): Promise<any> {
    try {
      const actionType = isPromotion ? "promoted" : "demoted";
      const messageTitle = `👤 User Role Change: ${userData.firstName} ${userData.lastName}`;

      const messageContent = `${userData.firstName} ${userData.lastName} (${
        userData.email
      }) has been ${actionType} from ${userData.oldRole} to ${
        userData.newRole
      } by ${changedBy.firstName} ${
        changedBy.lastName
      }. Date: ${new Date().toLocaleString()}${
        reason ? `. Reason: ${reason}` : ""
      }`;

      // Get admin recipients
      const adminRecipients = await EmailRecipientUtils.getAdminUsers();

      // For now, we'll use the email as identifier and create a proper user lookup
      // This is a temporary solution - ideally the EmailRecipientUtils should return user IDs
      const adminEmails = adminRecipients.map((admin) => admin.email);

      // Find actual admin users with IDs
      const User = (await import("../../models/User")).default;
      const adminUsers = await User.find({
        email: { $in: adminEmails },
        isActive: true,
      }).select("_id email firstName lastName");

      const adminUserIds = adminUsers.map((admin) =>
        (admin as any)._id.toString()
      );

      if (adminUserIds.length === 0) {
        console.log("No admin users found for role change notification");
        return null;
      }

      // Create message for all admin users
      const message = await Message.createForAllUsers(
        {
          title: messageTitle,
          content: messageContent,
          type: "admin_notification", // Different type for admin notifications
          priority: "medium",
          creator: {
            id: changedBy._id || "system",
            firstName: changedBy.firstName,
            lastName: changedBy.lastName,
            username: changedBy.email.split("@")[0],
            avatar: changedBy.avatar,
            gender: changedBy.gender || "male", // Required field - using actual gender or default
            roleInAtCloud: changedBy.role,
            authLevel: changedBy.role,
          },
          isActive: true,
        },
        adminUserIds
      );

      // Emit real-time notifications to all admins
      if (message) {
        for (const adminId of adminUserIds) {
          socketService.emitSystemMessageUpdate(adminId, "message_created", {
            message: {
              id: message._id,
              title: message.title,
              content: message.content,
              type: message.type,
              priority: message.priority,
              creator: message.creator,
              createdAt: message.createdAt,
            },
          });

          socketService.emitBellNotificationUpdate(
            adminId,
            "notification_added",
            {
              messageId: message._id,
              title: message.getBellDisplayTitle(),
              content: message.content,
              type: message.type,
              priority: message.priority,
              createdAt: message.createdAt,
              isRead: false,
            }
          );

          // Update unread counts for each admin
          try {
            const updatedCounts = await Message.getUnreadCountsForUser(adminId);
            socketService.emitUnreadCountUpdate(adminId, updatedCounts);
          } catch (error) {
            console.error(
              `Failed to emit unread count update for admin ${adminId}:`,
              error
            );
          }
        }
      }

      return message;
    } catch (error) {
      console.error("Error creating admin role change message:", error);
      return null;
    }
  }

  /**
   * Send event creation notification with unified messaging
   */
  static async sendEventCreationNotification(
    eventData: {
      title: string;
      date: string;
      time: string;
      location: string;
      organizerName: string;
      id: string;
      creator: any;
    },
    excludeEmail?: string
  ): Promise<{
    emailsSent: number;
    messagesCreated: number;
    success: boolean;
  }> {
    try {
      let emailsSent = 0;
      let messagesCreated = 0;

      // Step 1: Send emails (existing functionality)
      const recipients = await EmailRecipientUtils.getActiveVerifiedUsers(
        excludeEmail
      );

      // For now, use a simple email service approach
      // Note: EmailService doesn't have sendEventCreatedNotification method yet
      // This would need to be implemented
      // TODO: Implement actual email sending for event creation
      console.log(
        `Would send emails to ${recipients.length} recipients for event: ${eventData.title}`
      );

      // Step 2: Create unified system message
      const allUserIds = recipients
        .map((r) => (r as any)._id?.toString())
        .filter(Boolean);

      if (allUserIds.length > 0) {
        const message = await Message.createForAllUsers(
          {
            title: `📅 New Event: ${eventData.title}`,
            content: `New event "${eventData.title}" is now open for registration. Event Date: ${eventData.date} at ${eventData.time}. Location: ${eventData.location}. Click to view details and register.`,
            type: "announcement",
            priority: "medium",
            creator: eventData.creator,
            isActive: true,
          },
          allUserIds
        );

        if (message) {
          messagesCreated++;

          // Emit real-time notifications to all users
          for (const userId of allUserIds) {
            socketService.emitSystemMessageUpdate(userId, "message_created", {
              message: {
                id: message._id,
                title: message.title,
                content: message.content,
                type: message.type,
                priority: message.priority,
                creator: message.creator,
                createdAt: message.createdAt,
              },
            });

            socketService.emitBellNotificationUpdate(
              userId,
              "notification_added",
              {
                messageId: message._id,
                title: message.getBellDisplayTitle(),
                content: message.content,
                type: message.type,
                priority: message.priority,
                createdAt: message.createdAt,
                isRead: false,
              }
            );
          }
        }
      }

      return {
        emailsSent,
        messagesCreated,
        success: true,
      };
    } catch (error) {
      console.error("Error in sendEventCreationNotification:", error);
      return {
        emailsSent: 0,
        messagesCreated: 0,
        success: false,
      };
    }
  }
}
