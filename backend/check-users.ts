import mongoose from "mongoose";
import User from "./src/models/User";
import dotenv from "dotenv";

dotenv.config();

async function checkDatabase() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://localhost:27017/atcloud-signup-system"
    );
    console.log("✅ Connected to MongoDB");

    const users = await User.find({}).select(
      "username email firstName lastName role"
    );
    console.log(`📊 Total users found: ${users.length}\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Role: ${user.role}`);
      console.log("");
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

checkDatabase();
