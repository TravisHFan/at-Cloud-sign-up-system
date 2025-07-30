const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const User = require("./dist/models/User").default;
const {
  ResponseBuilderService,
} = require("./dist/services/ResponseBuilderService");
const { EmailRecipientUtils } = require("./dist/utils/emailRecipientUtils");

// Connect to the correct database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function debugPopulatedEventData() {
  try {
    console.log("🔍 Debugging Populated Event Data...\n");

    // Find the Test 4 event
    const rawEvent = await Event.findOne({
      title: "Effective Communication - Test 4",
    });

    if (!rawEvent) {
      console.log("❌ Event not found");
      return;
    }

    console.log(`📅 Event: "${rawEvent.title}"`);

    // Get main organizer
    const mainOrganizer = await User.findById(rawEvent.createdBy);
    console.log(
      `🔑 Main Organizer: ${mainOrganizer.firstName} ${mainOrganizer.lastName} (${mainOrganizer._id})`
    );

    // Compare raw event vs populated event
    console.log(`\n📋 Raw Event Organizer Details:`);
    rawEvent.organizerDetails.forEach((org, index) => {
      console.log(`   [${index}] UserId: ${org.userId}, Email: ${org.email}`);
      console.log(
        `       Is Main Organizer: ${
          org.userId?.toString() === rawEvent.createdBy.toString()
            ? "🔑 YES"
            : "❌ NO"
        }`
      );
    });

    // Get populated event (this is what's used for notifications)
    console.log(`\n🔄 Getting populated event data...`);
    const populatedEvent =
      await ResponseBuilderService.buildEventWithRegistrations(
        rawEvent._id.toString()
      );

    if (!populatedEvent) {
      console.log("❌ Populated event not found");
      return;
    }

    console.log(`\n📋 Populated Event Organizer Details:`);
    populatedEvent.organizerDetails.forEach((org, index) => {
      console.log(`   [${index}] UserId: ${org.userId}, Email: ${org.email}`);
      console.log(
        `       Is Main Organizer: ${
          org.userId?.toString() === rawEvent.createdBy.toString()
            ? "🔑 YES"
            : "❌ NO"
        }`
      );
    });

    // Get co-organizers using raw event
    console.log(`\n🎯 Co-organizers using RAW event:`);
    const coOrganizersRaw = await EmailRecipientUtils.getEventCoOrganizers(
      rawEvent
    );
    console.log(`   Found: ${coOrganizersRaw.length}`);
    coOrganizersRaw.forEach((co, index) => {
      console.log(
        `     [${index}] ${co.firstName} ${co.lastName} - ${co.email}`
      );
    });

    // Get co-organizers using populated event (THIS IS WHAT'S ACTUALLY USED)
    console.log(`\n🎯 Co-organizers using POPULATED event:`);
    const coOrganizersPopulated =
      await EmailRecipientUtils.getEventCoOrganizers(populatedEvent);
    console.log(`   Found: ${coOrganizersPopulated.length}`);
    coOrganizersPopulated.forEach((co, index) => {
      console.log(
        `     [${index}] ${co.firstName} ${co.lastName} - ${co.email}`
      );

      // Check if this is the main organizer
      if (co.email === mainOrganizer.email) {
        console.log(
          `       ⚠️  WARNING: Main organizer found in populated event co-organizer list!`
        );
      }
    });

    // Check if there's a difference
    const bothIncludeMainOrganizer =
      coOrganizersRaw.some((co) => co.email === mainOrganizer.email) &&
      coOrganizersPopulated.some((co) => co.email === mainOrganizer.email);

    const onlyPopulatedIncludesMainOrganizer =
      !coOrganizersRaw.some((co) => co.email === mainOrganizer.email) &&
      coOrganizersPopulated.some((co) => co.email === mainOrganizer.email);

    console.log(`\n📊 Analysis:`);
    console.log(
      `   Raw event co-organizers include main organizer: ${
        coOrganizersRaw.some((co) => co.email === mainOrganizer.email)
          ? "❌ YES"
          : "✅ NO"
      }`
    );
    console.log(
      `   Populated event co-organizers include main organizer: ${
        coOrganizersPopulated.some((co) => co.email === mainOrganizer.email)
          ? "❌ YES"
          : "✅ NO"
      }`
    );

    if (onlyPopulatedIncludesMainOrganizer) {
      console.log(`\n💥 ROOT CAUSE FOUND!`);
      console.log(
        `   The ResponseBuilderService.populateFreshOrganizerContacts() is corrupting the organizer data!`
      );
      console.log(
        `   This is causing the main organizer to be incorrectly included in notifications.`
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

debugPopulatedEventData();
