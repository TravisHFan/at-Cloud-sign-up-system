#!/usr/bin/env node

/**
 * Direct MongoDB query to check events and fix missing type field
 */

const mongoose = require("mongoose");

async function checkAndFixEvents() {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to atcloud-signup database");

    // Get the events collection directly
    const db = mongoose.connection.db;
    const eventsCollection = db.collection("events");

    // Get all events
    const events = await eventsCollection.find({}).toArray();
    console.log(`\n📋 Found ${events.length} events in database:`);

    events.forEach((event, index) => {
      console.log(`\n${index + 1}. Event: "${event.title}"`);
      console.log(`   - ID: ${event._id}`);
      console.log(`   - Type: ${event.type || "UNDEFINED ❌"}`);
      console.log(`   - Format: ${event.format || "UNDEFINED"}`);
      console.log(`   - Date: ${event.date}`);
    });

    // Check for events with undefined/missing type
    const eventsWithoutType = events.filter((event) => !event.type);
    console.log(`\n⚠️ Events missing type field: ${eventsWithoutType.length}`);

    if (eventsWithoutType.length > 0) {
      console.log("\n🔧 Fixing events with missing type field...");

      for (const event of eventsWithoutType) {
        // Set a default type based on the title or use a generic one
        let defaultType = "Effective Communication Workshop Series";

        if (event.title && event.title.toLowerCase().includes("meeting")) {
          defaultType = "Weekly Meeting";
        } else if (
          event.title &&
          event.title.toLowerCase().includes("training")
        ) {
          defaultType = "Training Session";
        } else if (
          event.title &&
          event.title.toLowerCase().includes("workshop")
        ) {
          defaultType = "Workshop";
        }

        console.log(
          `   - Updating "${event.title}" with type: "${defaultType}"`
        );

        await eventsCollection.updateOne(
          { _id: event._id },
          { $set: { type: defaultType } }
        );
      }

      console.log("✅ Updated events with missing type field");
    } else {
      console.log("✅ All events have type field");
    }

    // Get unique types after potential fixes
    const uniqueTypes = await eventsCollection.distinct("type");
    console.log("\n📊 Unique event types in database:");
    uniqueTypes.forEach((type, index) => {
      console.log(`   ${index + 1}. "${type}"`);
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

checkAndFixEvents();
