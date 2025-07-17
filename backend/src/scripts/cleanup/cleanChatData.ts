import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function cleanChatData() {
  try {

    // Connect to MongoDB
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);

    // Get database reference
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("Failed to get database reference");
    }

    // Check if collections exist before trying to drop them
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    // Remove old chat-related collections if they exist
    if (collectionNames.includes("messages")) {
      await db.collection("messages").drop();
    } else {
    }

    if (collectionNames.includes("chatrooms")) {
      await db.collection("chatrooms").drop();
    } else {
    }

    // Clean any existing chat-related fields from user documents
    const usersCollection = db.collection("users");
    const updateResult = await usersCollection.updateMany(
      {},
      {
        $unset: {
          chatRooms: "",
          activeChats: "",
          chatHistory: "",
          messageHistory: "",
        },
      }
    );


  } catch (error) {
    console.error("❌ Error during chat data cleanup:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Run cleanup if this file is executed directly
if (require.main === module) {
  cleanChatData();
}

export default cleanChatData;
