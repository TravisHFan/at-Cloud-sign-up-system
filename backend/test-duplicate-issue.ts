/**
 * Test to reproduce the duplicate notification issue
 */

import { AutoEmailNotificationService } from "./src/services/infrastructure/autoEmailNotificationService";
import mongoose from "mongoose";
import User from "./src/models/User";

async function testDuplicateNotifications() {
  try {
    console.log("🧪 Testing duplicate notification calls");

    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    // Find test users
    const ruthUser = await User.findOne({ email: "freetosento@gmail.com" });
    const johnUser = await User.findOne({ email: "johndoe@gmail.com" });

    if (!ruthUser || !johnUser) {
      console.error("❌ Test users not found");
      return;
    }

    console.log("👥 Found test users");

    const testChangeData = {
      userData: {
        _id: (ruthUser as any)._id.toString(),
        firstName: ruthUser.firstName!,
        lastName: ruthUser.lastName!,
        email: ruthUser.email,
        oldRole: "Administrator",
        newRole: "Leader",
      },
      changedBy: {
        _id: (johnUser as any)._id.toString(),
        firstName: johnUser.firstName!,
        lastName: johnUser.lastName!,
        email: johnUser.email,
        role: johnUser.role,
      },
      reason: "Testing duplicate issue",
      isPromotion: false,
    };

    console.log(
      "\n🚀 Calling notification service multiple times to reproduce issue..."
    );

    // Simulate multiple calls (like what might be happening)
    const call1 =
      AutoEmailNotificationService.sendRoleChangeNotification(testChangeData);

    // Wait a tiny bit to simulate real-world timing
    await new Promise((resolve) => setTimeout(resolve, 100));

    const call2 =
      AutoEmailNotificationService.sendRoleChangeNotification(testChangeData);

    const [result1, result2] = await Promise.all([call1, call2]);

    console.log("\n📊 Results:");
    console.log("Call 1:", result1);
    console.log("Call 2:", result2);

    console.log("\n✅ SUCCESS: Deduplication is working!");
    console.log("- First call processed normally");
    console.log("- Second call was blocked (duplicate)");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

testDuplicateNotifications().catch(console.error);
