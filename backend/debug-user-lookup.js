const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const User = require("./dist/models/User").default;
const { EmailRecipientUtils } = require("./dist/utils/emailRecipientUtils");

// Connect to the correct database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function debugUserLookupFlow() {
  try {
    console.log(
      "🔍 Debugging User Lookup Flow for Co-Organizer Notifications...\n"
    );

    // Find the Test 3 event
    const event = await Event.findOne({
      title: "Effective Communication - Test 3",
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

    // Get co-organizers using EmailRecipientUtils
    const coOrganizers = await EmailRecipientUtils.getEventCoOrganizers(event);
    console.log(
      `\n👥 Co-organizers from EmailRecipientUtils: ${coOrganizers.length}`
    );

    // Simulate the exact flow from eventController.ts
    console.log(`\n🔄 Simulating eventController notification flow:`);

    const coOrganizerSystemMessagePromises = coOrganizers.map(
      async (coOrganizer, index) => {
        console.log(
          `\n   [${index}] Processing co-organizer: ${coOrganizer.firstName} ${coOrganizer.lastName}`
        );
        console.log(`       Email: ${coOrganizer.email}`);

        // This is the exact line from eventController.ts
        const coOrganizerUser = await User.findOne({
          email: coOrganizer.email,
        }).select("_id");

        if (coOrganizerUser) {
          console.log(`       Found user ID: ${coOrganizerUser._id}`);
          console.log(
            `       Is this the main organizer? ${
              coOrganizerUser._id.toString() === mainOrganizer._id.toString()
                ? "🔑 YES (BUG!)"
                : "❌ NO (correct)"
            }`
          );

          // Check if this user ID would create a message for the main organizer
          if (coOrganizerUser._id.toString() === mainOrganizer._id.toString()) {
            console.log(
              `       ⚠️  THIS IS THE BUG! Main organizer would receive a Co-Organizer Assignment message!`
            );
          }

          return {
            coOrganizerEmail: coOrganizer.email,
            coOrganizerUserId: coOrganizerUser._id.toString(),
            isMainOrganizer:
              coOrganizerUser._id.toString() === mainOrganizer._id.toString(),
          };
        } else {
          console.log(
            `       ❌ User not found for email: ${coOrganizer.email}`
          );
          return null;
        }
      }
    );

    const results = await Promise.all(coOrganizerSystemMessagePromises);

    console.log(
      `\n📊 Summary of who would receive Co-Organizer Assignment notifications:`
    );
    results.forEach((result, index) => {
      if (result) {
        console.log(
          `   [${index}] ${result.coOrganizerEmail} -> User ID: ${
            result.coOrganizerUserId
          } ${
            result.isMainOrganizer
              ? "🔑 MAIN ORGANIZER (BUG!)"
              : "✅ Co-organizer (correct)"
          }`
        );
      }
    });

    const mainOrganizerWouldReceive = results.some(
      (result) => result && result.isMainOrganizer
    );
    console.log(
      `\n🎯 Would main organizer receive Co-Organizer Assignment notification? ${
        mainOrganizerWouldReceive ? "❌ YES (BUG!)" : "✅ NO (correct)"
      }`
    );

    if (mainOrganizerWouldReceive) {
      console.log(
        "\n💥 BUG CONFIRMED: The notification flow has a logic error!"
      );
      console.log(
        "   The co-organizer list is correct, but somehow the main organizer is still getting notified."
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

debugUserLookupFlow();
