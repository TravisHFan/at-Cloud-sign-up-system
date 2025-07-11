// System Message Integration Service
// This service handles sending system messages for various scenarios

import { getUserById } from "../data/mockUserData";

interface SystemMessageContext {
  addSystemMessage: (message: any) => void;
}

interface EventData {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  organizerName?: string;
  organizerId?: string;
}

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleInAtCloud?: string;
  gender?: "male" | "female";
  avatar?: string;
}

class SystemMessageIntegrationService {
  private notificationContext: SystemMessageContext | null = null;

  // Set the notification context for creating system messages
  setNotificationContext(notificationContext: SystemMessageContext) {
    this.notificationContext = notificationContext;
  }

  // Helper function to create system message creator from user data
  private createMessageCreator(userId: string, customRole?: string) {
    const user = getUserById(userId);
    if (!user) {
      console.warn(`User with ID ${userId} not found`);
      return undefined;
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      avatar: user.avatar || undefined,
      gender: user.gender,
      roleInAtCloud: customRole || user.roleInAtCloud || `${user.role} User`,
    };
  }

  // Helper function to get Super Admin and Administrator user IDs
  // private getSuperAdminAndAdminIds(): string[] {
  //   const users = getCentralizedUsers();
  //   return users
  //     .filter(user => user.role === "Super Admin" || user.role === "Administrator")
  //     .map(user => user.id);
  // }

  // 1. New Event Created - send to all users, message from organizer
  sendEventCreatedSystemMessage(eventData: EventData, organizerId: string) {
    if (!this.notificationContext?.addSystemMessage) {
      console.warn("Notification context not available for system messages");
      return;
    }

    const organizerCreator = this.createMessageCreator(organizerId);
    if (!organizerCreator) {
      console.warn("Could not find organizer data for event system message");
      return;
    }

    try {
      this.notificationContext.addSystemMessage({
        title: `New Event: ${eventData.title}`,
        content: `A new event "${eventData.title}" has been created for ${eventData.date} from ${eventData.time} - ${eventData.endTime}. Location: ${eventData.location}. Join us for this exciting event!`,
        type: "announcement",
        priority: "medium",
        isRead: false,
        creator: organizerCreator,
      });

      console.log(`Event creation system message sent for: ${eventData.title}`);
    } catch (error) {
      console.error("Error sending event creation system message:", error);
    }
  }

  // 2. Co-Organizer Assignment - send to co-organizers, message from organizer
  sendCoOrganizerAssignmentSystemMessage(
    eventData: EventData,
    organizerId: string
  ) {
    if (!this.notificationContext?.addSystemMessage) {
      console.warn("Notification context not available for system messages");
      return;
    }

    const organizerCreator = this.createMessageCreator(organizerId);
    if (!organizerCreator) {
      console.warn(
        "Could not find organizer data for co-organizer assignment message"
      );
      return;
    }

    try {
      // In a real application, you would send targeted messages to specific users
      // For now, we'll create a general message that co-organizers can see
      this.notificationContext.addSystemMessage({
        title: `Co-Organizer Assignment: ${eventData.title}`,
        content: `You have been assigned as a co-organizer for "${eventData.title}" scheduled for ${eventData.date} from ${eventData.time} - ${eventData.endTime} at ${eventData.location}. Thank you for helping to make this event successful!`,
        type: "announcement",
        priority: "high",
        isRead: false,
        creator: organizerCreator,
        // In a real system, you'd add targetUserIds: coOrganizerIds
      });

      console.log(
        `Co-organizer assignment system message sent for: ${eventData.title}`
      );
    } catch (error) {
      console.error(
        "Error sending co-organizer assignment system message:",
        error
      );
    }
  }

  // 3. Auth Level Change - send to user, message from actor
  sendAuthLevelChangeSystemMessage(
    targetUserId: string,
    targetUserName: string,
    fromAuthLevel: string,
    toAuthLevel: string,
    actorId: string
  ) {
    if (!this.notificationContext?.addSystemMessage) {
      console.warn("Notification context not available for system messages");
      return;
    }

    const actorCreator = this.createMessageCreator(actorId);
    if (!actorCreator) {
      console.warn("Could not find actor data for auth level change message");
      return;
    }

    const isPromotion =
      ["Super Admin", "Administrator", "Leader"].indexOf(toAuthLevel) >
      ["Super Admin", "Administrator", "Leader"].indexOf(fromAuthLevel);

    const actionWord = isPromotion ? "promoted" : "updated";
    const emoji = isPromotion ? "🎯" : "🔄";

    try {
      this.notificationContext.addSystemMessage({
        title: `${emoji} System Auth Level ${
          isPromotion ? "Promotion" : "Update"
        }: ${targetUserName}`,
        content: isPromotion
          ? `Congratulations! Your system authorization level has been ${actionWord} from ${fromAuthLevel} to ${toAuthLevel}. You now have access to expanded platform features and new responsibilities. Welcome to the enhanced authorization level!`
          : `Your system authorization level has been ${actionWord} from ${fromAuthLevel} to ${toAuthLevel}. Your access permissions and available features have been adjusted accordingly.`,
        type: "auth_level_change",
        priority: isPromotion ? "medium" : "low",
        isRead: false,
        targetUserId: targetUserId,
        creator: actorCreator,
      });

      console.log(
        `Auth level change system message sent to: ${targetUserName}`
      );
    } catch (error) {
      console.error("Error sending auth level change system message:", error);
    }
  }

