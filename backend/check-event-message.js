const mongoose = require("mongoose");
const Message = require("./dist/models/Message").default;
const User = require("./dist/models/User").default;

// Connect to the correct database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function checkEventCreationMessage() {
  try {
    console.log("🔍 Checking event creation message recipients...\n");

    // Find the event creation message
    const eventMessage = await Message.findOne({
      title: "New Event: Effective Communication - Test 3",
    });

    if (!eventMessage) {
      console.log("❌ Event creation message not found");
      return;
    }

    console.log(`📧 Event Message: ${eventMessage.title}`);
    console.log(
      `👤 Creator: ${eventMessage.creator.firstName} ${eventMessage.creator.lastName}`
    );
    console.log(`🔑 Creator ID: ${eventMessage.creator.id}`);
    console.log(`📊 Total Recipients: ${eventMessage.userStates.size}\n`);

    // Find the creator user in database
    const creatorUser = await User.findById(eventMessage.creator.id);
    console.log(
      `🎯 Creator User: ${creatorUser.firstName} ${creatorUser.lastName} (${creatorUser._id})\n`
    );

    // Check if creator received their own message
    const creatorReceived = eventMessage.userStates.has(
      eventMessage.creator.id
    );
    console.log(
      `🚫 Creator received own message: ${
        creatorReceived ? "❌ YES (BUG!)" : "✅ NO (correct)"
      }\n`
    );

    // Show all recipients
    console.log(`📋 All Recipients:`);
    let count = 0;
    for (const [userId, userState] of eventMessage.userStates) {
      count++;
      const user = await User.findById(userId);
      const isCreator = userId === eventMessage.creator.id;
      console.log(
        `   [${count}] ${user?.firstName} ${user?.lastName} (${userId}) ${
          isCreator ? "🔑 CREATOR" : ""
        }`
      );
    }

    if (!creatorReceived) {
      console.log(
        "\n🎉 SUCCESS: Event creator is correctly excluded from event creation notifications!"
      );
      console.log("   The initiator exclusion is working properly.");
    } else {
      console.log(
        "\n❌ BUG CONFIRMED: Event creator is receiving their own event creation notifications."
      );
      console.log("   The excludeUserIds parameter is not working correctly.");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

checkEventCreationMessage();
