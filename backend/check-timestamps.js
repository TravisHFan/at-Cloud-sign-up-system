const mongoose = require("mongoose");
const Message = require("./dist/models/Message").default;

// Connect to the correct database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function checkMessageTimestamps() {
  try {
    console.log("🔍 Checking Test 4 Message Timestamps...\n");

    // Find Co-Organizer Assignment messages for Test 4
    const messages = await Message.find({
      title: "Co-Organizer Assignment: Effective Communication - Test 4",
    }).sort({ createdAt: 1 }); // Sort by creation time ascending

    console.log(`📬 Found ${messages.length} messages for Test 4:`);

    messages.forEach((msg, index) => {
      console.log(`\n[${index + 1}] Message ID: ${msg._id}`);
      console.log(`    Created: ${msg.createdAt}`);
      console.log(`    From: ${msg.creator.firstName} ${msg.creator.lastName}`);
      console.log(`    Recipients: ${msg.userStates.size}`);

      // Show recipient
      for (const [userId, userState] of msg.userStates) {
        console.log(`    Recipient: ${userId}`);
      }
    });

    // Check our latest git changes/fixes
    console.log(`\n📅 Timeline Analysis:`);
    console.log(`   Our fixes were applied around: 2025-07-30 (today)`);
    console.log(`   Test 4 messages were created: ${messages[0]?.createdAt}`);

    const messageTime = new Date(messages[0]?.createdAt);
    const now = new Date();
    const timeDiff = now - messageTime;
    const minutesAgo = Math.floor(timeDiff / (1000 * 60));

    console.log(`   Messages created: ${minutesAgo} minutes ago`);
    console.log(
      `   This suggests: ${
        minutesAgo < 60
          ? "Messages created AFTER fixes (bug still exists)"
          : "Messages created BEFORE fixes (old bug)"
      }`
    );
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

checkMessageTimestamps();
