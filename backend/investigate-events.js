/**
 * Investigate event-registration mapping to understand the count discrepancy
 */

const mongoose = require("mongoose");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

// Define schemas
const registrationSchema = new mongoose.Schema({}, { strict: false });
const eventSchema = new mongoose.Schema({}, { strict: false });

const Registration = mongoose.model("Registration", registrationSchema);
const Event = mongoose.model("Event", eventSchema);

async function investigateEventMapping() {
  try {
    console.log("🔍 Investigating event-registration mapping...\n");

    // Get all events
    const events = await Event.find({});
    console.log(`📋 Total events: ${events.length}`);

    // Get all registrations
    const registrations = await Registration.find({});
    console.log(`📊 Total registrations: ${registrations.length}\n`);

    // Map events to their titles
    const eventMap = {};
    events.forEach((event) => {
      eventMap[event._id.toString()] = event.title;
    });

    // Show registration distribution
    console.log("📊 Registration distribution by event:");
    const registrationsByEvent = {};
    registrations.forEach((reg) => {
      const eventId = reg.eventId.toString();
      if (!registrationsByEvent[eventId]) {
        registrationsByEvent[eventId] = 0;
      }
      registrationsByEvent[eventId]++;
    });

    for (const [eventId, count] of Object.entries(registrationsByEvent)) {
      const title = eventMap[eventId] || "Unknown Event";
      console.log(`  ${title} (${eventId}): ${count} registrations`);
    }

    // Show events with no registrations
    console.log("\n📭 Events with no registrations:");
    events.forEach((event) => {
      const eventId = event._id.toString();
      if (!registrationsByEvent[eventId]) {
        console.log(`  ${event.title} (${eventId})`);
      }
    });

    // Let's specifically look for the test events mentioned
    console.log("\n🔍 Looking for test events specifically:");
    const testEvents = events.filter(
      (event) =>
        event.title.toLowerCase().includes("test") ||
        event.title.toLowerCase().includes("effective communication")
    );

    testEvents.forEach((event) => {
      const eventId = event._id.toString();
      const regCount = registrationsByEvent[eventId] || 0;
      console.log(
        `  ${event.title}: ${regCount} registrations (ID: ${eventId})`
      );
    });
  } catch (error) {
    console.error("❌ Investigation failed:", error.message);
  } finally {
    mongoose.connection.close();
  }
}

investigateEventMapping();
