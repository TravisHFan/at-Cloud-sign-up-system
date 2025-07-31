#!/usr/bin/env node

/**
 * Check if events in database have type field
 */

const mongoose = require("mongoose");

async function checkEventTypeField() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://localhost:27017/atcloud-signup-system"
    );
    console.log("✅ Connected to MongoDB");

    // Get events collection directly
    const db = mongoose.connection.db;
    const eventsCollection = db.collection("events");

    // Get a few sample events
    const events = await eventsCollection.find({}).limit(3).toArray();

    console.log(`\n📋 Found ${events.length} events to check:`);

    events.forEach((event, index) => {
      console.log(`\n${index + 1}. Event: "${event.title}"`);
      console.log(`   - type field exists: ${event.hasOwnProperty("type")}`);
      console.log(`   - type value: "${event.type}"`);
      console.log(`   - format value: "${event.format}"`);
      console.log(`   - ID: ${event._id}`);
    });

    // Check if any events have type field
    const eventsWithType = await eventsCollection.countDocuments({
      type: { $exists: true, $ne: null },
    });
    const eventsWithoutType = await eventsCollection.countDocuments({
      type: { $exists: false },
    });
    const eventsWithNullType = await eventsCollection.countDocuments({
      type: null,
    });
    const eventsWithUndefinedType = await eventsCollection.countDocuments({
      type: undefined,
    });

    console.log(`\n📊 Type field statistics:`);
    console.log(`   - Events with type field: ${eventsWithType}`);
    console.log(`   - Events without type field: ${eventsWithoutType}`);
    console.log(`   - Events with null type: ${eventsWithNullType}`);
    console.log(`   - Events with undefined type: ${eventsWithUndefinedType}`);

    // Get total events
    const totalEvents = await eventsCollection.countDocuments({});
    console.log(`   - Total events: ${totalEvents}`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

checkEventTypeField();
