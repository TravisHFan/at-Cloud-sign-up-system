const mongoose = require("mongoose");

async function findAnyUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/ministry-platform");
    console.log("✅ Connected to MongoDB");

    const userCollection = mongoose.connection.collection("users");

    // Get total count
    const count = await userCollection.countDocuments();
    console.log("Total users in collection:", count);

    // Get any users
    const users = await userCollection.find({}).limit(10).toArray();
    console.log("👥 All users:");

    if (users.length === 0) {
      console.log("No users found");

      // Let's try all collections to see if there's data anywhere
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();

      for (const collection of collections) {
        const coll = db.collection(collection.name);
        const count = await coll.countDocuments();
        console.log(`Collection ${collection.name}: ${count} documents`);

        if (count > 0 && collection.name !== "users") {
          const sample = await coll.findOne();
          console.log(
            `Sample from ${collection.name}:`,
            Object.keys(sample || {})
          );
        }
      }
    } else {
      users.forEach((user, index) => {
        console.log(
          `${index + 1}. Email: ${user.email || "N/A"}, Username: ${
            user.username || "N/A"
          }`
        );
      });
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

findAnyUser();
