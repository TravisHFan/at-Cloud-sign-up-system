/**
 * Debug duplicate notifications issue
 */

const mongoose = require("mongoose");

async function debugDuplicateNotifications() {
  try {
    console.log("🔍 Debugging duplicate notifications issue");

    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    const messageSchema = new mongoose.Schema({}, { strict: false });
    const Message = mongoose.model("Message", messageSchema, "messages");

    // Get recent role change messages
    console.log("\n📱 Recent role change messages (last 10):");
    const recentMessages = await Message.find({
      type: "auth_level_change",
    })
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(`Found ${recentMessages.length} recent role change messages:`);

    const messageGroups = {};

    for (const message of recentMessages) {
      console.log(`\n📝 Message: "${message.title}"`);
      console.log(`   ID: ${message._id}`);
      console.log(`   Content: ${message.content.substring(0, 100)}...`);
      console.log(`   Created: ${message.createdAt}`);
      console.log(
        `   User states count: ${
          message.userStates ? Object.keys(message.userStates).length : 0
        }`
      );

      // Group by title and time to detect duplicates
      const timeKey = new Date(message.createdAt)
        .toISOString()
        .substring(0, 16); // minute precision
      const groupKey = `${message.title}-${timeKey}`;

      if (!messageGroups[groupKey]) {
        messageGroups[groupKey] = [];
      }
      messageGroups[groupKey].push(message);
    }

    console.log("\n🔍 Checking for duplicate groups:");
    for (const [groupKey, messages] of Object.entries(messageGroups)) {
      if (messages.length > 1) {
        console.log(`\n❌ DUPLICATE GROUP: ${groupKey}`);
        console.log(`   ${messages.length} identical messages found:`);
        messages.forEach((msg, index) => {
          console.log(
            `     ${index + 1}. ID: ${msg._id} - Created: ${msg.createdAt}`
          );
        });
      } else {
        console.log(`✅ Single message: ${groupKey}`);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

debugDuplicateNotifications().catch(console.error);
