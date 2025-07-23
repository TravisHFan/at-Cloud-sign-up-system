const mongoose = require("mongoose");
require("dotenv").config();

const main = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://localhost:27017/atcloud-signup-system"
    );
    console.log("Connected to MongoDB");

    const eventsCollection = mongoose.connection.db.collection("events");

    // Find the Test 2 event
    const event = await eventsCollection.findOne({
      title: { $regex: /Test 2/, $options: "i" },
    });

    if (event) {
      console.log("Event found:");
      console.log("Title:", event.title);
      console.log("SignedUp:", event.signedUp);
      console.log("Roles structure:");
      console.log(JSON.stringify(event.roles, null, 2));
    } else {
      console.log("Event not found");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
};

main();
