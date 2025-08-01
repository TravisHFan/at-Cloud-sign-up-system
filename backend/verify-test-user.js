const mongoose = require("mongoose");

async function verifyTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/ministry-platform");
    console.log("✅ Connected to MongoDB");

    const userCollection = mongoose.connection.collection("users");
    const result = await userCollection.updateOne(
      { email: "test@example.com" },
      {
        $set: {
          isVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      }
    );

    console.log(
      `✅ Updated ${result.modifiedCount} user(s) - User is now verified`
    );

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

verifyTestUser();
