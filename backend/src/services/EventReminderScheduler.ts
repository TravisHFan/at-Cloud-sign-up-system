/**
 * Event Reminder Scheduler Service
 *
 * This service automatically checks for events that need 24-hour reminders
 * and triggers the existing event reminder trio for registered participants.
 *
 * Addresses the bug: "The trio for users who registered role for a event,
 * is not working. The trio should be triggered when 24 hours remained for
 * the event's start time."
 */

import mongoose from "mongoose";

class EventReminderScheduler {
  private static instance: EventReminderScheduler;
  private isRunning: boolean = false;
  private apiBaseUrl: string;
  private intervals: NodeJS.Timeout[] = [];

  constructor() {
    // Use the same base URL as the application
    this.apiBaseUrl =
      process.env.NODE_ENV === "production"
        ? process.env.API_BASE_URL || "https://api.atcloud.org"
        : "http://localhost:5001/api/v1";
  }

  public static getInstance(): EventReminderScheduler {
    if (!EventReminderScheduler.instance) {
      EventReminderScheduler.instance = new EventReminderScheduler();
    }
    return EventReminderScheduler.instance;
  }

  /**
   * Start the automated scheduler
   */
  public start(): void {
    if (this.isRunning) {
      console.log("⚠️ Event reminder scheduler is already running");
      return;
    }

    // Run every hour to check for 24-hour reminders (3600000 ms = 1 hour)
    const hourlyInterval = setInterval(async () => {
      console.log("🔍 Checking for events needing 24-hour reminders...");
      await this.processEventReminders("24h");
    }, 3600000);

    // Run every 15 minutes to check for 1-hour reminders (900000 ms = 15 minutes)
    const quarterHourInterval = setInterval(async () => {
      console.log("🔍 Checking for events needing 1-hour reminders...");
      await this.processEventReminders("1h");
    }, 900000);

    this.intervals.push(hourlyInterval, quarterHourInterval);
    this.isRunning = true;

    console.log("✅ Event reminder scheduler started");
    console.log("   📅 24-hour reminders: Every hour");
    console.log("   ⏰ 1-hour reminders: Every 15 minutes");
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log("⚠️ Event reminder scheduler is not running");
      return;
    }

    // Clear all intervals
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];
    this.isRunning = false;
    console.log("🛑 Event reminder scheduler stopped");
  }

  /**
   * Process events that need reminders
   */
  private async processEventReminders(
    reminderType: "1h" | "24h"
  ): Promise<void> {
    try {
      const eventsNeedingReminders = await this.getEventsNeedingReminders(
        reminderType
      );

      if (eventsNeedingReminders.length === 0) {
        console.log(`ℹ️ No events need ${reminderType} reminders at this time`);
        return;
      }

      console.log(
        `📧 Found ${eventsNeedingReminders.length} events needing ${reminderType} reminders`
      );

      // Send reminders for each event
      for (const event of eventsNeedingReminders) {
        await this.sendEventReminderTrio(event, reminderType);
        await this.markReminderSent(event._id, reminderType);
      }
    } catch (error) {
      console.error(
        `❌ Error processing ${reminderType} event reminders:`,
        error
      );
    }
  }

  /**
   * Get events that need reminders based on timing
   */
  private async getEventsNeedingReminders(
    reminderType: "1h" | "24h"
  ): Promise<any[]> {
    try {
      const now = new Date();
      let targetStart: Date;
      let targetEnd: Date;

      if (reminderType === "24h") {
        // Looking for events 24 hours from now (±30 minutes window)
        targetStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000); // 23.5 hours
        targetEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000); // 24.5 hours
      } else {
        // Looking for events 1 hour from now (±15 minutes window)
        targetStart = new Date(now.getTime() + 45 * 60 * 1000); // 45 minutes
        targetEnd = new Date(now.getTime() + 75 * 60 * 1000); // 75 minutes
      }

      // Get the Event model
      const EventModel = mongoose.model("Event");

      // Find events in the target time window that haven't had this reminder sent
      const events = await EventModel.find({
        // Convert date and time to comparable format
        $expr: {
          $and: [
            {
              $gte: [
                {
                  $dateFromString: {
                    dateString: {
                      $concat: ["$date", "T", "$time", ":00.000Z"],
                    },
                  },
                },
                targetStart,
              ],
            },
            {
              $lte: [
                {
                  $dateFromString: {
                    dateString: {
                      $concat: ["$date", "T", "$time", ":00.000Z"],
                    },
                  },
                },
                targetEnd,
              ],
            },
          ],
        },
        // Only events that haven't had this reminder sent yet
        [`${reminderType}ReminderSent`]: { $ne: true },
      });

      return events;
    } catch (error) {
      console.error("Error querying events for reminders:", error);
      return [];
    }
  }

  /**
   * Send the event reminder trio by calling the existing API
   */
  private async sendEventReminderTrio(
    event: any,
    reminderType: "1h" | "24h"
  ): Promise<void> {
    try {
      console.log(`📤 Sending ${reminderType} reminder for: ${event.title}`);

      // Prepare the reminder request using the existing API
      const reminderData = {
        eventId: event._id.toString(),
        eventData: {
          title: event.title,
          date: event.date,
          time: event.time,
          location: event.location,
          zoomLink: event.zoomLink,
          format: event.format || "in-person",
        },
        reminderType: reminderType,
      };

      // Call the existing event reminder trio API
      const response = await fetch(
        `${this.apiBaseUrl}/notifications/event-reminder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reminderData),
        }
      );

      if (response.ok) {
        const result = (await response.json()) as { message: string };
        console.log(
          `✅ Event reminder trio sent successfully: ${result.message}`
        );
      } else {
        const error = await response.text();
        console.error(
          `❌ Failed to send event reminder trio: ${response.status} ${error}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Error sending event reminder trio for ${event.title}:`,
        error
      );
    }
  }

  /**
   * Mark that a reminder has been sent for this event
   */
  private async markReminderSent(
    eventId: string,
    reminderType: "1h" | "24h"
  ): Promise<void> {
    try {
      const EventModel = mongoose.model("Event");

      await EventModel.findByIdAndUpdate(eventId, {
        [`${reminderType}ReminderSent`]: true,
        [`${reminderType}ReminderSentAt`]: new Date(),
      });

      console.log(
        `📝 Marked ${reminderType} reminder as sent for event ${eventId}`
      );
    } catch (error) {
      console.error(
        `❌ Error marking reminder sent for event ${eventId}:`,
        error
      );
    }
  }

  /**
   * Get status of the scheduler
   */
  public getStatus(): { isRunning: boolean; uptime?: number } {
    return {
      isRunning: this.isRunning,
    };
  }

  /**
   * Manually trigger reminders for testing
   */
  public async triggerManualCheck(
    reminderType: "1h" | "24h" = "24h"
  ): Promise<void> {
    console.log(`🔧 Manual trigger: Checking for ${reminderType} reminders...`);
    await this.processEventReminders(reminderType);
  }
}

export default EventReminderScheduler;
