const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/ministry-platform");
    console.log("✅ Connected to MongoDB");

    // Hash the password
    const hashedPassword = await bcrypt.hash("password123", 12);

    // Create test user
    const userCollection = mongoose.connection.collection("users");

    // Check if user already exists
    const existingUser = await userCollection.findOne({
      email: "test@example.com",
    });
    if (existingUser) {
      console.log("👤 Test user already exists");
      console.log("Email:", existingUser.email);
      console.log("Username:", existingUser.username);
      await mongoose.connection.close();
      return;
    }

    const testUser = {
      username: "testuser",
      email: "test@example.com",
      password: hashedPassword,
      firstName: "Test",
      lastName: "User",
      gender: "male",
      isAtCloudLeader: false,
      role: "Participant",
      isActive: true,
      isVerified: true,
      emailNotifications: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await userCollection.insertOne(testUser);
    console.log("✅ Test user created with ID:", result.insertedId);
    console.log("Email: test@example.com");
    console.log("Password: password123");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

createTestUser();
