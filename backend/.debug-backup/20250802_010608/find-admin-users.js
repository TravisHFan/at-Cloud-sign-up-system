/**
 * Find Admin Users
 * This script finds all admin users in the database
 */

const mongoose = require("mongoose");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/atCloudSignUp");

// User model schema to match the existing one
const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: String,
    role: String,
    authLevel: String,
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

async function findAdminUsers() {
  try {
    console.log("🔍 FINDING ADMIN USERS");
    console.log("======================");

    // Find all users with admin-like roles
    const adminUsers = await User.find({
      $or: [
        { role: /admin/i },
        { authLevel: /admin/i },
        { role: /super/i },
        { authLevel: /super/i },
      ],
    })
      .select("_id firstName lastName email role authLevel")
      .limit(10);

    console.log(`\n📊 Found ${adminUsers.length} admin users:`);

    if (adminUsers.length > 0) {
      adminUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.firstName} ${user.lastName}`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Auth Level: ${user.authLevel}`);
      });
    } else {
      console.log("❌ No admin users found");

      // Let's check all users to see what's available
      console.log("\n🔍 Checking all users...");
      const allUsers = await User.find({})
        .select("firstName lastName role authLevel")
        .limit(10);

      console.log(`\n📊 First 10 users in database:`);
      allUsers.forEach((user, index) => {
        console.log(
          `   ${index + 1}. ${user.firstName} ${user.lastName} - Role: ${
            user.role || "N/A"
          } - AuthLevel: ${user.authLevel || "N/A"}`
        );
      });
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the search
findAdminUsers();
