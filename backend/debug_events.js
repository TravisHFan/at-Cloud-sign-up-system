// Debug script to check events in database
import mongoose from "mongoose";
import Event from "./src/models/Event.js";

async function checkEvents() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-test"
    );

    const events = await Event.find({});
    console.log("All events:");
    events.forEach((event) => {
      console.log(`- ${event.title}: maxParticipants=${event.maxParticipants}`);
    });

    const eventsWithMin100 = await Event.find({
      maxParticipants: { $gte: 100 },
    });
    console.log("\nEvents with maxParticipants >= 100:");
    eventsWithMin100.forEach((event) => {
      console.log(`- ${event.title}: maxParticipants=${event.maxParticipants}`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

checkEvents();
