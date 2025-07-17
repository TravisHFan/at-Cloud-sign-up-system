// Email notification utility for events
// This will handle the frontend logic for triggering email notifications

export interface EmailNotificationPayload {
  type:
    | "event_created"
    | "co_organizer_assigned"
    | "event_reminder"
    | "password_reset"
    | "new_leader_signup"
    | "leader_status_change"
    | "leader_status_demotion"
    | "email_verification";
  recipients: string[]; // Array of email addresses
  data: {
    eventTitle?: string;
    eventDate?: string;
    eventTime?: string;
    eventLocation?: string;
    organizerName?: string;
    coOrganizerName?: string;
    assignedBy?: string;
    eventId?: string;
    resetToken?: string;
    userFirstName?: string;
    userLastName?: string;
    userEmail?: string;
    roleInAtCloud?: string;
    previousRoleInAtCloud?: string;
    verificationToken?: string;
  };
}

export interface EmailService {
  sendEventCreatedNotification: (
    eventData: any,
    organizerId: string
  ) => Promise<void>;
  sendCoOrganizerAssignmentNotification: (
    eventData: any,
    coOrganizerEmail: string,
    assignedBy: string
  ) => Promise<void>;
  sendEventReminderNotification: (eventData: any) => Promise<void>;
  sendPasswordResetNotification: (
    email: string,
    resetToken: string,
    userFirstName: string
  ) => Promise<void>;
  sendNewLeaderSignupNotification: (userData: {
    firstName: string;
    lastName: string;
    email: string;
    roleInAtCloud: string;
  }) => Promise<void>;
  sendLeaderStatusChangeNotification: (userData: {
    firstName: string;
    lastName: string;
    email: string;
    roleInAtCloud: string;
  }) => Promise<void>;
  sendLeaderStatusDemotionNotification: (userData: {
    firstName: string;
    lastName: string;
    email: string;
    previousRoleInAtCloud?: string;
  }) => Promise<void>;
  sendEmailVerification: (
    email: string,
    firstName: string,
    verificationToken: string
  ) => Promise<void>;
}

class EmailNotificationService implements EmailService {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = "/api") {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Send notification to all users except the organizer when an event is created
   */
  async sendEventCreatedNotification(
    eventData: any,
    organizerEmail: string
  ): Promise<void> {
    try {
      const payload: EmailNotificationPayload = {
        type: "event_created",
        recipients: [], // Backend will determine all user emails except organizer
        data: {
          eventTitle: eventData.title,
          eventDate: eventData.date,
          eventTime: eventData.time,
          eventLocation: eventData.location,
          organizerName: eventData.organizerName,
          eventId: eventData.id,
        },
      };

      const response = await fetch(
        `${this.apiBaseUrl}/notifications/event-created`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify({
            ...payload,
            excludeEmail: organizerEmail, // Backend will exclude this email
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to send event creation notifications: ${response.statusText}`
        );
      }

    } catch (error) {
      console.error("Error sending event creation notifications:", error);
      throw error;
    }
  }

  /**
   * Send special notification to co-organizers assigned by the event creator
   */
  async sendCoOrganizerAssignmentNotification(
    eventData: any,
    coOrganizerEmail: string,
    assignedBy: string
  ): Promise<void> {
    try {
      const payload: EmailNotificationPayload = {
        type: "co_organizer_assigned",
        recipients: [coOrganizerEmail],
        data: {
          eventTitle: eventData.title,
          eventDate: eventData.date,
          eventTime: eventData.time,
          eventLocation: eventData.location,
          coOrganizerName: eventData.coOrganizerName,
          assignedBy: assignedBy,
          eventId: eventData.id,
        },
      };

      const response = await fetch(
        `${this.apiBaseUrl}/notifications/co-organizer-assigned`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to send co-organizer assignment notification: ${response.statusText}`
        );
      }

    } catch (error) {
      console.error(
        "Error sending co-organizer assignment notification:",
        error
      );
      throw error;
    }
  }

  /**
   * Send reminder notification to all signed-up users 1 day before the event
   * This would typically be called by a scheduled job on the backend
   */
  async sendEventReminderNotification(eventData: any): Promise<void> {
    try {
      const payload: EmailNotificationPayload = {
        type: "event_reminder",
        recipients: [], // Backend will determine signed-up users
        data: {
          eventTitle: eventData.title,
          eventDate: eventData.date,
          eventTime: eventData.time,
          eventLocation: eventData.location,
          eventId: eventData.id,
        },
      };

      const response = await fetch(
        `${this.apiBaseUrl}/notifications/event-reminder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify({
            ...payload,
            eventId: eventData.id, // Backend will find all signed-up users
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to send event reminder notifications: ${response.statusText}`
        );
      }

    } catch (error) {
      console.error("Error sending event reminder notifications:", error);
      throw error;
    }
  }

