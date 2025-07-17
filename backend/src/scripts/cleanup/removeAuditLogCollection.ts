#!/usr/bin/env node

/**
 * Script to remove the auditlogs collection from MongoDB
 * This script removes all audit log data from the database
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function removeAuditLogCollection() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not established");
    }

    // Check if auditlogs collection exists
    const collections = await db.listCollections().toArray();
    const auditLogCollection = collections.find(
      (col) => col.name === "auditlogs"
    );

    if (auditLogCollection) {
      console.log("📋 Found auditlogs collection");

      // Get document count before deletion
      const count = await db.collection("auditlogs").countDocuments();
      console.log(`📊 Collection contains ${count} documents`);

      // Drop the collection
      await db.collection("auditlogs").drop();
      console.log("🗑️  Successfully dropped auditlogs collection");
      console.log(`✅ Removed ${count} audit log documents`);
    } else {
      console.log("ℹ️  No auditlogs collection found - nothing to remove");
    }

    console.log("\n🎯 Audit logs collection cleanup complete!");
  } catch (error) {
    console.error("❌ Error removing audit logs collection:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("📤 Disconnected from MongoDB");
    process.exit(0);
  }
}

// Run the script
removeAuditLogCollection();
