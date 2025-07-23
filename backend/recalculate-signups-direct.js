const mongoose = require("mongoose");
require("dotenv").config();

// Simple direct MongoDB script to recalculate signups
const main = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://localhost:27017/atcloud-signup-system"
    );
    console.log("Connected to MongoDB");

    // Get Events collection
    const eventsCollection = mongoose.connection.db.collection("events");

    // Find all events
    const events = await eventsCollection.find({}).toArray();
    console.log(`Found ${events.length} events`);

    let updatedCount = 0;

    for (const event of events) {
      // Calculate signup count based on roles
      let totalSignedUp = 0;
      if (event.roles && Array.isArray(event.roles)) {
        for (const role of event.roles) {
          if (role.currentSignups && Array.isArray(role.currentSignups)) {
            totalSignedUp += role.currentSignups.length;
          }
        }
      }

      // Update if different
      if (event.signedUp !== totalSignedUp) {
        await eventsCollection.updateOne(
          { _id: event._id },
          { $set: { signedUp: totalSignedUp } }
        );
        console.log(
          `Updated event "${event.title}": ${event.signedUp} -> ${totalSignedUp}`
        );
        updatedCount++;
      }
    }

    console.log(`\nRecalculation complete! Updated ${updatedCount} events.`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
};

main();
