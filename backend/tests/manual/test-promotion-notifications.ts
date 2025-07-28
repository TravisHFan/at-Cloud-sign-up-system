/**
 * Manual Test Script for Promotion Notifications
 *
 * This script tests both Pattern 1 and Pattern 2 implementation:
 * - Pattern 1: sendPromotionNotificationToUser()
 * - Pattern 2: sendPromotionNotificationToAdmins()
 *
 * Run with: npx ts-node tests/manual/test-promotion-notifications.ts
 */

import { EmailService } from "../../src/services/infrastructure/emailService";

async function testPromotionNotifications() {
  console.log("🧪 Testing Promotion Notification System...\n");

  // Test data
  const userData = {
    _id: "test-user-123",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    oldRole: "Participant",
    newRole: "Leader",
  };

  const changedBy = {
    firstName: "Admin",
    lastName: "User",
    email: "admin@atcloud.org",
    role: "Administrator",
  };

  try {
    // Test Pattern 1: User Promotion Notification
    console.log("📧 Testing Pattern 1: User Promotion Notification...");
    const userResult = await EmailService.sendPromotionNotificationToUser(
      userData.email,
      userData,
      changedBy
    );
    console.log(`✅ Pattern 1 Result: ${userResult ? "SUCCESS" : "FAILED"}`);

    // Test Pattern 2: Admin Promotion Notification
    console.log("\n📧 Testing Pattern 2: Admin Promotion Notification...");
    const adminResult = await EmailService.sendPromotionNotificationToAdmins(
      "admin@atcloud.org",
      "Admin User",
      userData,
      changedBy
    );
    console.log(`✅ Pattern 2 Result: ${adminResult ? "SUCCESS" : "FAILED"}`);

    // Summary
    console.log("\n🎉 Test Summary:");
    console.log(
      `   Pattern 1 (User Notification): ${userResult ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `   Pattern 2 (Admin Notification): ${
        adminResult ? "✅ PASS" : "❌ FAIL"
      }`
    );

    if (userResult && adminResult) {
      console.log(
        "\n🎯 All promotion notification patterns are working correctly!"
      );
      console.log(
        "🚀 Ready to proceed with Pattern 3 (Demotion Notifications)"
      );
    } else {
      console.log(
        "\n⚠️  Some patterns failed. Check email configuration and logs."
      );
    }
  } catch (error) {
    console.error("❌ Test failed with error:", error);
  }
}

// Run the test
testPromotionNotifications();
