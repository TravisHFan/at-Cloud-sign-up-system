import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../../models/index";
import { ROLES } from "../../utils/roleUtils";

// Load environment variables
dotenv.config();

// Function to migrate existing user data to new schema
async function migrateUserSchema() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoUri);

    // Get all existing users
    const users = await User.find({});

    let migratedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Prepare update data with default values for missing fields
        const updateData: any = {};

        // Add missing login attempt tracking
        if ((user as any).loginAttempts === undefined) {
          updateData.loginAttempts = 0;
        }

        // Ensure role exists and is valid
        if (
          !(user as any).role ||
          !Object.values(ROLES).includes((user as any).role)
        ) {
          updateData.role = ROLES.PARTICIPANT; // Default role
        }

        // Ensure isActive exists
        if ((user as any).isActive === undefined) {
          updateData.isActive = true;
        }

        // Ensure isVerified exists
        if ((user as any).isVerified === undefined) {
          updateData.isVerified = false;
        }

        // Ensure isAtCloudLeader exists
        if ((user as any).isAtCloudLeader === undefined) {
          updateData.isAtCloudLeader = false;
        }

        // Set default avatar based on gender if missing
        if (!(user as any).avatar) {
          if ((user as any).gender === "female") {
            updateData.avatar = "/default-avatar-female.jpg";
          } else {
            updateData.avatar = "/default-avatar-male.jpg";
          }
        }

        // Only update if there are fields to update
        if (Object.keys(updateData).length > 0) {
          await User.updateOne(
            { _id: (user as any)._id },
            { $set: updateData }
          );
          migratedCount++;
        } else {
        }
      } catch (error) {
        console.error(
          `❌ Error migrating user ${
            (user as any).username || (user as any).email
          }:`,
          error
        );
        errorCount++;
      }
    }

    // Verify the migration

    // Test schema completeness
    const incompleteUsers = await User.find({
      $or: [
        { loginAttempts: { $exists: false } },
        { isActive: { $exists: false } },
        { isVerified: { $exists: false } },
        { isAtCloudLeader: { $exists: false } },
        { role: { $exists: false } },
      ],
    });

    if (incompleteUsers.length === 0) {
      console.log("✅ All users have complete schema");
    } else {
      console.log(`⚠️  Found ${incompleteUsers.length} users with incomplete schema`);
      incompleteUsers.forEach((user: any) => {
        console.log(`   - User: ${user.username || user.email}`);
      });
    }

    // Show final user statistics
    const userCount = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: ROLES.SUPER_ADMIN });
    const adminUserCount = await User.countDocuments({
      role: ROLES.ADMINISTRATOR,
    });
    const leaderCount = await User.countDocuments({ role: ROLES.LEADER });
    const participantCount = await User.countDocuments({
      role: ROLES.PARTICIPANT,
    });
    const activeCount = await User.countDocuments({ isActive: true });
    const verifiedCount = await User.countDocuments({ isVerified: true });
  } catch (error) {
    console.error("❌ Error during migration:", error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
  }
}

// Export the function and run if this file is executed directly
export { migrateUserSchema };

if (require.main === module) {
  migrateUserSchema()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    });
}
