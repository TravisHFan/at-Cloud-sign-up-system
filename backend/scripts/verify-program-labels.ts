#!/usr/bin/env ts-node
/**
 * Verification Script: Check programLabels Migration Status
 *
 * This script checks the status of the programId → programLabels migration
 * without making any changes to the database.
 *
 * Usage:
 *   npm run verify:program-labels
 *
 * Returns:
 *   - Migration status summary
 *   - Events needing migration
 *   - Validation errors (if any)
 */

import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import Event from "../src/models/Event";
import { connectDatabase } from "../src/models/index";

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, "..", ".env") });

interface VerificationStats {
  total: number;
  migrated: number;
  needsMigration: number;
  validationErrors: number;
  inconsistent: number;
}

async function verifyMigration(): Promise<void> {
  const stats: VerificationStats = {
    total: 0,
    migrated: 0,
    needsMigration: 0,
    validationErrors: 0,
    inconsistent: 0,
  };

  const issues: Array<{
    eventId: string;
    title: string;
    issue: string;
  }> = [];

  try {
    console.log("🔍 Verifying programLabels migration status");
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(
      `📍 Database: ${
        process.env.MONGODB_URI?.split("/").pop()?.split("?")[0] || "unknown"
      }`
    );
    console.log("─".repeat(60));

    // Find all events
    const events = await Event.find({}).lean().exec();
    stats.total = events.length;
    console.log(`📊 Found ${stats.total} events\n`);

    // Process each event
    for (const event of events) {
      const programId = event.programId as
        | mongoose.Types.ObjectId
        | null
        | undefined;
      const programLabels =
        (event.programLabels as mongoose.Types.ObjectId[]) || [];
      const eventTitle = event.title || "Untitled";
      const eventId = event._id?.toString() || "unknown";

      // Check migration status
      if (programId && programLabels.length === 0) {
        // Has programId but no programLabels - needs migration
        stats.needsMigration++;
        issues.push({
          eventId,
          title: eventTitle,
          issue: `Has programId (${programId}) but programLabels is empty`,
        });
      } else if (programId && programLabels.length > 0) {
        // Has both - check consistency
        const hasMatchingLabel = programLabels.some(
          (label) => label.toString() === programId.toString()
        );
        if (hasMatchingLabel) {
          stats.migrated++;
        } else {
          stats.inconsistent++;
          issues.push({
            eventId,
            title: eventTitle,
            issue: `programId (${programId}) not in programLabels [${programLabels.join(
              ", "
            )}]`,
          });
        }
      } else if (!programId && programLabels.length === 0) {
        // No program association - valid
        stats.migrated++;
      } else if (!programId && programLabels.length > 0) {
        // Has programLabels but no programId - valid (migrated)
        stats.migrated++;
      } else {
        // Unexpected state
        stats.validationErrors++;
        issues.push({
          eventId,
          title: eventTitle,
          issue: "Unexpected state - manual review needed",
        });
      }
    }

    // Print summary
    console.log("📊 Migration Status Summary:");
    console.log("─".repeat(60));
    console.log(`   Total events: ${stats.total}`);
    console.log(`   ✅ Migrated: ${stats.migrated}`);
    console.log(`   ⏳ Needs migration: ${stats.needsMigration}`);
    console.log(`   ⚠️  Inconsistent: ${stats.inconsistent}`);
    console.log(`   ❌ Validation errors: ${stats.validationErrors}`);
    console.log("─".repeat(60));

    // Calculate migration percentage
    const migrationPercentage =
      stats.total > 0 ? ((stats.migrated / stats.total) * 100).toFixed(1) : "0";
    console.log(`\n📈 Migration Progress: ${migrationPercentage}%`);

    // Print issues if any
    if (issues.length > 0) {
      console.log(`\n⚠️  Found ${issues.length} issue(s):\n`);
      issues.forEach(({ eventId, title, issue }, index) => {
        console.log(`${index + 1}. Event: ${title} (${eventId})`);
        console.log(`   Issue: ${issue}\n`);
      });
    }

    // Print recommendation
    console.log("\n" + "─".repeat(60));
    if (stats.needsMigration > 0 || stats.inconsistent > 0) {
      console.log("🔧 Recommendation: Run migration script");
      console.log("   npm run migrate:program-labels:dry  # First test");
      console.log("   npm run migrate:program-labels      # Then apply");
    } else if (stats.validationErrors > 0) {
      console.log("⚠️  Recommendation: Manual review required");
      console.log("   Check events with validation errors above");
    } else {
      console.log("✅ Migration complete! All events verified.");
    }
    console.log("─".repeat(60));
  } catch (error) {
    console.error("❌ Verification failed:", error);
    throw error;
  }
}

async function main() {
  try {
    // Connect to database
    console.log("🔌 Connecting to database...");
    await connectDatabase();
    console.log("✅ Database connected\n");

    // Run verification
    await verifyMigration();

    // Close connection
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { verifyMigration };
