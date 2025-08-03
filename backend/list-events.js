/**
 * Simple script to list all events in the database
 */

const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;

mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function listEvents() {
  try {
    const events = await Event.find({})
      .select("title eventId signedUp eventDate createdAt")
      .limit(20);

    console.log(`Found ${events.length} events:\n`);

    events.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title}`);
      console.log(`   Event ID: ${event.eventId}`);
      console.log(`   MongoDB _id: ${event._id}`);
      console.log(`   Signed Up: ${event.signedUp || 0}`);
      console.log(`   Event Date: ${event.eventDate}`);
      console.log(`   Created: ${event.createdAt}\n`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

listEvents();
