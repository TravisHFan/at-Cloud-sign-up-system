const mongoose = require("mongoose");
const Message = require("./dist/models/Message").default;
const User = require("./dist/models/User").default;

// Connect to the correct database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function checkCoOrganizerAssignmentMessages() {
  try {
    console.log("🔍 Checking actual Co-Organizer Assignment messages...\n");

    // Find co-organizer assignment messages
    const coOrganizerMessages = await Message.find({
      title: { $regex: /Co-Organizer Assignment/ },
    })
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(
      `📬 Found ${coOrganizerMessages.length} Co-Organizer Assignment messages:\n`
    );

    for (let i = 0; i < coOrganizerMessages.length; i++) {
      const msg = coOrganizerMessages[i];
      console.log(`[${i + 1}] ${msg.title}`);
      console.log(`    Created: ${msg.createdAt}`);
      console.log(
        `    From: ${msg.creator.firstName} ${msg.creator.lastName} (ID: ${msg.creator.id})`
      );
      console.log(`    Recipients: ${msg.userStates.size}`);

      // Show all recipients
      console.log(`    Recipients List:`);
      let recipientCount = 0;
      for (const [userId, userState] of msg.userStates) {
        recipientCount++;
        const user = await User.findById(userId);
        const isCreator = userId === msg.creator.id;
        console.log(
          `      [${recipientCount}] ${user?.firstName} ${
            user?.lastName
          } (${userId}) ${isCreator ? "🔑 CREATOR!" : ""}`
        );
      }

      // Check if creator received their own message
      const creatorReceived = msg.userStates.has(msg.creator.id);
      console.log(
        `    ⚠️  Creator received own message: ${
          creatorReceived ? "❌ YES (BUG!)" : "✅ NO (correct)"
        }`
      );
      console.log("");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

checkCoOrganizerAssignmentMessages();
