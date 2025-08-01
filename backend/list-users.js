const mongoose = require("mongoose");

async function listUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/ministry-platform");
    console.log("✅ Connected to MongoDB");

    // Get all collections
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    console.log("📁 Collections in database:");
    collections.forEach((col) => console.log(`- ${col.name}`));

    // Try to find users collection
    const userCollection = mongoose.connection.collection("users");
    const users = await userCollection.find({}).limit(5).toArray();

    console.log("\n👥 Users in database:");
    if (users.length === 0) {
      console.log("No users found");
    } else {
      users.forEach((user) => {
        console.log(
          `- Email: ${user.email}, Username: ${user.username}, Name: ${user.firstName} ${user.lastName}`
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

listUsers();
