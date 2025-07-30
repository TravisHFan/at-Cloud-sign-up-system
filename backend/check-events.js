const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/atCloud");

async function checkEvents() {
  try {
    console.log("🔍 Checking events in database...");

    const eventCount = await Event.countDocuments();
    console.log(`📊 Total events: ${eventCount}`);

    if (eventCount === 0) {
      console.log("❌ No events found in database");
      return;
    }

    // Get a few recent events
    const events = await Event.find({}).sort({ createdAt: -1 }).limit(5);

    console.log("\n📅 Recent Events:");
    events.forEach((event, index) => {
      console.log(`\n[${index + 1}] ${event.title}`);
      console.log(`    Created by: ${event.createdBy}`);
      console.log(
        `    Organizer details: ${
          event.organizerDetails ? event.organizerDetails.length : 0
        }`
      );

      if (event.organizerDetails && event.organizerDetails.length > 0) {
        console.log("    Organizers:");
        event.organizerDetails.forEach((org, orgIndex) => {
          console.log(
            `      [${orgIndex}] UserId: ${org.userId}, Email: ${org.email}`
          );
        });
      }
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

checkEvents();
