import mongoose from "mongoose";
import dotenv from "dotenv";
import Message from "./src/models/Message";

// Load environment variables
dotenv.config();

async function checkSystemMessages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("✅ Connected to MongoDB");

    const ruthUserId = "6886abdfcef802ebd11ae59f";

    console.log("🔍 Checking system messages for Ruth Fan...");

    // Get all messages where Ruth is in userStates
    const allMessages = await Message.find({
      isActive: true,
      $or: [
        { [`userStates.${ruthUserId}`]: { $exists: true } },
        { userStates: { $exists: true } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(20);

    console.log(`📊 Found ${allMessages.length} messages in database`);

    for (const message of allMessages) {
      console.log("\n📝 Message:", {
        id: message._id,
        title: message.title,
        type: message.type,
        createdAt: message.createdAt,
        userStatesType: message.userStates?.constructor?.name,
        hasRuthInUserStates:
          message.userStates instanceof Map
            ? message.userStates.has(ruthUserId)
            : Boolean(message.userStates && message.userStates[ruthUserId]),
      });

      if (message.userStates instanceof Map) {
        const ruthState = message.userStates.get(ruthUserId);
        if (ruthState) {
          console.log("  👤 Ruth's state (Map):", ruthState);
        }
      } else if (message.userStates && message.userStates[ruthUserId]) {
        console.log(
          "  👤 Ruth's state (Object):",
          message.userStates[ruthUserId]
        );
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

checkSystemMessages();
