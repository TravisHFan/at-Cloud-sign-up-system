const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// User schema matching the actual User model
const userSchema = new mongoose.Schema(
  {
    // Basic Authentication
    username: String,
    email: String,
    phone: String,
    password: String,

    // Profile Information
    firstName: String,
    lastName: String,
    gender: { type: String, enum: ["male", "female"] },
    avatar: String,

    // Address Information
    homeAddress: String,

    // @Cloud Ministry Specific Fields
    isAtCloudLeader: Boolean,
    roleInAtCloud: String,

    // Professional Information
    occupation: String,
    company: String,
    weeklyChurch: String,
    churchAddress: String,

    // System Authorization
    role: String,

    // Account Status
    isActive: Boolean,
    isVerified: Boolean,

    // Contact Preferences
    emailNotifications: Boolean,
    smsNotifications: Boolean,
    pushNotifications: Boolean,
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

async function createLisaUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    // Check if user already exists and delete it for fresh test
    const existingUser = await User.findOne({
      $or: [{ email: "lisa@atcloud.com" }, { username: "lisa_anderson" }],
    });
    if (existingUser) {
      await User.deleteOne({
        $or: [{ email: "lisa@atcloud.com" }, { username: "lisa_anderson" }],
      });
      console.log("🗑️ Deleted existing Lisa user");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("password123", 12);

    // Create user with correct schema fields
    const user = new User({
      username: "lisa_anderson",
      email: "lisa@atcloud.com",
      password: hashedPassword,
      firstName: "Lisa",
      lastName: "Anderson",
      gender: "female",
      phone: "+1-555-8888",
      isAtCloudLeader: false,
      roleInAtCloud: "Member",
      homeAddress: "456 Oak Street, Test City, ST 54321",
      occupation: "Designer",
      company: "Design Studio Inc",
      weeklyChurch: "@Cloud Ministry",
      churchAddress: "456 Church Ave, Faith City, ST 67890",
      role: "user", // System role
      isActive: true,
      isVerified: true,
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
    });

    await user.save();
    console.log("🎉 Lisa user created successfully!");
    console.log("📋 Credentials:");
    console.log("   Email: lisa@atcloud.com");
    console.log("   Password: password123");
    console.log("");
    console.log("🧪 This is a fresh user for testing welcome message fixes");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
    process.exit(0);
  }
}

createLisaUser();
