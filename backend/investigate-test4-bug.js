const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const User = require("./dist/models/User").default;
const Message = require("./dist/models/Message").default;

// Connect to the correct database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function investigateTest4Bug() {
  try {
    console.log("🔍 Investigating Test 4 Bug...\n");

    // Find the Test 4 event
    const event = await Event.findOne({
      title: "Effective Communication - Test 4",
    });

    if (!event) {
      console.log('❌ Event "Effective Communication - Test 4" not found');
      return;
    }

    console.log(`📅 Event: "${event.title}"`);
    console.log(`🔑 Main Organizer ID: ${event.createdBy}`);

    // Get main organizer
    const mainOrganizer = await User.findById(event.createdBy);
    console.log(
      `👤 Main Organizer: ${mainOrganizer.firstName} ${mainOrganizer.lastName} (${mainOrganizer._id})`
    );

    // Show all organizers
    console.log(`\n📋 All Organizers in Event:`);
    for (let i = 0; i < event.organizerDetails.length; i++) {
      const org = event.organizerDetails[i];
      const user = await User.findById(org.userId);
      const isMainOrganizer =
        org.userId?.toString() === event.createdBy.toString();
      console.log(
        `   [${i}] ${user?.firstName} ${user?.lastName} (${org.userId})`
      );
      console.log(
        `       Is Main Organizer: ${isMainOrganizer ? "🔑 YES" : "❌ NO"}`
      );
    }

    // Find Co-Organizer Assignment messages for Test 4
    console.log(`\n📬 Co-Organizer Assignment messages for Test 4:`);
    const coOrganizerMessages = await Message.find({
      title: "Co-Organizer Assignment: Effective Communication - Test 4",
    }).sort({ createdAt: -1 });

    console.log(`   Found: ${coOrganizerMessages.length} messages`);

    for (let i = 0; i < coOrganizerMessages.length; i++) {
      const msg = coOrganizerMessages[i];
      console.log(`\n   [${i + 1}] Message ID: ${msg._id}`);
      console.log(`       Created: ${msg.createdAt}`);
      console.log(
        `       From: ${msg.creator.firstName} ${msg.creator.lastName} (ID: ${msg.creator.id})`
      );
      console.log(`       Recipients: ${msg.userStates.size}`);

      // Show recipients
      let recipientCount = 0;
      for (const [userId, userState] of msg.userStates) {
        recipientCount++;
        const user = await User.findById(userId);
        const isCreator = userId === msg.creator.id;
        const isMainOrganizer = userId === mainOrganizer._id.toString();
        console.log(
          `       [${recipientCount}] ${user?.firstName} ${user?.lastName} (${userId})`
        );
        if (isCreator)
          console.log(`           🔑 This is the CREATOR of the message!`);
        if (isMainOrganizer)
          console.log(
            `           ⚠️  This is the MAIN ORGANIZER (should NOT receive this!)!`
          );
      }
    }

    // Summary
    console.log(`\n📊 Bug Analysis:`);
    const ruthFanMessages = coOrganizerMessages.filter((msg) =>
      Array.from(msg.userStates.keys()).includes(mainOrganizer._id.toString())
    );

    console.log(
      `   Ruth Fan received ${ruthFanMessages.length} Co-Organizer Assignment messages`
    );
    console.log(`   She should have received: 0 messages`);
    console.log(
      `   Bug confirmed: ${ruthFanMessages.length > 0 ? "❌ YES" : "✅ NO"}`
    );

    if (ruthFanMessages.length > 0) {
      console.log(
        `\n💥 BUG CONFIRMED: Ruth Fan (main organizer) received Co-Organizer Assignment notifications!`
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

investigateTest4Bug();
