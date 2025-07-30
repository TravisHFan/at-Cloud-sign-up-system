const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const User = require("./dist/models/User").default;
const { EmailRecipientUtils } = require("./dist/utils/emailRecipientUtils");

// Connect to the correct database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function debugTest3Event() {
  try {
    console.log('🔍 Debugging "Effective Communication - Test 3" Event...\n');

    // Find the specific event
    const event = await Event.findOne({
      title: "Effective Communication - Test 3",
    });

    if (!event) {
      console.log('❌ Event "Effective Communication - Test 3" not found');
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
    console.log(`📧 Main Organizer Email: ${mainOrganizerUser.email}`);
    console.log(`🆔 Main Organizer ID: ${mainOrganizerUser._id}\n`);

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

      // Check if this is the main organizer (Ruth Fan)
      if (co.email === mainOrganizerUser.email) {
        console.log(
          `       ⚠️  WARNING: Main organizer (Ruth Fan) found in co-organizer list!`
        );
      }
    }

    // Detailed filtering analysis
    console.log(`\n🔍 Detailed Filtering Analysis:`);
    console.log(`   Main Organizer ID: ${event.createdBy.toString()}`);
    console.log(`   Filtering logic:`);

    event.organizerDetails.forEach((organizer, index) => {
      const userId = organizer.userId?.toString();
      const isNotMainOrganizer = userId !== event.createdBy.toString();
      const user = User.findById(organizer.userId);
      console.log(`      [${index}] ${organizer.userId}`);
      console.log(`           Not main organizer: ${isNotMainOrganizer}`);
      console.log(
        `           Will be included: ${organizer.userId && isNotMainOrganizer}`
      );
    });

    // Check if Ruth Fan is incorrectly being included
    const ruthFanInCoOrganizers = coOrganizers.some(
      (co) => co.email === mainOrganizerUser.email
    );
    console.log(
      `\n🎯 Is Ruth Fan (initiator) in co-organizer list? ${
        ruthFanInCoOrganizers ? "❌ YES (BUG!)" : "✅ NO (correct)"
      }`
    );

    if (ruthFanInCoOrganizers) {
      console.log(
        "\n💥 BUG CONFIRMED: Ruth Fan (initiator) is incorrectly receiving Co-Organizer Assignment notifications!"
      );
      console.log(
        "   This means the filtering logic is not working correctly."
      );
    } else {
      console.log(
        "\n✅ Logic appears correct: Ruth Fan should not receive Co-Organizer Assignment notifications"
      );
      console.log("   The issue might be elsewhere in the notification flow.");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

debugTest3Event();
