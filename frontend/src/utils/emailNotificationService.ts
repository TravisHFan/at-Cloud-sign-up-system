// Email notification utility for events
// This will handle the frontend logic for triggering email notifications

export interface EmailNotificationPayload {
  type:
    | "event_created"
    | "co_organizer_assigned"
    | "event_reminder"
    | "password_reset";
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

      console.log("Event creation notifications sent successfully");
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

      console.log("Co-organizer assignment notification sent successfully");
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

      console.log("Event reminder notifications sent successfully");
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

      console.log("Password reset notification sent successfully");
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

      console.log("Event reminder scheduled successfully");
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
}

// Export singleton instance
export const emailNotificationService = new EmailNotificationService();

// Export types for use in other components
export default EmailNotificationService;
