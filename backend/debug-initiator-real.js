const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const User = require("./dist/models/User").default;
const { EmailRecipientUtils } = require("./dist/utils/emailRecipientUtils");

// Connect to the correct database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function debugInitiatorExclusion() {
  try {
    console.log(
      "🔍 Debugging Initiator Exclusion in Co-Organizer Notifications...\n"
    );

    // Find events with organizers to test
    const events = await Event.find({
      "organizerDetails.0": { $exists: true },
    }).limit(3);

    if (events.length === 0) {
      console.log(
        "❌ No events with organizers found in atcloud-signup database"
      );
      return;
    }

    console.log(`📅 Found ${events.length} events with organizers to test\n`);

    for (const event of events) {
      console.log(`\n📅 Event: "${event.title}"`);
      console.log(`🔑 Main Organizer ID: ${event.createdBy}`);
      console.log(
        `👥 Total Organizer Details: ${event.organizerDetails.length}`
      );

      // Show all organizer details
      console.log(`📋 All Organizers in Event:`);
      for (let i = 0; i < event.organizerDetails.length; i++) {
        const org = event.organizerDetails[i];
        const isMainOrganizer =
          org.userId?.toString() === event.createdBy.toString();
        console.log(`   [${i}] UserId: ${org.userId}, Email: ${org.email}`);
        console.log(
          `       Is Main Organizer: ${isMainOrganizer ? "🔑 YES" : "❌ NO"}`
        );
      }

      // Get co-organizers using the utility (should exclude main organizer)
      const coOrganizers = await EmailRecipientUtils.getEventCoOrganizers(
        event
      );
      console.log(
        `\n📧 Co-organizers found by EmailRecipientUtils: ${coOrganizers.length}`
      );

      if (coOrganizers.length > 0) {
        console.log(`📋 Co-organizer List:`);
        for (let i = 0; i < coOrganizers.length; i++) {
          const co = coOrganizers[i];
          console.log(`   [${i}] ${co.firstName} ${co.lastName} - ${co.email}`);

          // Check if this co-organizer is actually the main organizer
          const mainOrganizerUser = await User.findById(event.createdBy);
          if (mainOrganizerUser && co.email === mainOrganizerUser.email) {
            console.log(
              `       ⚠️  WARNING: Main organizer found in co-organizer list!`
            );
          }
        }
      } else {
        console.log(`   (No co-organizers found)`);
      }

      // Manual verification: Check filtering logic step by step
      console.log(`\n🔍 Manual Verification of Filtering Logic:`);
      const mainOrganizerId = event.createdBy.toString();
      console.log(`   Main Organizer ID: ${mainOrganizerId}`);

      const coOrganizerUserIds = event.organizerDetails
        .filter((organizer) => {
          const hasUserId =
            organizer.userId !== null && organizer.userId !== undefined;
          const isNotMainOrganizer =
            organizer.userId?.toString() !== mainOrganizerId;
          console.log(
            `   Organizer ${organizer.userId}: hasUserId=${hasUserId}, isNotMainOrganizer=${isNotMainOrganizer}`
          );
          return hasUserId && isNotMainOrganizer;
        })
        .map((organizer) => organizer.userId);

      console.log(
        `   Co-organizer UserIds after filtering: [${coOrganizerUserIds.join(
          ", "
        )}]`
      );

      console.log(`\n${"=".repeat(80)}`);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

debugInitiatorExclusion();
