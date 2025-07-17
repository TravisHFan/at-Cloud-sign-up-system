#!/usr/bin/env node

/**
 * Script to remove the empty atcloud-signup-system database
 * This script cleans up the redundant database that was created with inconsistent naming
 */

import mongoose from "mongoose";

async function removeRedundantDatabase() {
  try {
    console.log("🗑️  Removing redundant database: atcloud-signup-system");

    // Connect to the redundant database
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup-system");
    console.log("✅ Connected to atcloud-signup-system database");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not established");
    }

    // Check what collections exist
    const collections = await db.listCollections().toArray();
    console.log(`📋 Found ${collections.length} collections`);

    // Show collection contents
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`- ${col.name}: ${count} documents`);
    }

    // Drop the entire database
    await db.dropDatabase();
    console.log("🗑️  Successfully dropped atcloud-signup-system database");

    console.log("\n✅ Database cleanup complete!");
    console.log(
      "📊 Main database 'atcloud-signup' remains active with all data"
    );
  } catch (error) {
    console.error("❌ Error removing redundant database:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("📤 Disconnected from MongoDB");
    process.exit(0);
  }
}

// Run the script
removeRedundantDatabase();
