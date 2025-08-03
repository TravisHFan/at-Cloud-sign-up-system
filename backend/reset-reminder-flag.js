const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

async function resetReminderFlag() {
  try {
    console.log("🔧 Resetting reminder flag for testing...");

    // Connect to database
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Define Event schema (minimal for this script)
    const eventSchema = new mongoose.Schema(
      {},
      { strict: false, collection: "events" }
    );
    const Event = mongoose.model("Event", eventSchema);

    // Find and reset the test event
    const result = await Event.updateOne(
      { title: "Event test Online" },
      {
        $unset: {
          "24hReminderSent": "",
          "24hReminderSentAt": "",
        },
      }
    );

    console.log("✅ Reset result:", result);

    // Verify the reset
    const event = await Event.findOne({ title: "Event test Online" });
    console.log("📋 Event after reset:", {
      title: event.title,
      date: event.date,
      time: event.time,
      "24hReminderSent": event["24hReminderSent"],
      "24hReminderSentAt": event["24hReminderSentAt"],
    });

    console.log("🎉 Event is ready for automatic reminder testing!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

resetReminderFlag();
