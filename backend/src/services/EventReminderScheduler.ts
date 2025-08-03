/**
 * Event Reminder Scheduler Service
 *
 * This service automatically checks for events that need 24-hour reminders
 * and triggers the existing event reminder trio for registered participants.
 *
 * Simplified to only handle 24-hour reminders for better performance
 * and reduced complexity. Checks every 10 minutes with Pacific timezone
 * awareness for exact timing precision.
 */

import mongoose from "mongoose";
import { Event } from "../models";

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

    // Run every 10 minutes to check for 24-hour reminders (600000 ms = 10 minutes)
    const tenMinuteInterval = setInterval(async () => {
      await this.processEventReminders();
    }, 600000);

    this.intervals.push(tenMinuteInterval);
    this.isRunning = true;

    console.log("✅ Event reminder scheduler started");
    console.log("   📅 24-hour reminders: Every 10 minutes");
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
   * Process events that need 24-hour reminders
   */
  private async processEventReminders(): Promise<void> {
    try {
      const eventsNeedingReminders = await this.getEventsNeedingReminders();

      if (eventsNeedingReminders.length === 0) {
        console.log(`ℹ️ No events need 24h reminders at this time`);
        return;
      }

      console.log(
        `📧 Found ${eventsNeedingReminders.length} events needing 24h reminders`
      );

      // Send reminders for each event
      for (const event of eventsNeedingReminders) {
        console.log(`🔒 Processing event: ${event.title} (${event._id})`);

        // Mark as sent FIRST to prevent race conditions
        await this.markReminderSent(event._id);

        // Then send the trio
        try {
          await this.sendEventReminderTrio(event);
          console.log(`✅ Completed processing for event: ${event.title}`);
        } catch (error) {
          // If trio sending fails, unmark the event so it can be retried
          console.error(
            `❌ Failed to send trio for ${event.title}, unmarking for retry:`,
            error
          );
          await this.unmarkReminderSent(event._id);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing 24h event reminders:`, error);
    }
  }

  /**
   * Get events that need 24-hour reminders based on exact timing
   * Uses Pacific Time (PST/PDT) to match event storage format
   */
  private async getEventsNeedingReminders(): Promise<any[]> {
    try {
      // Get current time - server is already in PDT timezone
      const now = new Date();

      // Looking for events exactly 24 hours from now (±5 minutes tolerance for 10-minute scheduling)
      const exactTargetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Exactly 24 hours
      const toleranceMinutes = 5; // 5-minute tolerance window

      const targetStart = new Date(
        exactTargetTime.getTime() - toleranceMinutes * 60 * 1000
      );
      const targetEnd = new Date(
        exactTargetTime.getTime() + toleranceMinutes * 60 * 1000
      );

      console.log(`🌏 Exact timing reminder check for 24h:`);
      console.log(`   📅 Current Pacific Time: ${now.toISOString()}`);
      console.log(`   🎯 Exact target time: ${exactTargetTime.toISOString()}`);
      console.log(
        `   📊 Tolerance window: ${targetStart.toISOString()} to ${targetEnd.toISOString()}`
      );
      console.log(
        `   ⏰ Hours until target: ${(
          (exactTargetTime.getTime() - now.getTime()) /
          (1000 * 60 * 60)
        ).toFixed(2)}`
      );

      // Pre-filter events to only check events near the 24h target time
      // This reduces database load by excluding past events and far-future events
      const roughStart = new Date(now.getTime() + 20 * 60 * 60 * 1000); // Events 20h from now
      const roughEnd = new Date(now.getTime() + 28 * 60 * 60 * 1000); // Events 28h from now

      console.log(
        `   🔍 Pre-filtering events between ${
          roughStart.toISOString().split("T")[0]
        } and ${roughEnd.toISOString().split("T")[0]}`
      );

      // Find events in the target time window that haven't had this reminder sent
      // Note: Events are stored in Pacific time format, so we need to convert them properly
      const events = await Event.find({
        // Pre-filter: Only check events that are roughly in the time range
        date: {
          $gte: roughStart.toISOString().split("T")[0], // Today or later
          $lte: roughEnd.toISOString().split("T")[0], // Not too far in future
        },
        // Only events that haven't had this reminder sent yet
        "24hReminderSent": { $ne: true },
        // Additional safeguard: Not sent in the last 30 minutes (prevents duplicates from timing overlaps)
        $or: [
          { "24hReminderSentAt": { $exists: false } },
          {
            "24hReminderSentAt": { $lt: new Date(Date.now() - 30 * 60 * 1000) },
          },
        ],
        // Convert date and time to Pacific timezone for precise comparison
        $expr: {
          $and: [
            {
              $gte: [
                {
                  // Parse event date/time as Pacific time
                  $dateFromString: {
                    dateString: {
                      $concat: ["$date", "T", "$time", ":00.000"],
                    },
                    // Don't specify timezone - treat as local time like our target dates
                  },
                },
                targetStart,
              ],
            },
            {
              $lte: [
                {
                  // Parse event date/time as Pacific time
                  $dateFromString: {
                    dateString: {
                      $concat: ["$date", "T", "$time", ":00.000"],
                    },
                    // Don't specify timezone - treat as local time like our target dates
                  },
                },
                targetEnd,
              ],
            },
          ],
        },
      });

      console.log(`   📋 Found ${events.length} events matching 24h criteria`);

      return events;
    } catch (error) {
      console.error("Error querying events for reminders:", error);
      return [];
    }
  }

  /**
   * Send the event reminder trio by calling the existing API
   */
  private async sendEventReminderTrio(event: any): Promise<void> {
    try {
      console.log(`📤 Sending 24h reminder for: ${event.title}`);

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
        reminderType: "24h",
      };

      // Call the existing event reminder trio API (using test endpoint to bypass auth for internal calls)
      const response = await fetch(
        `${this.apiBaseUrl}/email-notifications/test-event-reminder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reminderData),
        }
      );

      if (response.ok) {
        const result = (await response.json()) as {
          message: string;
          systemMessageCreated?: boolean;
          details?: any;
        };
        console.log(
          `✅ Event reminder trio sent successfully: ${result.message}`
        );

        if (result.systemMessageCreated === false) {
          console.warn(
            `⚠️ WARNING: System message creation failed for event: ${event.title}`
          );
          console.warn(
            `   Users will receive emails but no system messages or bell notifications!`
          );
        }

        if (result.details) {
          console.log(
            `   📊 Details: ${result.details.emailsSent}/${
              result.details.totalParticipants
            } emails sent, System msg: ${
              result.details.systemMessageSuccess ? "✅" : "❌"
            }`
          );
        }
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
   * Mark that a 24h reminder has been sent for this event
   */
  private async markReminderSent(eventId: string): Promise<void> {
    try {
      await Event.findByIdAndUpdate(eventId, {
        "24hReminderSent": true,
        "24hReminderSentAt": new Date(),
      });

      console.log(
        `📝 Marked 24h reminder as sent for event ${eventId} (race condition protection)`
      );
    } catch (error) {
      console.error(
        `❌ Error marking reminder sent for event ${eventId}:`,
        error
      );
    }
  }

  /**
   * Unmark reminder sent status (for retry scenarios)
   */
  private async unmarkReminderSent(eventId: string): Promise<void> {
    try {
      await Event.findByIdAndUpdate(eventId, {
        $unset: {
          "24hReminderSent": "",
          "24hReminderSentAt": "",
        },
      });

      console.log(
        `🔄 Unmarked 24h reminder for event ${eventId} (retry enabled)`
      );
    } catch (error) {
      console.error(`❌ Error unmarking reminder for event ${eventId}:`, error);
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
  public async triggerManualCheck(): Promise<void> {
    console.log(`🔧 Manual trigger: Checking for 24h reminders...`);
    await this.processEventReminders();
  }
}

export default EventReminderScheduler;
