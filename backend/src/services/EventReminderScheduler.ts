/**
 * Event Reminder Scheduler Service
 *
 * This s    this.intervals.push(tenMinuteInterval);
    this.isRunning = true;

    console.log("✅ Event reminder scheduler started");
    console.log("   📅 24-hour reminders: Every 10 minutes");matically checks for events that need      }
    } catch (error) {
      console.error("Error processing event reminders:", error);
    }
  }our reminders
 * and triggers the existing event reminder trio for registered participants.
 *
 * Simplified to only handle 24-hour reminders for better performance
 * and reduced complexity. Checks every 10 minutes with Pacific timezone
 * awareness for exact timing precision.
 */

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

    // Run an immediate check on startup for debugging
    console.log(
      "🚀 Running initial reminder check on startup (testing reset flag)..."
    );
    setTimeout(async () => {
      await this.processEventReminders();
    }, 5000); // Wait 5 seconds for server to fully start
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

        // Send the trio FIRST - let the API handle deduplication
        try {
          await this.sendEventReminderTrio(event);
          console.log(`✅ Completed processing for event: ${event.title}`);
        } catch (error) {
          console.error(`❌ Failed to send trio for ${event.title}:`, error);
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

      console.log(`🌏 Checking for events needing 24h reminders:`);
      console.log(`   📅 Current time (PDT): ${now.toString()}`);

      // Get all events that haven't had their 24h reminder sent yet
      const candidateEvents = await Event.find({
        "24hReminderSent": { $ne: true },
        // Additional safeguard: Not sent in the last 30 minutes (prevents duplicates from timing overlaps)
        $or: [
          { "24hReminderSentAt": { $exists: false } },
          {
            "24hReminderSentAt": { $lt: new Date(Date.now() - 30 * 60 * 1000) },
          },
        ],
      });

      console.log(
        `   📋 Found ${candidateEvents.length} events without 24h reminders`
      );

      // Filter: Find events where current_time >= event_time - 24h
      const events = candidateEvents.filter((event) => {
        const eventDateTimeString = event.date + "T" + event.time + ":00.000";
        const eventDateTime = new Date(eventDateTimeString);
        const reminderTriggerTime = new Date(
          eventDateTime.getTime() - 24 * 60 * 60 * 1000
        );

        // Should trigger now? (current time >= 24h before event)
        const shouldTrigger = now >= reminderTriggerTime;

        // Event still in future? (don't send reminders for past events)
        const eventIsInFuture = eventDateTime > now;

        if (shouldTrigger && eventIsInFuture) {
          console.log(
            `   ✅ ${
              event.title
            } needs reminder (trigger time: ${reminderTriggerTime.toString()})`
          );
        }

        return shouldTrigger && eventIsInFuture;
      });

      console.log(
        `   � Result: ${events.length} events need 24h reminders right now`
      );

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
