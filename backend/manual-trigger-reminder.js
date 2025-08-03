const mongoose = require("mongoose");
const { connectToDatabase } = require("./dist/config/database");

// Import the Event model and emailNotificationController
const Event = require("./dist/models/Event").Event;
const {
  sendEventReminderTrio,
} = require("./dist/controllers/emailNotificationController");

async function manualTriggerReminder() {
  try {
    console.log("✅ Connecting to MongoDB...");
    await connectToDatabase();
    console.log("✅ Connected to MongoDB");

    // Find the Test Event In-person
    const event = await Event.findOne({
      title: "Test Event In-person",
    }).populate("registrations.user");

    if (!event) {
      console.log("❌ Event 'Test Event In-person' not found");
      return;
    }

    console.log(`📋 Found event: ${event.title}`);
    console.log(`📅 Event time: ${event.date} ${event.time}`);
    console.log(`📧 Reminder sent: ${event["24hReminderSent"]}`);
    console.log(`👥 Registered users: ${event.registrations.length}`);

    if (event["24hReminderSent"]) {
      console.log("ℹ️ Reminder already sent for this event");
      return;
    }

    // Manually trigger the reminder trio for this event
    console.log("🚀 Manually triggering 24h reminder trio...");

    // Call the same function the scheduler would call
    await sendEventReminderTrio(event._id.toString());

    console.log("✅ Manual reminder trigger completed!");
  } catch (error) {
    console.error("❌ Error during manual trigger:", error);
  } finally {
    mongoose.connection.close();
  }
}

manualTriggerReminder();
