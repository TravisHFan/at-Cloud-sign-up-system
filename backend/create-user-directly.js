const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

async function createUserDirectly() {
  try {
    // Connect to the CORRECT MongoDB database that the backend uses
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB (atcloud-signup database)");

    // Hash password properly
    const hashedPassword = await bcrypt.hash("Password123", 12);
    console.log("🔐 Hashed password created");

    const userCollection = mongoose.connection.collection("users");

    // Delete any existing test user
    await userCollection.deleteMany({ email: "debug@test.com" });

    // Create user document with all required fields
    const user = {
      _id: new mongoose.Types.ObjectId(),
      username: "debuguser",
      email: "debug@test.com",
      password: hashedPassword,
      firstName: "Debug",
      lastName: "User",
      gender: "male",
      isAtCloudLeader: false,
      role: "Participant",
      isActive: true,
      isVerified: true,
      emailNotifications: true,
      loginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    };

    const result = await userCollection.insertOne(user);
    console.log("✅ User created successfully with ID:", result.insertedId);

    // Verify user was created
    const createdUser = await userCollection.findOne({
      email: "debug@test.com",
    });
    console.log("✅ Verification - User found:", !!createdUser);
    console.log("User details:", {
      email: createdUser.email,
      username: createdUser.username,
      isVerified: createdUser.isVerified,
      role: createdUser.role,
    });

    await mongoose.connection.close();
    console.log("\n🎯 Ready to test! Use these credentials:");
    console.log("Email: debug@test.com");
    console.log("Password: Password123");

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

createUserDirectly();
