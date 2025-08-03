const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

async function verifyReminderSent() {
  try {
    console.log("🔍 Verifying if reminder was sent...");

    // Connect to database
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Define schemas
    const eventSchema = new mongoose.Schema(
      {},
      { strict: false, collection: "events" }
    );
    const messageSchema = new mongoose.Schema(
      {},
      { strict: false, collection: "messages" }
    );

    const Event = mongoose.model("Event", eventSchema);
    const Message = mongoose.model("Message", messageSchema);

    // Check the event status
    const event = await Event.findOne({ title: "Event test Online" });
    console.log("📋 Event status:", {
      title: event.title,
      "24hReminderSent": event["24hReminderSent"],
      "24hReminderSentAt": event["24hReminderSentAt"],
    });

    // Check for recent system messages about event reminders
    const recentMessages = await Message.find({
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }, // Last 10 minutes
      title: { $regex: /reminder/i },
    })
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`📨 Found ${recentMessages.length} recent reminder messages:`);
    recentMessages.forEach((msg, idx) => {
      console.log(`   ${idx + 1}. ${msg.title} (${msg.createdAt})`);
    });

    if (event["24hReminderSent"] === true && recentMessages.length > 0) {
      console.log("🎉 SUCCESS: Automatic reminder system is working!");
      console.log("   ✅ Event marked as reminder sent");
      console.log("   ✅ System messages created");
      console.log(
        "   ✅ Ruth Fan and Hunter Liang should have received the trio!"
      );
    } else {
      console.log("⚠️ Reminder status unclear - may still be processing");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

verifyReminderSent();
