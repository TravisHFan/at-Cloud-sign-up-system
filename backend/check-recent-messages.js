const mongoose = require("mongoose");
const Message = require("./dist/models/Message").default;

// Connect to the correct database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function checkRecentMessages() {
  try {
    console.log("🔍 Checking recent system messages...\n");

    // Find recent messages
    const recentMessages = await Message.find({})
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`📬 Found ${recentMessages.length} recent messages:`);

    for (let i = 0; i < recentMessages.length; i++) {
      const msg = recentMessages[i];
      console.log(`\n[${i + 1}] ${msg.title}`);
      console.log(`    Created: ${msg.createdAt}`);
      console.log(`    Type: ${msg.type}`);
      console.log(`    Recipients: ${msg.userStates.size}`);
      console.log(
        `    Creator: ${msg.creator.firstName} ${msg.creator.lastName}`
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

checkRecentMessages();
