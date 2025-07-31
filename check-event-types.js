#!/usr/bin/env node

/**
 * Check actual event types in database
 */

const { Event } = require("./backend/src/models/Event");
const mongoose = require("mongoose");

async function checkEventTypes() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://localhost:27017/atcloud-signup-system"
    );
    console.log("✅ Connected to MongoDB");

    // Get all unique event types from database
    const eventTypes = await Event.distinct("type");
    console.log("\n📋 Event types found in database:");
    eventTypes.forEach((type, index) => {
      console.log(`  ${index + 1}. "${type}"`);
    });

    // Get sample event to check its type
    const sampleEvent = await Event.findOne().select("title type");
    if (sampleEvent) {
      console.log(
        `\n📝 Sample event: "${sampleEvent.title}" with type: "${sampleEvent.type}"`
      );
    }

    console.log("\n🔍 EVENT_TYPES from frontend:");
    console.log('   - "Effective Communication Workshop Series"');

    const mismatch = eventTypes.filter(
      (type) => type !== "Effective Communication Workshop Series"
    );
    if (mismatch.length > 0) {
      console.log(
        "\n⚠️ MISMATCH FOUND! Database has types not in frontend dropdown:"
      );
      mismatch.forEach((type) => console.log(`   - "${type}"`));
    } else {
      console.log("\n✅ All database event types exist in frontend dropdown");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

checkEventTypes();
