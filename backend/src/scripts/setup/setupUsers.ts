import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../../models/User";
import { ROLES } from "../../utils/roleUtils";

// Load environment variables
dotenv.config();

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ role: ROLES.SUPER_ADMIN });
    if (existingAdmin) {
      return;
    }

    // Create admin user
    const adminUser = new User({
      username: "admin",
      email: "admin@gmail.com",
      password: "AdminPassword123!",
      firstName: "System",
      lastName: "Administrator",
      gender: "male",
      isAtCloudLeader: true,
      roleInAtCloud: "IT Director",
      occupation: "System Administrator",
      company: "@Cloud Marketplace Ministry",
      weeklyChurch: "@Cloud Ministry",
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      isVerified: true,
    });

    await adminUser.save();
  } catch (error: any) {
    console.error("❌ Error creating admin user:", error);

    if (error.code === 11000) {
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
        email: "leader@gmail.com",
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
    }

    // Create test participant user
    const existingParticipant = await User.findOne({ username: "testuser" });
    if (!existingParticipant) {
      const participantUser = new User({
        username: "testuser",
        email: "user@gmail.com",
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
    }
  } catch (error: any) {
    console.error("❌ Error creating test users:", error);
  } finally {
    await mongoose.connection.close();
  }
};

// Main execution
const main = async () => {
  await createAdminUser();

  await createTestUsers();
};

main();