  // 4. Event Reminders - send to participants, message from organizer
  sendEventReminderSystemMessage(eventData: EventData, organizerId: string) {
    if (!this.notificationContext?.addSystemMessage) {
      console.warn("Notification context not available for system messages");
      return;
    }

    const organizerCreator = this.createMessageCreator(organizerId);
    if (!organizerCreator) {
      console.warn("Could not find organizer data for event reminder message");
      return;
    }

    try {
      this.notificationContext.addSystemMessage({
        title: `Event Reminder: ${eventData.title}`,
        content: `This is a friendly reminder that "${eventData.title}" is scheduled for tomorrow (${eventData.date}) from ${eventData.time} - ${eventData.endTime} at ${eventData.location}. Don't forget to attend! We're looking forward to seeing you there.`,
        type: "announcement",
        priority: "high",
        isRead: false,
        creator: organizerCreator,
      });

      console.log(`Event reminder system message sent for: ${eventData.title}`);
    } catch (error) {
      console.error("Error sending event reminder system message:", error);
    }
  }

  // 5. Password Reset - send to user only, no creator (system message)
  sendPasswordResetSystemMessage(targetUserId: string, userFirstName: string) {
    if (!this.notificationContext?.addSystemMessage) {
      console.warn("Notification context not available for system messages");
      return;
    }

    try {
      this.notificationContext.addSystemMessage({
        title: "Password Reset Request",
        content: `Hello ${userFirstName}, a password reset request has been initiated for your account. If you did not request this, please contact our support team immediately. For security reasons, the reset link will expire in 1 hour.`,
        type: "warning",
        priority: "high",
        isRead: false,
        targetUserId: targetUserId,
        // No creator - this is a system-generated message
      });

      console.log(
        `Password reset system message sent to user: ${userFirstName}`
      );
    } catch (error) {
      console.error("Error sending password reset system message:", error);
    }
  }

  // 6. Security Warning Messages - send to user, no creator (system message)
  sendSecurityWarningSystemMessage(
    targetUserId: string,
    userFirstName: string,
    alertTitle: string,
    alertContent: string,
    priority: "high" | "medium" | "low" = "high"
  ) {
    if (!this.notificationContext?.addSystemMessage) {
      console.warn("Notification context not available for system messages");
      return;
    }

    try {
      this.notificationContext.addSystemMessage({
        title: alertTitle,
        content: alertContent,
        type: "warning",
        priority: priority,
        isRead: false,
        targetUserId: targetUserId,
        // No creator - this is a system-generated security message
      });

      console.log(
        `Security warning system message sent to user: ${userFirstName}`
      );
    } catch (error) {
      console.error("Error sending security warning system message:", error);
    }
  }

  // 7. New Leader Signup Notification - send to Super Admin and Administrators, message from new leader
  sendNewLeaderSignupSystemMessage(newLeaderData: UserData) {
    if (!this.notificationContext?.addSystemMessage) {
      console.warn("Notification context not available for system messages");
      return;
    }

    const leaderCreator = this.createMessageCreator(newLeaderData.id);
    if (!leaderCreator) {
      console.warn(
        "Could not find new leader data for signup notification message"
      );
      return;
    }

    try {
      // In a real system, this would be sent only to Super Admin and Administrator roles
      this.notificationContext.addSystemMessage({
        title: `New @Cloud Leader Registration: ${newLeaderData.firstName} ${newLeaderData.lastName}`,
        content: `A new user has registered as an @Cloud Leader. Name: ${
          newLeaderData.firstName
        } ${newLeaderData.lastName}, Email: ${newLeaderData.email}${
          newLeaderData.roleInAtCloud
            ? `, Role: ${newLeaderData.roleInAtCloud}`
            : ""
        }. Please review their application and approve their leader status if appropriate.`,
        type: "announcement",
        priority: "medium",
        isRead: false,
        creator: leaderCreator,
        // In a real system, you'd add targetUserIds: this.getSuperAdminAndAdminIds()
      });

      console.log(
        `New leader signup system message sent for: ${newLeaderData.firstName} ${newLeaderData.lastName}`
      );
    } catch (error) {
      console.error("Error sending new leader signup system message:", error);
    }
  }

  // 8. Leader Status Change Notification - send to Super Admin and Administrators, message from leader
  sendLeaderStatusChangeSystemMessage(leaderData: UserData) {
    if (!this.notificationContext?.addSystemMessage) {
      console.warn("Notification context not available for system messages");
      return;
    }

    const leaderCreator = this.createMessageCreator(leaderData.id);
    if (!leaderCreator) {
      console.warn(
        "Could not find leader data for status change notification message"
      );
      return;
    }

    try {
      // In a real system, this would be sent only to Super Admin and Administrator roles
      this.notificationContext.addSystemMessage({
        title: `Leader Status Update: ${leaderData.firstName} ${leaderData.lastName}`,
        content: `${leaderData.firstName} ${
          leaderData.lastName
        } has updated their leader status to "Yes" and is now available for leadership responsibilities. Email: ${
          leaderData.email
        }${
          leaderData.roleInAtCloud ? `, Role: ${leaderData.roleInAtCloud}` : ""
        }. They are ready to take on leadership roles in upcoming events.`,
        type: "announcement",
        priority: "medium",
        isRead: false,
        creator: leaderCreator,
        // In a real system, you'd add targetUserIds: this.getSuperAdminAndAdminIds()
      });

      console.log(
        `Leader status change system message sent for: ${leaderData.firstName} ${leaderData.lastName}`
      );
    } catch (error) {
      console.error(
        "Error sending leader status change system message:",
        error
      );
    }
  }
}

// Export singleton instance
export const systemMessageIntegration = new SystemMessageIntegrationService();

export default SystemMessageIntegrationService;
