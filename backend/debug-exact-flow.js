const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const User = require("./dist/models/User").default;
const { EmailRecipientUtils } = require("./dist/utils/emailRecipientUtils");

// Connect to the correct database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function debugExactFlow() {
  try {
    console.log("🔍 Debugging Exact Flow that Created Test 4 Bug...\n");

    // Find the Test 4 event
    const event = await Event.findOne({
      title: "Effective Communication - Test 4",
    });

    if (!event) {
      console.log("❌ Event not found");
      return;
    }

    console.log(`📅 Event: "${event.title}"`);

    // Get main organizer
    const mainOrganizer = await User.findById(event.createdBy);
    console.log(
      `🔑 Main Organizer: ${mainOrganizer.firstName} ${mainOrganizer.lastName} (${mainOrganizer._id})`
    );

    // Simulate the exact flow from eventController.ts lines 594-675
    console.log(`\n🔄 Simulating eventController.ts flow:`);

    // Step 1: Get co-organizers using EmailRecipientUtils (line 594-596)
    console.log(`\n   Step 1: Get co-organizers using EmailRecipientUtils`);
    const coOrganizers = await EmailRecipientUtils.getEventCoOrganizers(event);
    console.log(`   Result: ${coOrganizers.length} co-organizers found`);
    coOrganizers.forEach((co, index) => {
      console.log(
        `     [${index}] ${co.firstName} ${co.lastName} - ${co.email}`
      );
    });

    // Step 2: Map through co-organizers to create system messages (line 640-675)
    console.log(
      `\n   Step 2: Map through co-organizers to create system messages`
    );

    for (let i = 0; i < coOrganizers.length; i++) {
      const coOrganizer = coOrganizers[i];
      console.log(
        `\n     Processing co-organizer [${i}]: ${coOrganizer.firstName} ${coOrganizer.lastName}`
      );
      console.log(`     Email: ${coOrganizer.email}`);

      // This is the exact line from eventController.ts line 643-645
      const coOrganizerUser = await User.findOne({
        email: coOrganizer.email,
      }).select("_id");

      if (coOrganizerUser) {
        console.log(`     Found user ID: ${coOrganizerUser._id}`);
        console.log(
          `     Is main organizer? ${
            coOrganizerUser._id.toString() === mainOrganizer._id.toString()
              ? "🔑 YES (BUG SOURCE!)"
              : "❌ NO"
          }`
        );

        // This would create a targeted system message for this user ID
        console.log(
          `     Would create message for user: ${coOrganizerUser._id}`
        );

        if (coOrganizerUser._id.toString() === mainOrganizer._id.toString()) {
          console.log(`     ⚠️  THIS IS WHERE THE BUG OCCURS!`);
          console.log(
            `     The main organizer is being found in the co-organizer email lookup!`
          );
        }
      } else {
        console.log(`     ❌ User not found for email: ${coOrganizer.email}`);
      }
    }

    // Let's check if there's a data inconsistency
    console.log(`\n🔍 Data Consistency Check:`);
    console.log(`   Main organizer email: ${mainOrganizer.email}`);

    const mainOrganizerInCoOrganizerList = coOrganizers.some(
      (co) => co.email === mainOrganizer.email
    );
    console.log(
      `   Main organizer email found in co-organizer list: ${
        mainOrganizerInCoOrganizerList ? "❌ YES (THIS IS THE BUG!)" : "✅ NO"
      }`
    );

    if (mainOrganizerInCoOrganizerList) {
      console.log(`\n💥 ROOT CAUSE FOUND!`);
      console.log(
        `   The EmailRecipientUtils.getEventCoOrganizers() method is incorrectly returning the main organizer!`
      );
      console.log(
        `   This means the filtering logic in EmailRecipientUtils has a bug.`
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

debugExactFlow();
