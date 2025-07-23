const mongoose = require("mongoose");

async function checkEventFormatIssue() {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("Connected to atcloud-signup database");

    const Event = mongoose.model(
      "Event",
      new mongoose.Schema({}, { strict: false, collection: "events" })
    );

    // Get all events with their format data
    const events = await Event.find(
      {},
      { title: 1, format: 1, status: 1, _id: 1 }
    ).sort({ createdAt: 1 });
    console.log("\n=== ALL EVENTS IN DATABASE ===");
    events.forEach((event, index) => {
      console.log(`${index + 1}. "${event.title}"`);
      console.log(
        `   Format: "${event.format}" (type: ${typeof event.format})`
      );
      console.log(
        `   Status: "${event.status}" (type: ${typeof event.status})`
      );
      console.log(`   ID: ${event._id}`);
      console.log("");
    });

    console.log(`Total events found: ${events.length}`);

    // Test format distribution calculation (mimicking frontend logic)
    console.log("\n=== FORMAT DISTRIBUTION ANALYSIS ===");
    const formatStats = events.reduce((acc, event) => {
      console.log(`Processing event: "${event.title}"`);
      console.log(`  - event exists: ${!!event}`);
      console.log(`  - event.format exists: ${!!event.format}`);
      console.log(`  - event.format value: "${event.format}"`);
      console.log(`  - event.format type: ${typeof event.format}`);

      if (event && event.format) {
        acc[event.format] = (acc[event.format] || 0) + 1;
        console.log(
          `  - Added to formatStats[${event.format}] = ${acc[event.format]}`
        );
      } else {
        console.log(`  - SKIPPED: event or format is falsy`);
      }
      console.log("");
      return acc;
    }, {});

    console.log("Final Format Stats:");
    Object.entries(formatStats).forEach(([format, count]) => {
      console.log(`- "${format}": ${count}`);
    });

    // Check for any events that might have null/undefined/empty formats
    console.log("\n=== PROBLEMATIC EVENTS ===");
    const problematicEvents = events.filter(
      (event) => !event.format || event.format.trim() === ""
    );
    if (problematicEvents.length > 0) {
      console.log("Events with missing/empty formats:");
      problematicEvents.forEach((event) => {
        console.log(
          `- ID: ${event._id}, Title: "${event.title}", Format: "${event.format}"`
        );
      });
    } else {
      console.log("No events with missing formats found.");
    }

    // Check status distribution as well
    console.log("\n=== STATUS DISTRIBUTION ===");
    const statusStats = events.reduce((acc, event) => {
      const status = event.status || "undefined";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(statusStats).forEach(([status, count]) => {
      console.log(`- ${status}: ${count}`);
    });

    // Simulate backend analytics filtering
    console.log("\n=== BACKEND ANALYTICS SIMULATION ===");
    const upcomingEvents = events.filter(
      (event) => event.status && ["upcoming", "ongoing"].includes(event.status)
    );
    const completedEvents = events.filter(
      (event) => event.status && event.status === "completed"
    );

    console.log(`Upcoming/Ongoing events: ${upcomingEvents.length}`);
    upcomingEvents.forEach((event) => {
      console.log(`  - "${event.title}" (${event.format}, ${event.status})`);
    });

    console.log(`Completed events: ${completedEvents.length}`);
    completedEvents.forEach((event) => {
      console.log(`  - "${event.title}" (${event.format}, ${event.status})`);
    });

    console.log(
      `Excluded events: ${
        events.length - upcomingEvents.length - completedEvents.length
      }`
    );
    const excludedEvents = events.filter(
      (event) =>
        !event.status ||
        !["upcoming", "ongoing", "completed"].includes(event.status)
    );
    excludedEvents.forEach((event) => {
      console.log(`  - "${event.title}" (${event.format}, ${event.status})`);
    });
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkEventFormatIssue();
