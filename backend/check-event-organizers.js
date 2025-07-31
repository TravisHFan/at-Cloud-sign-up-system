/**
 * Check events and their organizer details
 */

const { Event, User } = require("./dist/models/index");
const mongoose = require("mongoose");

async function checkEventOrganizers() {
  try {
    // Connect to database
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup"
    );
    console.log("✅ Connected to MongoDB");

    // Get all events with organizer details
    const events = await Event.find({}).limit(10);

    console.log(`📋 Found ${events.length} events:\n`);

    events.forEach((event, index) => {
      console.log(`[${index + 1}] ${event.title}`);
      console.log(`   ID: ${event._id}`);
      console.log(`   Creator: ${event.createdBy}`);
      console.log(
        `   Organizer Details:`,
        event.organizerDetails?.map((org) => ({
          userId: org.userId,
          name: org.name,
          role: org.role,
        }))
      );
      console.log("");
    });

    // Get user IDs for reference
    const users = await User.find({}).select("firstName lastName email");
    console.log("👥 Users for reference:");
    users.forEach((user) => {
      console.log(
        `   ${user._id}: ${user.firstName} ${user.lastName} (${user.email})`
      );
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

checkEventOrganizers();
