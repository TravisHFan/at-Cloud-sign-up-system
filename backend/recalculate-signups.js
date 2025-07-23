// Script to recalculate signedUp values for all events
// This should be run after updating the calculateSignedUp method

const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// Import Event model (assuming the path)
const Event = require("../src/models/Event").Event;

async function recalculateSignedUpCounts() {
  try {
    console.log("Starting signedUp count recalculation...");

    // Get all events
    const events = await Event.find({});
    console.log(`Found ${events.length} events to update`);

    let updatedCount = 0;

    for (const event of events) {
      const oldSignedUp = event.signedUp;
      const newSignedUp = event.calculateSignedUp();

      if (oldSignedUp !== newSignedUp) {
        event.signedUp = newSignedUp;
        await event.save();
        console.log(
          `Updated "${event.title}": ${oldSignedUp} -> ${newSignedUp}`
        );
        updatedCount++;
      }
    }

    console.log(`Recalculation complete. Updated ${updatedCount} events.`);
    process.exit(0);
  } catch (error) {
    console.error("Error recalculating signedUp counts:", error);
    process.exit(1);
  }
}

recalculateSignedUpCounts();
