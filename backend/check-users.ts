import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./src/models";

// Load environment variables
dotenv.config();

async function checkUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("✅ Connected to MongoDB");

    console.log("🔍 Checking all users in database...");

    // Get all users
    const allUsers = await User.find({}).select('username firstName lastName email role createdAt');

    console.log(`📊 Found ${allUsers.length} users in database:`);
    
    for (const user of allUsers) {
      console.log(`👤 ${user.username} (${user.firstName} ${user.lastName}) - ${user.email} - Role: ${user.role} - Created: ${user.createdAt}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

checkUsers();
