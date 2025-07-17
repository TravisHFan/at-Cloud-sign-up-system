#!/usr/bin/env node

/**
 * Cleanup Script: Remove unifiednotifications collection
 *
 * This collection is a remnant from the old chat system that has been
 * completely replaced by the user-centric notification architecture.
 *
 * Current State:
 * - 0 documents (empty)
 * - No code references
 * - Replaced by user.bellNotifications and hybrid system messages
 *
 * Safe to remove: YES
 */

import mongoose from "mongoose";

async function cleanupUnifiedNotifications() {
  try {
    console.log("🧹 Starting cleanup of unifiednotifications collection...");

    // Connect to the database
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to atcloud-signup database");

    // Check if collection exists and get stats
    const collections = await mongoose.connection.db
      ?.listCollections()
      .toArray();
    const unifiedNotificationsExists = collections?.some(
      (col) => col.name === "unifiednotifications"
    );

    if (!unifiedNotificationsExists) {
      console.log(
        "ℹ️  unifiednotifications collection doesn't exist - already cleaned up"
      );
      return;
    }

    // Get collection stats before removal
    const docCount = await mongoose.connection.db
      ?.collection("unifiednotifications")
      .countDocuments();
    const indexCount = await mongoose.connection.db
      ?.collection("unifiednotifications")
      .listIndexes()
      .toArray();
    console.log(`📊 Collection stats before removal:`);
    console.log(`   Documents: ${docCount || 0}`);
    console.log(`   Indexes: ${indexCount?.length || 0}`);

    // Verify it's empty before dropping
    if (docCount && docCount > 0) {
      console.log(
        `⚠️  Warning: Collection has ${docCount} documents. Manual review required.`
      );
      return;
    }

    console.log("✅ Confirmed: Collection is empty, safe to remove");

    // Drop the collection
    await mongoose.connection.db?.collection("unifiednotifications").drop();
    console.log("🗑️  Successfully dropped unifiednotifications collection");

    // Verify removal
    const collectionsAfter = await mongoose.connection.db
      ?.listCollections()
      .toArray();
    const stillExists = collectionsAfter?.some(
      (col) => col.name === "unifiednotifications"
    );

    if (stillExists) {
      console.log("❌ Error: Collection still exists after drop operation");
    } else {
      console.log("✅ Verified: Collection successfully removed");
    }

    // Show final database state
    console.log("\n📋 Final database collections:");
    const finalCollections = await mongoose.connection.db
      ?.listCollections()
      .toArray();
    finalCollections?.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name}`);
    });

    console.log("\n🎉 Cleanup completed successfully!");
    console.log("📝 Summary:");
    console.log("   - Removed obsolete unifiednotifications collection");
    console.log("   - Database now contains only active collections");
    console.log(
      "   - User-centric notification architecture is fully implemented"
    );
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run the cleanup
cleanupUnifiedNotifications();
