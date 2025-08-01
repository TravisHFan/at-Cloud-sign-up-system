const mongoose = require("mongoose");

async function deleteTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/ministry-platform");
    console.log("✅ Connected to MongoDB");

    const userCollection = mongoose.connection.collection("users");
    const result = await userCollection.deleteOne({
      email: "test@example.com",
    });

    console.log(`🗑️ Deleted ${result.deletedCount} user(s)`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

deleteTestUser();
