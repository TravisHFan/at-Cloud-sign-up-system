import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../../models/User";
import { ROLES } from "../../utils/roleUtils";

// Load environment variables
dotenv.config();

/**
 * Setup Users Script
 *
 * Creates basic test users for local development:
 * - Super Admin: test-admin@example.com / AdminPassword123!
 * - Leader: test-leader@example.com / LeaderPassword123!
 * - Participant: test-user@example.com / UserPassword123!
 *
 * Usage: npm run setup-users
 */

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);

    console.log("📝 Setting up test users...");

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ role: ROLES.SUPER_ADMIN });
    if (existingAdmin) {
      console.log("ℹ️  Super Admin already exists, skipping...");
      return;
    }

    // Create admin user
    const adminUser = new User({
      username: "testadmin",
      email: "test-admin@example.com",
      password: "AdminPassword123!",
      firstName: "Test",
      lastName: "Administrator",
      gender: "male",
      isAtCloudLeader: true,
      roleInAtCloud: "IT Director",
      occupation: "System Administrator",
      company: "@Cloud Ministry",
      weeklyChurch: "@Cloud Ministry",
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      isVerified: true,
    });

    await adminUser.save();
    console.log(
      "✅ Created Super Admin: test-admin@example.com / AdminPassword123!"
    );
  } catch (error: any) {
    console.error("❌ Error creating admin user:", error.message);

    if (error.code === 11000) {
      console.log("ℹ️  User already exists (duplicate key)");
    }
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Also create a test leader user
const createTestUsers = async () => {
  try {
    // Connect to MongoDB
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);

    // Create test leader user
    const existingLeader = await User.findOne({ username: "testleader" });
    if (!existingLeader) {
      const leaderUser = new User({
        username: "testleader",
        email: "test-leader@example.com",
        password: "LeaderPassword123!",
        firstName: "John",
        lastName: "Leader",
        gender: "male",
        isAtCloudLeader: true,
        roleInAtCloud: "Ministry Leader",
        occupation: "Pastor",
        company: "@Cloud Ministry",
        weeklyChurch: "@Cloud Ministry",
        role: ROLES.LEADER,
        isActive: true,
        isVerified: true,
      });

      await leaderUser.save();
      console.log(
        "✅ Created Leader: test-leader@example.com / LeaderPassword123!"
      );
    } else {
      console.log("ℹ️  Leader user already exists, skipping...");
    }

    // Create test participant user
    const existingParticipant = await User.findOne({ username: "testuser" });
    if (!existingParticipant) {
      const participantUser = new User({
        username: "testuser",
        email: "test-user@example.com",
        password: "UserPassword123!",
        firstName: "Jane",
        lastName: "Participant",
        gender: "female",
        isAtCloudLeader: false,
        occupation: "Software Developer",
        company: "Tech Company",
        weeklyChurch: "@Cloud Ministry",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      await participantUser.save();
      console.log(
        "✅ Created Participant: test-user@example.com / UserPassword123!"
      );
    } else {
      console.log("ℹ️  Participant user already exists, skipping...");
    }
  } catch (error: any) {
    console.error("❌ Error creating test users:", error.message);
  } finally {
    await mongoose.connection.close();
  }
};

// Main execution
const main = async () => {
  console.log("🚀 Starting user setup script...\n");
  await createAdminUser();
  console.log("\n🚀 Creating additional test users...\n");
  await createTestUsers();
  console.log("\n✨ User setup complete!");
};

main();
