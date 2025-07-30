const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const User = require("./dist/models/User").default;

// Connect to database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function debugRawEventCreatedBy() {
  try {
    console.log("🔍 Debugging Raw Event createdBy field...\n");

    // Get the raw event that's showing the bug
    const rawEvent = await Event.findOne({
      title: "Effective Communication - test",
    });

    if (!rawEvent) {
      console.log("❌ Event not found");
      return;
    }

    console.log(`📅 Event: "${rawEvent.title}"`);
    console.log(`🔍 Raw event createdBy analysis:`);
    console.log(`   Type: ${typeof rawEvent.createdBy}`);
    console.log(`   Value: ${rawEvent.createdBy}`);
    console.log(`   Constructor: ${rawEvent.createdBy?.constructor?.name}`);
    console.log(
      `   Is ObjectId: ${rawEvent.createdBy instanceof mongoose.Types.ObjectId}`
    );
    console.log(`   toString(): ${rawEvent.createdBy?.toString()}`);
    console.log(`   _id property: ${rawEvent.createdBy?._id}`);
    console.log(`   id property: ${rawEvent.createdBy?.id}`);

    // Check organizer details
    console.log(`\n📋 Organizer Details:`);
    rawEvent.organizerDetails.forEach((org, index) => {
      console.log(
        `   [${index}] UserId: ${org.userId} (type: ${typeof org.userId})`
      );
      console.log(`        toString(): ${org.userId?.toString()}`);
      console.log(
        `        Matches createdBy string: ${
          org.userId?.toString() === rawEvent.createdBy.toString()
        }`
      );
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

debugRawEventCreatedBy();
