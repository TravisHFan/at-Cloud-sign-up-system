#!/usr/bin/env ts-node
/**
 * Migration Script: Hardcoded Role Templates to Database
 *
 * This script migrates the existing hardcoded role templates from
 * backend/src/config/eventTemplates.ts to the database.
 *
 * Creates default templates for each event type, attributed to a system user.
 * Safe to run multiple times - checks for existing templates before inserting.
 *
 * Usage:
 *   ts-node backend/src/scripts/migrate-role-templates.ts
 */

import mongoose from "mongoose";
import RolesTemplate from "../models/RolesTemplate";
import User from "../models/User";
import {
  ALLOWED_EVENT_TYPES,
  EVENT_TEMPLATES,
  type AllowedEventType,
} from "../config/eventTemplates";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";

async function migrateRoleTemplates() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find or create a system user for template ownership
    // Using Super Admin role, or create a dedicated migration user
    let systemUser = await User.findOne({ role: "Super Admin" }).sort({
      createdAt: 1,
    });

    if (!systemUser) {
      console.log(
        "⚠️  No Super Admin found. Creating a system migration user..."
      );
      systemUser = await User.create({
        username: "system-migration",
        email: "system@atcloud.internal",
        password: "migration-user-no-login",
        firstName: "System",
        lastName: "Migration",
        role: "Super Admin",
        roleInAtCloud: "System",
        phone: "000-000-0000",
        birthday: new Date("2000-01-01"),
        address: "System",
        gender: "male",
        circle: "A",
        verified: true,
      });
      console.log(
        `✅ Created system migration user: ${String(systemUser._id)}`
      );
    } else {
      console.log(
        `✅ Found Super Admin: ${systemUser.firstName} ${
          systemUser.lastName
        } (${String(systemUser._id)})`
      );
    }

    let migratedCount = 0;
    let skippedCount = 0;

    // Migrate each event type's default template
    for (const eventType of ALLOWED_EVENT_TYPES) {
      const templateName = `Default ${eventType} Template`;

      // Check if default template already exists
      const existing = await RolesTemplate.findOne({
        eventType,
        name: templateName,
      });

      if (existing) {
        console.log(
          `⏭️  Skipping ${eventType}: Default template already exists`
        );
        skippedCount++;
        continue;
      }

      // Get roles from hardcoded templates
      const roles = EVENT_TEMPLATES[eventType as AllowedEventType].map(
        (role) => ({
          name: role.name,
          description: role.description,
          maxParticipants: role.maxParticipants,
          openToPublic: false, // Default value, can be customized later
        })
      );

      // Create new template in database
      const newTemplate = await RolesTemplate.create({
        name: templateName,
        eventType,
        roles,
        createdBy: systemUser._id,
      });

      console.log(
        `✅ Migrated ${eventType}: ${roles.length} roles → ${String(
          newTemplate._id
        )}`
      );
      migratedCount++;
    }

    console.log("\n📊 Migration Summary:");
    console.log(`   ✅ Migrated: ${migratedCount} templates`);
    console.log(`   ⏭️  Skipped: ${skippedCount} templates (already exist)`);
    console.log(
      `   📝 Total templates in DB: ${await RolesTemplate.countDocuments()}`
    );

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run migration
migrateRoleTemplates();
