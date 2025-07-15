const mongoose = require("mongoose");

// SystemMessage schema (simplified for checking)
const systemMessageSchema = new mongoose.Schema(
  {
    title: String,
    targetUserId: String,
  },
  { timestamps: true }
);

const SystemMessage = mongoose.model("SystemMessage", systemMessageSchema);

async function checkSarahsMessages() {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");

    // Sarah's actual user ID
    const sarahUserId = "68760b8c71559e3b54094e6e";

    // Find messages targeted to Sarah
    const sarahTargetedMessages = await SystemMessage.find({
      targetUserId: sarahUserId,
    });

    console.log(`Sarah's targeted messages: ${sarahTargetedMessages.length}`);
    sarahTargetedMessages.forEach((msg) => {
      console.log(`- "${msg.title}"`);
    });

    // Also check all messages to see what exists
    const allMessages = await SystemMessage.find({});
    console.log(`\nAll system messages in database: ${allMessages.length}`);
    allMessages.forEach((msg) => {
      console.log(`- "${msg.title}" (target: ${msg.targetUserId || "global"})`);
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

checkSarahsMessages();
