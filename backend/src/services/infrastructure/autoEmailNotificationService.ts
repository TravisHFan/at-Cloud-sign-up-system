import { EmailService } from "./emailService";
import { EmailRecipientUtils } from "../../utils/emailRecipientUtils";
import Message from "../../models/Message";
import { socketService } from "./SocketService";
import { UnifiedMessageController } from "../../controllers/unifiedMessageController";
import { formatActorDisplay } from "../../utils/systemMessageFormatUtils";

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
  /**
   * Send admin notifications (email + system message) when a user's account status changes
   * Actions: deactivated | reactivated | deleted
   * - For deleted: option to skip system message if already created elsewhere (to avoid duplicates)
   */
  static async sendAccountStatusChangeAdminNotifications(params: {
    action: "deactivated" | "reactivated" | "deleted";
    targetUser: {
      _id: string;
      firstName?: string;
      lastName?: string;
      email: string;
    };
    actor: {
      _id?: string;
      firstName?: string;
      lastName?: string;
      email: string;
      role: string;
      avatar?: string;
      gender?: string;
    };
    /**
     * Whether to also create system messages for admins.
     * Default true. For deletion flows, controller may set false if it already created a message.
     */
    createSystemMessage?: boolean;
  }): Promise<{
    emailsSent: number;
    messagesCreated: number;
    success: boolean;
  }> {
    const { action, targetUser, actor, createSystemMessage = true } = params;
    try {
      let emailsSent = 0;
      let messagesCreated = 0;

      // 1) Send emails to admins
      try {
        const adminRecipients = await EmailRecipientUtils.getAdminUsers();
        const adminEmailPromises = adminRecipients.map((admin) => {
          const adminName = `${admin.firstName} ${admin.lastName}`.trim();
          if (action === "deactivated") {
            return EmailService.sendUserDeactivatedAlertToAdmin(
              admin.email,
              adminName,
              {
                firstName: targetUser.firstName || "",
                lastName: targetUser.lastName || "",
                email: targetUser.email,
              },
              {
                firstName: actor.firstName || "",
                lastName: actor.lastName || "",
                email: actor.email,
                role: actor.role,
              }
            );
          } else if (action === "reactivated") {
            return EmailService.sendUserReactivatedAlertToAdmin(
              admin.email,
              adminName,
              {
                firstName: targetUser.firstName || "",
                lastName: targetUser.lastName || "",
                email: targetUser.email,
              },
              {
                firstName: actor.firstName || "",
                lastName: actor.lastName || "",
                email: actor.email,
                role: actor.role,
              }
            );
          } else {
            return EmailService.sendUserDeletedAlertToAdmin(
              admin.email,
              adminName,
              {
                firstName: targetUser.firstName || "",
                lastName: targetUser.lastName || "",
                email: targetUser.email,
              },
              {
                firstName: actor.firstName || "",
                lastName: actor.lastName || "",
                email: actor.email,
                role: actor.role,
              }
            );
          }
        });

        const results = await Promise.allSettled(adminEmailPromises);
        emailsSent += results.filter(
          (r) => r.status === "fulfilled" && (r as any).value === true
        ).length;
      } catch (emailErr) {
        console.error("Failed to send admin account status emails:", emailErr);
      }

      // 2) Create system messages for admins (optional)
      if (createSystemMessage && action !== "deleted") {
        const adminMessage = await this.createAdminAccountStatusChangeMessage({
          action,
          targetUser,
          actor,
        });
        if (adminMessage) messagesCreated++;
      }

      return { emailsSent, messagesCreated, success: true };
    } catch (err) {
      console.error("Error in sendAccountStatusChangeAdminNotifications:", err);
      return { emailsSent: 0, messagesCreated: 0, success: false };
    }
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
      avatar?: string; // Add avatar field
      gender?: string; // Add gender field
    };
    reason?: string;
    isPromotion: boolean;
  }): Promise<{
    emailsSent: number;
    messagesCreated: number;
    success: boolean;
  }> {
    try {
      let emailsSent = 0;
      let messagesCreated = 0;

      const { userData, changedBy, reason, isPromotion } = changeData;

      // Step 1: Send emails (existing functionality) with timeout protection

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
        } catch (error: any) {
          console.error(
            `❌ Failed to send demotion emails to admins: ${
              error?.message || error
            }`
          );
        }
      }

      // Step 2: Create unified system messages (NEW FUNCTIONALITY)

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
      }

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
        ? `🎉 Your System Authorization Level Promoted`
        : `📋 Your System Authorization Level Updated`;

      const messageContent = isPromotion
        ? `Congratulations! Your role has been updated from ${
            userData.oldRole
          } to ${userData.newRole} by ${formatActorDisplay(
            changedBy
          )}. This change grants you additional system permissions and capabilities. Welcome to your new responsibilities!`
        : `Your role has been updated from ${userData.oldRole} to ${
            userData.newRole
          } by ${formatActorDisplay(
            changedBy
          )}. This change affects your system permissions and access levels.${
            reason ? `\nContext: ${reason}` : ""
          }`;

      // ✅ MIGRATED: Using standardized UnifiedMessageController pattern
      // ⚠️ DEPRECATED: Message.createForAllUsers pattern
      // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1
      // 📋 REFACTORING: Replaced deprecated Message.createForAllUsers with standard trio pattern
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1
      const message =
        await UnifiedMessageController.createTargetedSystemMessage(
          {
            title: messageTitle,
            content: messageContent,
            type: "auth_level_change",
            priority: "high",
            hideCreator: false,
          },
          [userId], // Only send to the specific user
          {
            id: changedBy._id || "system",
            firstName: changedBy.firstName,
            lastName: changedBy.lastName,
            username: changedBy.email.split("@")[0],
            avatar: changedBy.avatar, // Use actual avatar from changedBy user
            gender: changedBy.gender || "male", // Use actual gender or default to male
            roleInAtCloud: changedBy.role,
            authLevel: changedBy.role,
          }
        );

      // ✅ REMOVED: Manual WebSocket emissions - now handled by UnifiedMessageController
      // The standard pattern automatically handles:
      // - System message creation
      // - WebSocket emissions (system_message_update)
      // - Bell notification creation via frontend
      // - Unread count updates
      // This eliminates code duplication and ensures consistency

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
      const messageTitle = `User System Authorization Level Change: ${userData.firstName} ${userData.lastName}`;

      const messageContent = `${userData.firstName} ${userData.lastName} (${
        userData.email
      }) has been ${actionType} from ${userData.oldRole} to ${
        userData.newRole
      } by ${changedBy.firstName} ${
        changedBy.lastName
      }.\nDate: ${new Date().toLocaleString()}${
        reason ? `\nReason: ${reason}` : ""
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
        return null;
        // ⚠️ DEPRECATED: Message.createForAllUsers pattern
        // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage
        // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1
      }

      // ✅ MIGRATED: Using standardized UnifiedMessageController pattern
      // 📋 REFACTORING: Replaced deprecated Message.createForAllUsers with standard trio pattern
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1

      // Create message for all admin users using standard pattern
      const message =
        await UnifiedMessageController.createTargetedSystemMessage(
          {
            title: messageTitle,
            content: messageContent,
            type: "auth_level_change", // ✅ Valid enum value for role/auth changes
            priority: "medium",
            hideCreator: true,
          },
          adminUserIds,
          {
            id: changedBy._id || "system",
            firstName: changedBy.firstName,
            lastName: changedBy.lastName,
            username: changedBy.email.split("@")[0],
            avatar: changedBy.avatar,
            gender: changedBy.gender || "male", // Required field - using actual gender or default
            roleInAtCloud: changedBy.role,
            authLevel: changedBy.role,
          }
        );

      // ✅ REMOVED: Manual WebSocket emissions - now handled by UnifiedMessageController
      // The standard pattern automatically handles:
      // - System message creation for all admin users
      // - WebSocket emissions (system_message_update) to each admin
      // - Bell notification creation via frontend
      // - Unread count updates for each admin
      // This eliminates code duplication and ensures consistency

      return message;
    } catch (error) {
      console.error("Error creating admin role change message:", error);
      return null;
    }
  }

  /**
   * Send @Cloud role change notification with unified messaging
   * Handles new signups, role assignments, and role removals
   * NOTE: Only admins receive notifications, NOT the user themselves (by design)
   */
  static async sendAtCloudRoleChangeNotification(changeData: {
    userData: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      roleInAtCloud?: string;
      previousRoleInAtCloud?: string;
    };
    changeType: "signup" | "assigned" | "removed";
    systemUser: {
      _id?: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      avatar?: string;
      gender?: string;
    };
  }): Promise<{
    emailsSent: number;
    messagesCreated: number;
    success: boolean;
  }> {
    try {
      let emailsSent = 0;
      let messagesCreated = 0;

      const { userData, changeType, systemUser } = changeData;

      // Step 1: Send emails to admins only (users don't get @Cloud role notifications)
      try {
        const adminRecipients = await EmailRecipientUtils.getAdminUsers();

        const adminEmailPromises = adminRecipients.map(async (admin) => {
          try {
            let emailSuccess = false;

            // Choose appropriate email method based on change type
            if (changeType === "signup") {
              emailSuccess =
                await EmailService.sendNewAtCloudLeaderSignupToAdmins(
                  admin.email,
                  `${admin.firstName} ${admin.lastName}`.trim(),
                  {
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    email: userData.email,
                    roleInAtCloud: userData.roleInAtCloud || "",
                  }
                );
            } else if (changeType === "assigned") {
              emailSuccess = await EmailService.sendAtCloudRoleAssignedToAdmins(
                admin.email,
                `${admin.firstName} ${admin.lastName}`.trim(),
                {
                  firstName: userData.firstName,
                  lastName: userData.lastName,
                  email: userData.email,
                  roleInAtCloud: userData.roleInAtCloud || "",
                }
              );
            } else if (changeType === "removed") {
              emailSuccess = await EmailService.sendAtCloudRoleRemovedToAdmins(
                admin.email,
                `${admin.firstName} ${admin.lastName}`.trim(),
                {
                  firstName: userData.firstName,
                  lastName: userData.lastName,
                  email: userData.email,
                  previousRoleInAtCloud:
                    (userData as any).previousRoleInAtCloud || "",
                }
              );
            }
            return emailSuccess;
          } catch (e) {
            // Log string or error content in first arg so tests capturing first parameter see raw message
            console.error(
              `Failed sending individual @Cloud role email: ${
                e instanceof Error ? e.message : String(e)
              }`
            );
            return false;
          }
        });

        const adminEmailResults = await Promise.allSettled(adminEmailPromises);
        const successfulAdminEmails = adminEmailResults.filter(
          (result) => result.status === "fulfilled" && result.value === true
        ).length;
        emailsSent += successfulAdminEmails;
      } catch (error: any) {
        console.error(
          `❌ Failed to send @Cloud role emails to admins: ${
            error?.message || error
          }`
        );
      }

      // Step 2: Create unified system messages for admins only
      const adminMessage = await this.createAtCloudRoleChangeAdminMessage({
        userData,
        changeType,
        systemUser,
      });
      if (adminMessage) {
        messagesCreated++;
      }

      return {
        emailsSent,
        messagesCreated,
        success: true,
      };
    } catch (error) {
      console.error("Error in sendAtCloudRoleChangeNotification:", error);
      return {
        emailsSent: 0,
        messagesCreated: 0,
        success: false,
      };
    }
  }

  /**
   * Create admin system message for @Cloud role changes
   * Bell notifications are automatically emitted
   */
  private static async createAtCloudRoleChangeAdminMessage({
    userData,
    changeType,
    systemUser,
  }: {
    userData: any;
    changeType: "signup" | "assigned" | "removed";
    systemUser: any;
  }): Promise<any> {
    try {
      // Generate appropriate message based on change type
      let messageTitle = "";
      let messageContent = "";

      if (changeType === "signup") {
        messageTitle = `🎉 New @Cloud Co-worker Signup: ${userData.firstName} ${userData.lastName}`;
        messageContent = `${userData.firstName} ${userData.lastName} (${
          userData.email
        }) has signed up as an @Cloud Co-worker with the role: ${
          userData.roleInAtCloud
        }.\nDate: ${new Date().toLocaleString()}`;
      } else if (changeType === "assigned") {
        messageTitle = `✅ @Cloud Co-worker Role Invited: ${userData.firstName} ${userData.lastName}`;
        messageContent = `${userData.firstName} ${userData.lastName} (${
          userData.email
        }) has been invited to the @Cloud role: ${
          userData.roleInAtCloud
        }.\nDate: ${new Date().toLocaleString()}`;
      } else if (changeType === "removed") {
        messageTitle = `⚠️ @Cloud Co-worker Role Removed: ${userData.firstName} ${userData.lastName}`;
        messageContent = `${userData.firstName} ${userData.lastName} (${
          userData.email
        }) has removed his or her @Cloud co-worker role. 
          Previous role: ${
            userData.previousRoleInAtCloud
          }.\nDate: ${new Date().toLocaleString()}`;
      }

      // Get admin recipients
      const adminRecipients = await EmailRecipientUtils.getAdminUsers();
      const adminEmails = adminRecipients.map((admin) => admin.email);

      // Find actual admin users with IDs
      const User = (await import("../../models/User")).default;
      const adminUsers = await User.find({
        email: { $in: adminEmails },
        isActive: true,
      }).select("_id email firstName lastName");

      const adminUserIds = adminUsers.map(
        (admin) => (admin as any)._id.toString()
        // ⚠️ DEPRECATED: Message.createForAllUsers pattern
        // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage
        // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1
      );
      if (adminUserIds.length === 0) {
        return null;
      }

      // ✅ MIGRATED: Using standardized UnifiedMessageController pattern
      // 📋 REFACTORING: Replaced deprecated Message.createForAllUsers with standard trio pattern
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1

      // Create message for all admin users using standard pattern
      const message =
        await UnifiedMessageController.createTargetedSystemMessage(
          {
            title: messageTitle,
            content: messageContent,
            type: "atcloud_role_change", // ✅ Dedicated type for @Cloud ministry role changes
            priority: "medium",
            // Updated policy: Always hide sender for admin-facing @Cloud role notices
            hideCreator: true,
          },
          adminUserIds,
          {
            id: systemUser._id || "system",
            firstName: systemUser.firstName,
            lastName: systemUser.lastName,
            username: systemUser.email.split("@")[0],
            avatar: systemUser.avatar,
            gender: systemUser.gender || "male",
            roleInAtCloud: systemUser.role,
            authLevel: systemUser.role,
          }
        );

      // ✅ REMOVED: Manual WebSocket emissions - now handled by UnifiedMessageController
      // The standard pattern automatically handles:
      // - System message creation for all admin users
      // - WebSocket emissions (system_message_update) to each admin
      // - Bell notification creation via frontend
      // - Unread count updates for each admin
      // This eliminates code duplication and ensures consistency

      return message;
    } catch (error) {
      console.error("Error creating @Cloud role change admin message:", error);
      return null;
    }
  }

  /**
   * Create system message to admins for account status changes (deactivated/reactivated)
   */
  private static async createAdminAccountStatusChangeMessage({
    action,
    targetUser,
    actor,
  }: {
    action: "deactivated" | "reactivated";
    targetUser: {
      _id: string;
      firstName?: string;
      lastName?: string;
      email: string;
    };
    actor: {
      _id?: string;
      firstName?: string;
      lastName?: string;
      email: string;
      role: string;
      avatar?: string;
      gender?: string;
    };
  }): Promise<any> {
    try {
      const verb = action === "deactivated" ? "Deactivated" : "Reactivated";
      const messageTitle = `User ${verb}: ${
        [targetUser.firstName, targetUser.lastName].filter(Boolean).join(" ") ||
        targetUser.email
      }`;

      const messageContent = `${
        [targetUser.firstName, targetUser.lastName].filter(Boolean).join(" ") ||
        targetUser.email
      } (${targetUser.email}) was ${action} by ${formatActorDisplay(
        actor
      )}.\nDate: ${new Date().toLocaleString()}`;

      // Resolve admin user IDs
      const adminRecipients = await EmailRecipientUtils.getAdminUsers();
      const adminEmails = adminRecipients.map((a) => a.email);
      const User = (await import("../../models/User")).default;
      const adminUsers = await User.find({
        email: { $in: adminEmails },
        isActive: true,
      }).select("_id email firstName lastName");
      const adminUserIds = adminUsers.map((u) => (u as any)._id.toString());
      if (adminUserIds.length === 0) return null;

      return await UnifiedMessageController.createTargetedSystemMessage(
        {
          title: messageTitle,
          content: messageContent,
          type: "user_management",
          priority: "high",
          hideCreator: true,
        },
        adminUserIds,
        {
          id: actor._id || "system",
          firstName: actor.firstName || "",
          lastName: actor.lastName || "",
          username: actor.email.split("@")[0],
          avatar: actor.avatar,
          gender: actor.gender || "male",
          roleInAtCloud: actor.role,
          authLevel: actor.role,
        }
      );
    } catch (error) {
      console.error(
        "Error creating admin account status change message:",
        error
      );
      return null;
    }
  }
}
