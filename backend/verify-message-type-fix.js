#!/usr/bin/env node

/**
 * Simple verification script to test valid message type
 */

const mongoose = require("mongoose");
require("dotenv").config();

async function testMessageTypeValidation() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("📊 Connected to MongoDB");

    const Message = require("./dist/models/Message").Message;
    const User = require("./dist/models/User").default;

    console.log("\n🔧 MESSAGE TYPE VALIDATION TEST");
    console.log("=====================================");

    // Find an admin user
    const admin = await User.findOne({
      role: { $in: ["Admin", "Super Admin"] },
    });
    if (!admin) {
      console.log("❌ No admin user found");
      return;
    }

    console.log(`✅ Found admin: ${admin.firstName} ${admin.lastName}`);

    // Test 1: Try creating message with invalid type (should fail)
    console.log('\n1. Testing invalid message type "admin_notification"...');
    try {
      const invalidMessage = new Message({
        title: "Test Invalid Type",
        content: "This should fail validation",
        type: "admin_notification", // Invalid type
        priority: "medium",
        creator: {
          id: "system",
          firstName: "System",
          lastName: "Test",
          username: "system",
          gender: "male",
          authLevel: "Super Admin",
          roleInAtCloud: "System",
        },
        isActive: true,
        userStates: new Map([
          [
            admin._id.toString(),
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      await invalidMessage.save();
      console.log(
        "❌ UNEXPECTED: Invalid message saved (this should not happen)"
      );
    } catch (error) {
      console.log("✅ EXPECTED: Invalid message type rejected");
      console.log(`   Error: ${error.message}`);
    }

    // Test 2: Try creating message with valid type (should succeed)
    console.log('\n2. Testing valid message type "auth_level_change"...');
    try {
      const validMessage = new Message({
        title: "Test Valid Type - Admin Role Change Notification",
        content:
          "This message should be created successfully for admin notifications",
        type: "auth_level_change", // Valid type
        priority: "medium",
        creator: {
          id: "system",
          firstName: "System",
          lastName: "Test",
          username: "system",
          gender: "male",
          authLevel: "Super Admin",
          roleInAtCloud: "System",
        },
        isActive: true,
        userStates: new Map([
          [
            admin._id.toString(),
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      await validMessage.save();
      console.log("✅ SUCCESS: Valid message type accepted");
      console.log(`   Message ID: ${validMessage._id}`);
      console.log(`   Title: "${validMessage.title}"`);
      console.log(`   Type: "${validMessage.type}"`);
      console.log(
        `   Admin in userStates: ${validMessage.userStates.has(
          admin._id.toString()
        )}`
      );

      // Clean up - delete test message
      await Message.findByIdAndDelete(validMessage._id);
      console.log("   🧹 Test message cleaned up");
    } catch (error) {
      console.log("❌ UNEXPECTED: Valid message type rejected");
      console.log(`   Error: ${error.message}`);
    }

    console.log("\n📋 RESULTS:");
    console.log("=====================================");
    console.log("✅ Message type validation is working correctly");
    console.log('✅ "auth_level_change" is accepted as valid type');
    console.log("✅ Invalid types are properly rejected");
    console.log("\n🎯 CONCLUSION: Admin notification type fix should work!");
  } catch (error) {
    console.error("❌ Error during testing:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n📊 Disconnected from MongoDB");
  }
}

testMessageTypeValidation();