  /**
   * Send password reset notification
   */
  async sendPasswordResetNotification(
    email: string,
    resetToken: string,
    userFirstName: string
  ): Promise<void> {
    try {
      const payload: EmailNotificationPayload = {
        type: "password_reset",
        recipients: [email],
        data: {
          resetToken: resetToken,
          userFirstName: userFirstName,
        },
      };

      const response = await fetch(
        `${this.apiBaseUrl}/notifications/password-reset`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to send password reset notification: ${response.statusText}`
        );
      }

    } catch (error) {
      console.error("Error sending password reset notification:", error);
      throw error;
    }
  }

  /**
   * Get authentication token from localStorage or auth context
   * This should be replaced with your actual auth token retrieval method
   */
  private getAuthToken(): string {
    // Replace this with your actual token retrieval logic
    return localStorage.getItem("authToken") || "";
  }

  /**
   * Schedule event reminder (1 day before event)
   * This is mainly for frontend tracking - the actual scheduling should be done on backend
   */
  async scheduleEventReminder(eventData: any): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/notifications/schedule-reminder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify({
            eventId: eventData.id,
            eventDate: eventData.date,
            reminderTime: this.calculateReminderTime(eventData.date),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to schedule event reminder: ${response.statusText}`
        );
      }

    } catch (error) {
      console.error("Error scheduling event reminder:", error);
      throw error;
    }
  }

  /**
   * Calculate reminder time (1 day before event)
   */
  private calculateReminderTime(eventDate: string): string {
    const eventDateTime = new Date(eventDate);
    const reminderTime = new Date(
      eventDateTime.getTime() - 24 * 60 * 60 * 1000
    ); // 1 day before
    return reminderTime.toISOString();
  }

  /**
   * Send notification to Super Admin and Administrators when a new user signs up as @Cloud Leader
   */
  async sendNewLeaderSignupNotification(userData: {
    firstName: string;
    lastName: string;
    email: string;
    roleInAtCloud: string;
  }): Promise<void> {
    try {
      const payload: EmailNotificationPayload = {
        type: "new_leader_signup",
        recipients: [], // Backend will determine Super Admin and Administrator emails
        data: {
          userFirstName: userData.firstName,
          userLastName: userData.lastName,
          userEmail: userData.email,
          roleInAtCloud: userData.roleInAtCloud,
        },
      };

      const response = await fetch(
        `${this.apiBaseUrl}/notifications/new-leader-signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to send new leader signup notification: ${response.statusText}`
        );
      }

    } catch (error) {
      console.error("Error sending new leader signup notification:", error);
      throw error;
    }
  }

  /**
   * Send notification to Super Admin and Administrators when a user changes their leader status to Yes
   */
  async sendLeaderStatusChangeNotification(userData: {
    firstName: string;
    lastName: string;
    email: string;
    roleInAtCloud: string;
  }): Promise<void> {
    try {
      const payload: EmailNotificationPayload = {
        type: "leader_status_change",
        recipients: [], // Backend will determine Super Admin and Administrator emails
        data: {
          userFirstName: userData.firstName,
          userLastName: userData.lastName,
          userEmail: userData.email,
          roleInAtCloud: userData.roleInAtCloud,
        },
      };

      const response = await fetch(
        `${this.apiBaseUrl}/notifications/leader-status-change`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to send leader status change notification: ${response.statusText}`
        );
      }

    } catch (error) {
      console.error("Error sending leader status change notification:", error);
      throw error;
    }
  }

  /**
   * Send notification to Super Admin and Administrators when a user changes their leader status from Yes to No
   */
  async sendLeaderStatusDemotionNotification(userData: {
    firstName: string;
    lastName: string;
    email: string;
    previousRoleInAtCloud?: string;
  }): Promise<void> {
    try {
      const payload: EmailNotificationPayload = {
        type: "leader_status_demotion",
        recipients: [], // Backend will determine Super Admin and Administrator emails
        data: {
          userFirstName: userData.firstName,
          userLastName: userData.lastName,
          userEmail: userData.email,
          previousRoleInAtCloud:
            userData.previousRoleInAtCloud || "Not specified",
        },
      };

      const response = await fetch(
        `${this.apiBaseUrl}/notifications/leader-status-demotion`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to send leader status demotion notification: ${response.statusText}`
        );
      }

    } catch (error) {
      console.error(
        "Error sending leader status demotion notification:",
        error
      );
      throw error;
    }
  }

  /**
   * Send email verification to user after signup
   */
  async sendEmailVerification(
    email: string,
    firstName: string,
    verificationToken: string
  ): Promise<void> {
    try {
      const payload: EmailNotificationPayload = {
        type: "email_verification",
        recipients: [email],
        data: {
          userFirstName: firstName,
          userEmail: email,
          verificationToken: verificationToken,
        },
      };

      const response = await fetch(
        `${this.apiBaseUrl}/notifications/email-verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to send email verification: ${response.statusText}`
        );
      }

    } catch (error) {
      console.error("Error sending email verification:", error);
      throw error;
    }
  }

  /**
   * Send security alert notification to user
   */
  async sendSecurityAlert(
    email: string,
    firstName: string,
    alertData: {
      alertType: string;
      severity: string;
      title: string;
      content: string;
      timestamp: string;
      details: any;
    }
  ): Promise<void> {
    try {
      const payload: EmailNotificationPayload = {
        type: "email_verification", // Reusing existing type for security alerts
        recipients: [email],
        data: {
          userFirstName: firstName,
          userEmail: email,
          // Additional security alert data would be handled by backend
        },
      };

      const response = await fetch(
        `${this.apiBaseUrl}/notifications/security-alert`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...payload,
            alertData,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to send security alert: ${response.statusText}`
        );
      }

    } catch (error) {
      console.error("Error sending security alert email:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const emailNotificationService = new EmailNotificationService();

// Export types for use in other components
export default EmailNotificationService;
