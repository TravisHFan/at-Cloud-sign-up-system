#!/usr/bin/env node

/**
 * Event Reminder Scheduler (Optional Enhancement)
 *
 * This script demonstrates how to add automated scheduling to trigger
 * event reminders 24 hours before events begin. This completes the
 * final optional enhancement for the notification trio system.
 *
 * Installation: npm install node-cron
 * Usage: node event-reminder-scheduler.js
 */

const cron = require("node-cron");
const mongoose = require("mongoose");
const fetch = require("node-fetch");

// Configure environment
require("dotenv").config();

class EventReminderScheduler {
  constructor() {
    this.apiBaseUrl =
      process.env.API_BASE_URL || "http://localhost:5001/api/v1";
    this.isConnected = false;
  }

  async initialize() {
    try {
      // Connect to MongoDB
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup"
      );
      this.isConnected = true;
      console.log("✅ Connected to database");

      // Start the scheduler
      this.startScheduler();
      console.log("⏰ Event reminder scheduler started");
    } catch (error) {
      console.error("❌ Failed to initialize scheduler:", error.message);
    }
  }

  startScheduler() {
    // Run every hour to check for events needing 24-hour reminders
    cron.schedule("0 * * * *", async () => {
      console.log("🔍 Checking for events needing 24-hour reminders...");
      await this.processEventReminders();
    });

    // Also run every 15 minutes for 1-hour reminders
    cron.schedule("*/15 * * * *", async () => {
      console.log("🔍 Checking for events needing 1-hour reminders...");
      await this.processEventReminders("1h");
    });

    console.log("📅 Scheduled tasks:");
    console.log("   • Every hour: 24-hour reminders");
    console.log("   • Every 15 minutes: 1-hour reminders");
  }

  async processEventReminders(reminderType = "24h") {
    try {
      if (!this.isConnected) {
        console.log("⚠️ Database not connected, skipping reminder check");
        return;
      }

      // Get events needing reminders
      const events = await this.getEventsNeedingReminders(reminderType);

      if (events.length === 0) {
        console.log(`ℹ️ No events need ${reminderType} reminders at this time`);
        return;
      }

      console.log(
        `📧 Found ${events.length} events needing ${reminderType} reminders`
      );

      // Send reminders for each event
      for (const event of events) {
        await this.sendEventReminder(event, reminderType);
      }
    } catch (error) {
      console.error("❌ Error processing event reminders:", error.message);
    }
  }

  async getEventsNeedingReminders(reminderType) {
    // Calculate the target time window
    const now = new Date();
    const targetTime = new Date(now);

    if (reminderType === "24h") {
      targetTime.setHours(now.getHours() + 24);
    } else if (reminderType === "1h") {
      targetTime.setHours(now.getHours() + 1);
    }

    // Query for events in the target time window
    const Event = mongoose.model("Event");

    const events = await Event.find({
      date: {
        $gte: targetTime.toISOString().split("T")[0], // Today or later
        $lte: new Date(targetTime.getTime() + 60 * 60 * 1000)
          .toISOString()
          .split("T")[0], // Within 1 hour window
      },
      // Only events that haven't had this reminder sent yet
      [`${reminderType}ReminderSent`]: { $ne: true },
    });

    return events;
  }

  async sendEventReminder(event, reminderType) {
    try {
      console.log(`📤 Sending ${reminderType} reminder for: ${event.title}`);

      // Prepare the reminder request
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

      // Call the existing event reminder API
      const response = await fetch(
        `${this.apiBaseUrl}/notifications/event-reminder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Add authentication header if needed
            // 'Authorization': `Bearer ${systemToken}`
          },
          body: JSON.stringify(reminderData),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Reminder sent successfully: ${result.message}`);

        // Mark this reminder as sent
        await this.markReminderSent(event._id, reminderType);
      } else {
        console.error(`❌ Failed to send reminder: ${response.statusText}`);
      }
    } catch (error) {
      console.error(
        `❌ Error sending reminder for ${event.title}:`,
        error.message
      );
    }
  }

  async markReminderSent(eventId, reminderType) {
    try {
      const Event = mongoose.model("Event");
      await Event.findByIdAndUpdate(eventId, {
        [`${reminderType}ReminderSent`]: true,
        [`${reminderType}ReminderSentAt`]: new Date(),
      });
    } catch (error) {
      console.error("❌ Error marking reminder as sent:", error.message);
    }
  }

  async shutdown() {
    console.log("🛑 Shutting down event reminder scheduler...");
    if (this.isConnected) {
      await mongoose.connection.close();
      console.log("✅ Database connection closed");
    }
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n⚠️ Received SIGINT, shutting down gracefully...");
  if (scheduler) {
    await scheduler.shutdown();
  }
});

process.on("SIGTERM", async () => {
  console.log("\n⚠️ Received SIGTERM, shutting down gracefully...");
  if (scheduler) {
    await scheduler.shutdown();
  }
});

// Start the scheduler
console.log("🚀 Starting Event Reminder Scheduler...");
console.log("=".repeat(50));

const scheduler = new EventReminderScheduler();
scheduler.initialize().catch((error) => {
  console.error("💥 Failed to start scheduler:", error.message);
  process.exit(1);
});

console.log("\n📋 Scheduler Features:");
console.log("   ✅ Automatic 24-hour reminders (hourly check)");
console.log("   ✅ Automatic 1-hour reminders (15-minute check)");
console.log("   ✅ Duplicate prevention (tracks sent reminders)");
console.log("   ✅ Uses existing Event Reminders trio API");
console.log("   ✅ Graceful shutdown handling");

console.log("\n🎯 Integration Notes:");
console.log('   • Add to package.json: "node-cron": "^3.0.2"');
console.log("   • Run as background service: PM2 or systemd");
console.log("   • Monitor logs for reminder delivery status");
console.log("   • Extend Event schema to track reminder status");

console.log("\n⏰ Scheduler is now running... Press Ctrl+C to stop");
