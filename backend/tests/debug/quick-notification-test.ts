/**
 * Quick Test: UserController Role Update with Notifications
 */

import dotenv from "dotenv";
import { connectDatabase } from "../../src/models";
import { AutoEmailNotificationService } from "../../src/services/infrastructure/autoEmailNotificationService";

dotenv.config();

async function quickNotificationTest() {
  console.log("🧪 Quick Notification Test...\n");

  try {
    await connectDatabase();
    console.log("✅ Database connected");

    // Test data simulating John Doe promoting Ruth Fan
    const result =
      await AutoEmailNotificationService.sendRoleChangeNotification({
        userData: {
          _id: "507f1f77bcf86cd799439011",
          firstName: "Ruth",
          lastName: "Fan",
          email: "ruth.fan@atcloud.org",
          oldRole: "Leader",
          newRole: "Administrator",
        },
        changedBy: {
          _id: "507f1f77bcf86cd799439012",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@atcloud.org",
          role: "Super Admin",
        },
        reason: "Role changed by John Doe",
        isPromotion: true,
      });

    console.log("\n📊 Results:");
    console.log(`   📧 Emails Sent: ${result.emailsSent}`);
    console.log(`   💬 Messages Created: ${result.messagesCreated}`);
    console.log(`   ✅ Success: ${result.success}`);

    if (result.success && result.messagesCreated > 0) {
      console.log("\n🎉 SUCCESS: AutoEmailNotificationService is working!");
      console.log(
        "   ✅ This means the UserController integration should work too."
      );
    } else {
      console.log("\n❌ ISSUE: Service not working properly");
    }
  } catch (error: any) {
    console.error("❌ Test failed:", error?.message || error);
  } finally {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(0);
  }
}

quickNotificationTest().catch(console.error);
