const mongoose = require("mongoose");
const path = require("path");

// We need to compile and import the TypeScript User model
async function createTestUser() {
  try {
    // Use the compiled JavaScript version
    const { spawn } = require("child_process");

    // First compile the TypeScript
    console.log("🔧 Compiling TypeScript...");
    const tsc = spawn(
      "npx",
      [
        "tsc",
        "--target",
        "es2020",
        "--module",
        "commonjs",
        "--esModuleInterop",
        "src/models/User.ts",
        "--outDir",
        "temp",
      ],
      {
        cwd: process.cwd(),
        stdio: "inherit",
      }
    );

    await new Promise((resolve, reject) => {
      tsc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error("TypeScript compilation failed"));
      });
    });

    // Now import and use the User model
    const User = require("./temp/src/models/User.js").default;

    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/ministry-platform");
    console.log("✅ Connected to MongoDB");

    // Check if user already exists
    const existingUser = await User.findOne({ email: "test@example.com" });
    if (existingUser) {
      console.log("👤 Test user already exists");
      console.log("Email:", existingUser.email);
      console.log("Username:", existingUser.username);
      await mongoose.connection.close();
      return;
    }

    // Create test user using the model
    const testUser = new User({
      username: "testuser",
      email: "test@example.com",
      password: "password123", // This will be hashed by the pre-save hook
      firstName: "Test",
      lastName: "User",
      gender: "male",
      isAtCloudLeader: false,
      role: "Participant",
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });

    await testUser.save();
    console.log("✅ Test user created with ID:", testUser._id);
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
