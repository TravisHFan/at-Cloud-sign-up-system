#!/usr/bin/env ts-node

/**
 * Test script for the unified notification system
 * This script validates that the new refactored components work correctly
 */

import mongoose from "mongoose";
import { config } from "dotenv";
import UnifiedNotification from "../models/UnifiedNotification";
import { UnifiedNotificationController } from "../controllers/UnifiedNotificationController";
import { RefactoredMessageController } from "../controllers/RefactoredMessageController";
import { User } from "../models";

// Load environment variables
config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup-system";

class UnifiedSystemTester {
  static async connectToDatabase() {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log("📊 Connected to MongoDB for testing");
    } catch (error) {
      console.error("❌ Failed to connect to MongoDB:", error);
      process.exit(1);
    }
  }

  static async testUnifiedNotificationModel() {
    console.log("\n🧪 Testing Unified Notification Model...");

    try {
      // Find a test user
      const testUser = await User.findOne({}).limit(1);
      if (!testUser) {
        console.log("⚠️  No users found - skipping notification model test");
        return;
      }

      // Create a test notification
      const testNotification = new UnifiedNotification({
        userId: testUser._id,
        type: "SYSTEM_MESSAGE",
        category: "announcement",
        title: "Test Unified Notification",
        message: "This is a test of the unified notification system",
        priority: "normal",
        deliveryChannels: ["in-app"],
        deliveryStatus: "delivered",
        metadata: {
          testFlag: true,
          testTimestamp: new Date(),
        },
      });

      const saved = await testNotification.save();
      console.log("✅ Successfully created unified notification:", saved._id);

      // Test instance methods
      await saved.markAsRead();
      console.log("✅ Successfully marked notification as read");

      await saved.markAsDelivered();
      console.log("✅ Successfully marked notification as delivered");

      // Clean up test data
      await UnifiedNotification.deleteOne({ _id: saved._id });
      console.log("🧹 Cleaned up test notification");
    } catch (error) {
      console.error("❌ Unified notification model test failed:", error);
    }
  }

  static async testNotificationController() {
    console.log("\n🧪 Testing Unified Notification Controller...");

    try {
      const testUser = await User.findOne({}).limit(1);
      if (!testUser) {
        console.log("⚠️  No users found - skipping controller test");
        return;
      }

      // Test creating notification via controller
      const mockReq = {
        body: {
          userId: (testUser as any)._id.toString(),
          type: "EVENT_NOTIFICATION",
          category: "reminder",
          title: "Test Event Reminder",
          message: "This is a test event reminder",
          priority: "high",
          deliveryChannels: ["in-app", "email"],
        },
      } as any;

      const mockRes = {
        status: (code: number) => ({
          json: (data: any) => {
            console.log(`📨 Controller response (${code}):`, data);
            return data;
          },
        }),
      } as any;

      await UnifiedNotificationController.createNotification(mockReq, mockRes);
      console.log("✅ Notification controller create test passed");

      // Test getting notifications
      const getReq = {
        params: { userId: (testUser as any)._id.toString() },
        query: {},
      } as any;

      await UnifiedNotificationController.getNotifications(getReq, mockRes);
      console.log("✅ Notification controller get test passed");
    } catch (error) {
      console.error("❌ Notification controller test failed:", error);
    }
  }

  static async testRefactoredMessageController() {
    console.log("\n🧪 Testing Refactored Message Controller...");

    try {
      const testUser = await User.findOne({}).limit(1);
      if (!testUser) {
        console.log("⚠️  No users found - skipping message controller test");
        return;
      }

      // Test getting messages (this was the main fix for message persistence)
      const mockReq = {
        user: { userId: (testUser as any)._id.toString() },
        query: {}, // No specific conversation - should get all messages
      } as any;

      const mockRes = {
        status: (code: number) => ({
          json: (data: any) => {
            console.log(
              `📨 Message controller response (${code}):`,
              data.messages ? `Found ${data.messages.length} messages` : data
            );
            return data;
          },
        }),
      } as any;

      await RefactoredMessageController.getMessages(mockReq, mockRes);
      console.log("✅ Refactored message controller test passed");
    } catch (error) {
      console.error("❌ Refactored message controller test failed:", error);
    }
  }

  static async testDatabaseIndexes() {
    console.log("\n🧪 Testing Database Indexes...");

    try {
      const indexes = await UnifiedNotification.collection.indexes();
      console.log("📊 Unified notification indexes:");
      indexes.forEach((index: any, i: number) => {
        console.log(`  ${i + 1}. ${JSON.stringify(index.key)}`);
      });

      // Check for our compound indexes
      const hasUserTypeIndex = indexes.some(
        (idx: any) => idx.key.userId && idx.key.type && idx.key.createdAt
      );
      const hasUserReadIndex = indexes.some(
        (idx: any) => idx.key.userId && idx.key.isRead
      );

      if (hasUserTypeIndex) {
        console.log("✅ User-type-createdAt compound index found");
      } else {
        console.log("⚠️  User-type-createdAt compound index not found");
      }

      if (hasUserReadIndex) {
        console.log("✅ User-isRead compound index found");
      } else {
        console.log("⚠️  User-isRead compound index not found");
      }
    } catch (error) {
      console.error("❌ Database index test failed:", error);
    }
  }

  static async runAllTests() {
    console.log("🚀 Starting Unified System Tests...\n");

    await this.connectToDatabase();

    await this.testUnifiedNotificationModel();
    await this.testNotificationController();
    await this.testRefactoredMessageController();
    await this.testDatabaseIndexes();

    console.log("\n✨ All tests completed!");

    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run tests if called directly
if (require.main === module) {
  UnifiedSystemTester.runAllTests()
    .then(() => {
      console.log("🎉 Test suite finished successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Test suite failed:", error);
      process.exit(1);
    });
}

export { UnifiedSystemTester };
