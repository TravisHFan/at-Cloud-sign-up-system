#!/usr/bin/env ts-node
/**
 * Migration Script: Convert programId to programLabels
 *
 * This script migrates all existing events from the old programId field
 * to the new programLabels array field.
 *
 * Transformation logic:
 * - If event has programId: programLabels = [programId]
 * - If event has no programId: programLabels = []
 *
 * Usage:
 *   npm run migrate:program-labels [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be changed without actually updating
 */

import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import Event from "../src/models/Event";
import { connectDatabase } from "../src/models/index";

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, "..", ".env") });

interface MigrationStats {
  total: number;
  withProgramId: number;
  withoutProgramId: number;
  updated: number;
  errors: number;
}

async function migratePrograms(dryRun: boolean = false): Promise<void> {
  const stats: MigrationStats = {
    total: 0,
    withProgramId: 0,
    withoutProgramId: 0,
    updated: 0,
    errors: 0,
  };

  try {
    console.log("🚀 Starting migration: programId → programLabels");
    console.log(
      `Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE (will update)"}`
    );
    console.log("─".repeat(60));

    // Find all events (with programId or without)
    const events = await Event.find({}).lean().exec();
    stats.total = events.length;
    console.log(`📊 Found ${stats.total} events to process`);

    // Process each event
    for (const event of events) {
      try {
        const programId = event.programId as
          | mongoose.Types.ObjectId
          | null
          | undefined;
        const currentLabels =
          (event.programLabels as mongoose.Types.ObjectId[]) || [];

        // Determine new programLabels value
        let newProgramLabels: mongoose.Types.ObjectId[];
        if (programId) {
          newProgramLabels = [programId];
          stats.withProgramId++;
        } else {
          newProgramLabels = [];
          stats.withoutProgramId++;
        }

        // Log what would be changed
        const eventTitle = event.title || "Untitled";
        console.log(`\n📝 Event: ${eventTitle} (${event._id})`);
        console.log(`   Old: programId = ${programId || "null"}`);
        console.log(
          `   Old: programLabels = [${currentLabels.join(", ") || "empty"}]`
        );
        console.log(
          `   New: programLabels = [${newProgramLabels.join(", ") || "empty"}]`
        );

        // Update if not dry run and labels are different
        if (!dryRun) {
          const needsUpdate =
            JSON.stringify(currentLabels) !== JSON.stringify(newProgramLabels);

          if (needsUpdate) {
            await Event.updateOne(
              { _id: event._id },
              { $set: { programLabels: newProgramLabels } }
            );
            stats.updated++;
            console.log(`   ✅ Updated`);
          } else {
            console.log(`   ⏭️  Already migrated, skipping`);
          }
        } else {
          stats.updated++; // Count what would be updated
          console.log(`   🔍 Would update (dry run)`);
        }
      } catch (error) {
        stats.errors++;
        console.error(`❌ Error processing event ${event._id}:`, error);
      }
    }

    // Print summary
    console.log("\n" + "─".repeat(60));
    console.log("📊 Migration Summary:");
    console.log(`   Total events: ${stats.total}`);
    console.log(`   Events with programId: ${stats.withProgramId}`);
    console.log(`   Events without programId: ${stats.withoutProgramId}`);
    console.log(
      `   Events ${dryRun ? "would be" : ""} updated: ${stats.updated}`
    );
    console.log(`   Errors: ${stats.errors}`);
    console.log("─".repeat(60));

    if (dryRun) {
      console.log("✅ Dry run complete. No changes made.");
      console.log("Run without --dry-run to apply changes.");
    } else {
      console.log("✅ Migration complete!");
    }
  } catch (error) {
    console.error("❌ Fatal error during migration:", error);
    throw error;
  }
}

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");

    // Production safety check
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && !dryRun) {
      console.warn("\n⚠️  WARNING: Running migration in PRODUCTION mode!");
      console.warn("⚠️  This will modify the production database.");
      console.warn(
        "⚠️  Ensure you have backed up the database before proceeding.\n"
      );

      // In production, require explicit confirmation
      const readline = require("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(
          'Type "MIGRATE" to continue, or anything else to abort: ',
          resolve
        );
      });
      rl.close();

      if (answer !== "MIGRATE") {
        console.log("❌ Migration aborted by user.");
        process.exit(0);
      }

      console.log("✅ Proceeding with production migration...\n");
    }

    // Connect to database
    console.log("🔌 Connecting to database...");
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(
      `📍 Database: ${
        process.env.MONGODB_URI?.split("/").pop()?.split("?")[0] || "unknown"
      }`
    );
    await connectDatabase();
    console.log("✅ Database connected");

    // Run migration
    await migratePrograms(dryRun);

    // Close connection
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { migratePrograms };
