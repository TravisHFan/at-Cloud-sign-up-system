const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const User = require("./dist/models/User").default;
const { EmailRecipientUtils } = require("./dist/utils/emailRecipientUtils");

// Connect to the correct database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function debugCoOrganizerAssignmentLogic() {
  try {
    console.log("🔍 Debugging Co-Organizer Assignment Logic...\n");

    // Find an event with multiple organizers
    const event = await Event.findOne({
      "organizerDetails.1": { $exists: true }, // Has at least 2 organizers
    });

    if (!event) {
      console.log("❌ No event with multiple organizers found");
      return;
    }

    console.log(`📅 Event: "${event.title}"`);
    console.log(`🔑 Main Organizer ID: ${event.createdBy}`);
    console.log(`👥 Total Organizers: ${event.organizerDetails.length}\n`);

    // Get main organizer user info
    const mainOrganizerUser = await User.findById(event.createdBy);
    console.log(
      `👤 Main Organizer: ${mainOrganizerUser.firstName} ${mainOrganizerUser.lastName}`
    );
    console.log(`📧 Main Organizer Email: ${mainOrganizerUser.email}\n`);

    // Show all organizers in the event
    console.log(`📋 All Organizers in Event:`);
    for (let i = 0; i < event.organizerDetails.length; i++) {
      const org = event.organizerDetails[i];
      const user = await User.findById(org.userId);
      const isMainOrganizer =
        org.userId?.toString() === event.createdBy.toString();
      console.log(
        `   [${i}] ${user?.firstName} ${user?.lastName} (${org.userId})`
      );
      console.log(`       Email: ${user?.email}`);
      console.log(
        `       Is Main Organizer: ${isMainOrganizer ? "🔑 YES" : "❌ NO"}`
      );
    }

    // Get co-organizers using EmailRecipientUtils
    console.log(`\n🎯 Co-organizers from EmailRecipientUtils:`);
    const coOrganizers = await EmailRecipientUtils.getEventCoOrganizers(event);
    console.log(`   Found: ${coOrganizers.length} co-organizers`);

    for (let i = 0; i < coOrganizers.length; i++) {
      const co = coOrganizers[i];
      console.log(`   [${i}] ${co.firstName} ${co.lastName} - ${co.email}`);

      // Check if this is the main organizer
      if (co.email === mainOrganizerUser.email) {
        console.log(
          `       ⚠️  WARNING: Main organizer found in co-organizer list!`
        );
      }
    }

    // Check the filtering logic step by step
    console.log(`\n🔍 Step-by-step filtering verification:`);
    const mainOrganizerId = event.createdBy.toString();

    console.log(`   1. Main Organizer ID: ${mainOrganizerId}`);
    console.log(`   2. Organizers to filter:`);

    event.organizerDetails.forEach((organizer, index) => {
      const userId = organizer.userId?.toString();
      const isNotMainOrganizer = userId !== mainOrganizerId;
      console.log(`      [${index}] UserId: ${userId}`);
      console.log(`           Not main organizer: ${isNotMainOrganizer}`);
    });

    const filteredUserIds = event.organizerDetails
      .filter(
        (organizer) =>
          organizer.userId && organizer.userId.toString() !== mainOrganizerId
      )
      .map((organizer) => organizer.userId);

    console.log(
      `   3. Filtered Co-organizer IDs: [${filteredUserIds.join(", ")}]`
    );

    const shouldReceiveNotification = filteredUserIds.includes(
      mainOrganizerUser._id.toString()
    );
    console.log(
      `\n🎯 Should main organizer receive Co-Organizer Assignment notification?`
    );
    console.log(
      `   Answer: ${
        shouldReceiveNotification ? "❌ YES (BUG!)" : "✅ NO (correct)"
      }`
    );

    if (shouldReceiveNotification) {
      console.log(
        "\n💥 BUG CONFIRMED: Main organizer is incorrectly included in co-organizer notifications!"
      );
    } else {
      console.log(
        "\n✅ Logic is correct: Main organizer properly excluded from co-organizer notifications"
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

debugCoOrganizerAssignmentLogic();
