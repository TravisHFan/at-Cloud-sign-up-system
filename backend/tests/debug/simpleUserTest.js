const mongoose = require("mongoose");
const path = require("path");

// Load environment
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function testUserCreation() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-test"
    );
    console.log("Connected to MongoDB successfully");

    // Import User model using dynamic import to handle ES modules
    const userModule = await import("../../src/models/User.js");
    const User = userModule.default;

    const rolesModule = await import("../../src/utils/roleUtils.js");
    const { ROLES } = rolesModule;

    console.log("Models imported successfully");
    console.log("Available roles:", ROLES);

    // Clear any existing test users
    await User.deleteMany({ email: { $regex: "test\\.com$" } });
    console.log("Cleared existing test users");

    console.log("Creating test user...");
    const testUser = await User.create({
      username: "testuser123",
      firstName: "Test",
      lastName: "User",
      email: "testuser123@test.com",
      password: "Password123",
      role: ROLES.PARTICIPANT,
      phoneNumber: "1234567890",
      dateOfBirth: new Date("1990-01-01"),
      isActive: true,
      isVerified: true,
    });

    console.log("User created successfully:", {
      id: testUser._id,
      username: testUser.username,
      email: testUser.email,
      role: testUser.role,
    });

    await mongoose.connection.close();
    console.log("Test completed successfully");
  } catch (error) {
    console.error("Error during test:", error);
    process.exit(1);
  }
}

testUserCreation();
