const mongoose = require("mongoose");

async function checkEvents() {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("Connected to atcloud-signup database");

    const Event = mongoose.model(
      "Event",
      new mongoose.Schema({}, { strict: false, collection: "events" })
    );

    const events = await Event.find(
      {},
      { title: 1, format: 1, status: 1, _id: 1 }
    ).sort({ createdAt: 1 });
    console.log("\nAll Events in Database:");
    console.log("======================");
    events.forEach((event, index) => {
      console.log(`${index + 1}. Event: ${event.title}`);
      console.log(`   Format: ${event.format}`);
      console.log(`   Status: ${event.status || "N/A"}`);
      console.log(`   ID: ${event._id}`);
      console.log("");
    });

    console.log(`Total events found: ${events.length}`);

    // Check format distribution
    const formatStats = events.reduce((acc, event) => {
      if (event && event.format) {
        acc[event.format] = (acc[event.format] || 0) + 1;
      }
      return acc;
    }, {});

    console.log("\nFormat Distribution:");
    Object.entries(formatStats).forEach(([format, count]) => {
      console.log(`- ${format}: ${count}`);
    });

    // Check which events might be filtered out in analytics
    console.log("\nEvent Status Analysis:");
    const statusStats = events.reduce((acc, event) => {
      const status = event.status || "undefined";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(statusStats).forEach(([status, count]) => {
      console.log(`- ${status}: ${count}`);
    });
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkEvents();
