const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const { EmailRecipientUtils } = require("./dist/utils/emailRecipientUtils");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/atCloud");

async function debugInitiatorExclusion() {
  try {
    console.log("🔍 Debugging initiator exclusion...");

    // Find an event with organizers to test
    const events = await Event.find({
      "organizerDetails.0": { $exists: true },
    }).limit(5);

    for (const event of events) {
      console.log(`\n📅 Event: ${event.title}`);
      console.log(`🔑 Main Organizer ID: ${event.createdBy}`);
      console.log(`👥 Organizer Details:`);

      event.organizerDetails.forEach((org, index) => {
        console.log(`   [${index}] UserId: ${org.userId}, Email: ${org.email}`);
        console.log(
          `       Is Main Organizer: ${
            org.userId?.toString() === event.createdBy.toString()
          }`
        );
      });

      // Get co-organizers using the utility
      const coOrganizers = await EmailRecipientUtils.getEventCoOrganizers(
        event
      );
      console.log(`📧 Co-organizers found: ${coOrganizers.length}`);
      coOrganizers.forEach((co, index) => {
        console.log(
          `   [${index}] ${co.firstName} ${co.lastName} - ${co.email}`
        );
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

debugInitiatorExclusion();
