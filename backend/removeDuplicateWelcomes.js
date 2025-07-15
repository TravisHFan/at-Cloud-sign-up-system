const mongoose = require("mongoose");

// SystemMessage schema (simplified for cleanup)
const systemMessageSchema = new mongoose.Schema(
  {
    title: String,
    content: String,
    type: String,
    priority: String,
    targetUserId: String,
    creator: Object,
    isActive: { type: Boolean, default: true },
    readByUsers: [String],
  },
  { timestamps: true }
);

const SystemMessage = mongoose.model("SystemMessage", systemMessageSchema);

async function removeDuplicateWelcomeMessages() {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    // Find all welcome messages grouped by targetUserId
    const welcomeMessages = await SystemMessage.find({
      title: { $regex: "Welcome", $options: "i" },
      targetUserId: { $exists: true },
    }).sort({ createdAt: -1 }); // Sort by newest first

    console.log(`Found ${welcomeMessages.length} targeted welcome messages`);

    // Group by targetUserId
    const messagesByUser = {};
    welcomeMessages.forEach((msg) => {
      if (!messagesByUser[msg.targetUserId]) {
        messagesByUser[msg.targetUserId] = [];
      }
      messagesByUser[msg.targetUserId].push(msg);
    });

    let deletedCount = 0;

    // Keep only the newest message for each user, delete the rest
    for (const userId in messagesByUser) {
      const userMessages = messagesByUser[userId];
      if (userMessages.length > 1) {
        console.log(
          `User ${userId} has ${userMessages.length} welcome messages`
        );

        // Keep the first (newest) message, delete the rest
        for (let i = 1; i < userMessages.length; i++) {
          await SystemMessage.deleteOne({ _id: userMessages[i]._id });
          deletedCount++;
          console.log(
            `  - Deleted duplicate from ${userMessages[i].createdAt}`
          );
        }
      }
    }

    console.log(`\n🗑️ Deleted ${deletedCount} duplicate welcome messages`);

    // Show remaining messages
    const remainingWelcome = await SystemMessage.find({
      title: { $regex: "Welcome", $options: "i" },
    });

    console.log(`\n📋 Remaining ${remainingWelcome.length} welcome messages:`);
    remainingWelcome.forEach((msg) => {
      console.log(
        `- "${msg.title}" (target: ${msg.targetUserId || "global"}) - ${
          msg.createdAt
        }`
      );
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
    process.exit(0);
  }
}

removeDuplicateWelcomeMessages();
