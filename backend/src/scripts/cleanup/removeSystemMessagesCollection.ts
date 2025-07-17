/**
 * Database Cleanup Script: Remove SystemMessages Collection
 *
 * This script removes the redundant 'systemmessages' collection from MongoDB
 * since we've migrated to user-centric system messages embedded in User documents.
 *
 * Benefits of user-centric approach:
 * - Better data isolation: Each user only accesses their own data
 * - Improved performance: No cross-collection queries needed
 * - Enhanced privacy: No exposure to other users' data
 * - Perfect scalability: User data grows linearly, not exponentially
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";

async function removeSystemMessagesCollection() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB successfully");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection failed");
    }

    // Check if systemmessages collection exists
    const collections = await db
      .listCollections({ name: "systemmessages" })
      .toArray();

    if (collections.length > 0) {
      console.log("📊 Found 'systemmessages' collection");

      // Get document count before deletion
      const documentCount = await db
        .collection("systemmessages")
        .countDocuments();
      console.log(`📈 Collection contains ${documentCount} documents`);

      // Drop the collection
      await db.collection("systemmessages").drop();
      console.log("🗑️  Successfully removed 'systemmessages' collection");
      console.log("✅ Database cleanup completed");

      console.log("\n🎯 Migration Summary:");
      console.log("- Removed redundant 'systemmessages' collection");
      console.log(
        "- System messages are now stored in User.systemMessages[] arrays"
      );
      console.log(
        "- User-centric approach provides better performance and isolation"
      );
      console.log("- Each user can only access their own system messages");
    } else {
      console.log(
        "ℹ️  'systemmessages' collection does not exist - already cleaned up!"
      );
    }
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the cleanup if this script is called directly
if (require.main === module) {
  removeSystemMessagesCollection()
    .then(() => {
      console.log("🎉 Cleanup completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Cleanup failed:", error);
      process.exit(1);
    });
}

export { removeSystemMessagesCollection };
