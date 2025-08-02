/**
 * Detailed Timing Analysis for Event Reminders
 * Shows when the event will enter the 24h and 1h reminder windows
 */

const mongoose = require("mongoose");

async function analyzeEventTiming() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to database");

    // Get the event
    const EventModel = mongoose.model("Event", {
      title: String,
      date: String,
      time: String,
      "24hReminderSent": Boolean,
      "1hReminderSent": Boolean,
    });

    const event = await EventModel.findOne({
      title: "Effective Communication - Test 1",
    });

    if (!event) {
      console.log("❌ Event not found");
      return;
    }

    // Current time
    const now = new Date();

    // Event time
    const eventDateTime = new Date(`${event.date}T${event.time}:00.000Z`);

    // Calculate hours until event
    const hoursUntilEvent =
      (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // 24h reminder window (23.5 to 24.5 hours before event)
    const reminderWindow24hStart = new Date(
      eventDateTime.getTime() - 24.5 * 60 * 60 * 1000
    );
    const reminderWindow24hEnd = new Date(
      eventDateTime.getTime() - 23.5 * 60 * 60 * 1000
    );

    // 1h reminder window (45 minutes to 75 minutes before event)
    const reminderWindow1hStart = new Date(
      eventDateTime.getTime() - 75 * 60 * 1000
    );
    const reminderWindow1hEnd = new Date(
      eventDateTime.getTime() - 45 * 60 * 1000
    );

    console.log("\n🔍 DETAILED TIMING ANALYSIS");
    console.log("============================================================");
    console.log(`📅 Event: ${event.title}`);
    console.log(`📅 Event Date/Time: ${eventDateTime.toISOString()}`);
    console.log(`🕐 Current Time: ${now.toISOString()}`);
    console.log(`⏰ Hours Until Event: ${hoursUntilEvent.toFixed(2)} hours`);

    console.log("\n📬 24-HOUR REMINDER WINDOW");
    console.log("============================================================");
    console.log(`🟢 Window Start: ${reminderWindow24hStart.toISOString()}`);
    console.log(`🔴 Window End: ${reminderWindow24hEnd.toISOString()}`);

    const hoursUntil24hStart =
      (reminderWindow24hStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    const hoursUntil24hEnd =
      (reminderWindow24hEnd.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntil24hStart > 0) {
      console.log(
        `⏳ Time until window opens: ${hoursUntil24hStart.toFixed(2)} hours`
      );
      console.log(
        `📅 Window opens at: ${reminderWindow24hStart.toLocaleString()}`
      );
    } else if (hoursUntil24hEnd > 0) {
      console.log(
        `🎯 CURRENTLY IN 24H WINDOW! Window closes in ${Math.abs(
          hoursUntil24hEnd
        ).toFixed(2)} hours`
      );
    } else {
      console.log(`❌ 24h window has passed`);
    }

    console.log("\n📬 1-HOUR REMINDER WINDOW");
    console.log("============================================================");
    console.log(`🟢 Window Start: ${reminderWindow1hStart.toISOString()}`);
    console.log(`🔴 Window End: ${reminderWindow1hEnd.toISOString()}`);

    const hoursUntil1hStart =
      (reminderWindow1hStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    const hoursUntil1hEnd =
      (reminderWindow1hEnd.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntil1hStart > 0) {
      console.log(
        `⏳ Time until window opens: ${hoursUntil1hStart.toFixed(2)} hours`
      );
      console.log(
        `📅 Window opens at: ${reminderWindow1hStart.toLocaleString()}`
      );
    } else if (hoursUntil1hEnd > 0) {
      console.log(
        `🎯 CURRENTLY IN 1H WINDOW! Window closes in ${Math.abs(
          hoursUntil1hEnd
        ).toFixed(2)} hours`
      );
    } else {
      console.log(`❌ 1h window has passed`);
    }

    console.log("\n🎯 REMINDER STATUS");
    console.log("============================================================");
    console.log(`📧 24h Reminder Sent: ${event["24hReminderSent"] || false}`);
    console.log(`📧 1h Reminder Sent: ${event["1hReminderSent"] || false}`);

    // Determine what should happen next
    console.log("\n🔧 NEXT ACTIONS");
    console.log("============================================================");

    if (hoursUntil24hStart > 0) {
      console.log(
        `⏰ Wait ${hoursUntil24hStart.toFixed(2)} hours for 24h reminder window`
      );
      console.log(
        `📅 24h reminders will trigger at: ${reminderWindow24hStart.toLocaleString()}`
      );
    } else if (hoursUntil24hEnd > 0 && !event["24hReminderSent"]) {
      console.log(`🚨 EVENT IS IN 24H WINDOW - REMINDERS SHOULD BE SENT NOW!`);
      console.log(`🔧 Check if EventReminderScheduler is running`);
    } else if (hoursUntil1hStart > 0) {
      console.log(
        `⏰ Wait ${hoursUntil1hStart.toFixed(2)} hours for 1h reminder window`
      );
      console.log(
        `📅 1h reminders will trigger at: ${reminderWindow1hStart.toLocaleString()}`
      );
    } else if (hoursUntil1hEnd > 0 && !event["1hReminderSent"]) {
      console.log(`🚨 EVENT IS IN 1H WINDOW - REMINDERS SHOULD BE SENT NOW!`);
      console.log(`🔧 Check if EventReminderScheduler is running`);
    } else {
      console.log(`✅ Event is past all reminder windows`);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from database");
  }
}

analyzeEventTiming();
