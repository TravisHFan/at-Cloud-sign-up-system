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

async function cleanupDuplicateWelcomeMessages() {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    // Find all welcome messages
    const welcomeMessages = await SystemMessage.find({
      title: { $regex: "Welcome", $options: "i" },
    });

    console.log(`Found ${welcomeMessages.length} welcome messages:`);
    welcomeMessages.forEach((msg) => {
      console.log(
        `- "${msg.title}" (target: ${msg.targetUserId || "global"}) - ${
          msg.createdAt
        }`
      );
    });

    // Delete all global (untargeted) welcome messages
    const deleteResult = await SystemMessage.deleteMany({
      title: { $regex: "Welcome", $options: "i" },
      targetUserId: { $exists: false },
    });

    console.log(
      `\n🗑️ Deleted ${deleteResult.deletedCount} global welcome messages`
    );

    // Show remaining messages
    const remainingWelcome = await SystemMessage.find({
      title: { $regex: "Welcome", $options: "i" },
    });

    console.log(
      `\n📋 Remaining ${remainingWelcome.length} targeted welcome messages:`
    );
    remainingWelcome.forEach((msg) => {
      console.log(`- "${msg.title}" (target: ${msg.targetUserId})`);
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
    process.exit(0);
  }
}

cleanupDuplicateWelcomeMessages();
