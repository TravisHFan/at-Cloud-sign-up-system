import mongoose from "mongoose";
import dotenv from "dotenv";
import InAppNotification from "../models/InAppNotification";
import { User } from "../models";

// Load environment variables
dotenv.config();

const createSampleInAppNotifications = async () => {
  try {
    // Connect to MongoDB
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB");

    // Get users to create notifications for
    const users = await User.find().limit(5);
    if (users.length === 0) {
      console.log("❌ No users found. Please run create-sample-data first.");
      return;
    }

    // Clear existing in-app notifications
    await InAppNotification.deleteMany({});
    console.log("🧹 Cleared existing in-app notifications");

    const sampleNotifications = [];

    // Create notifications for each user
    for (const user of users) {
      // System notifications
      sampleNotifications.push({
        userId: user._id,
        type: "system",
        title: "Welcome to @Cloud!",
        message:
          "Thank you for joining our community. We're excited to have you!",
        isRead: false,
      });

      sampleNotifications.push({
        userId: user._id,
        type: "system",
        title: "System Maintenance Scheduled",
        message:
          "We'll be performing system maintenance on Sunday at 2 AM. Expected downtime: 30 minutes.",
        isRead: false,
      });

      // Management action notification (for non-admin users)
      if (user.role !== "Super Admin") {
        sampleNotifications.push({
          userId: user._id,
          type: "management_action",
          title: "Role Assignment Updated",
          message: "Your role permissions have been reviewed and updated.",
          actionType: "role_change",
          actionDetails: {
            fromRole: "Member",
            toRole: user.role,
            actorName: "System Administrator",
          },
          isRead: false,
        });
      }

      // User message notification
      if (users.length > 1) {
        const otherUser = users.find(
          (u) => (u as any)._id.toString() !== (user as any)._id.toString()
        );
        if (otherUser) {
          sampleNotifications.push({
            userId: user._id,
            type: "user_message",
            title: "New Message",
            message: "Hey, are you available for the event tomorrow?",
            fromUser: {
              id: (otherUser as any)._id.toString(),
              firstName: otherUser.firstName || "John",
              lastName: otherUser.lastName || "Doe",
              username: otherUser.username,
              avatar: otherUser.avatar,
              gender: otherUser.gender || "male",
            },
            isRead: false,
          });
        }
      }

      // Some read notifications
      sampleNotifications.push({
        userId: user._id,
        type: "system",
        title: "Event Registration Confirmed",
        message:
          "Your registration for Tech Innovation Summit has been confirmed.",
        isRead: true,
      });
    }

    // Insert notifications
    const createdNotifications = await InAppNotification.insertMany(
      sampleNotifications
    );
    console.log(
      `🎉 Created ${createdNotifications.length} sample in-app notifications`
    );

    // Display sample of created notifications
    const samplesByUser = createdNotifications.slice(0, 5);
    samplesByUser.forEach((notif, index) => {
      console.log(
        `${index + 1}. [${notif.type}] ${notif.title} (Read: ${notif.isRead})`
      );
    });
  } catch (error) {
    console.error("❌ Error creating sample in-app notifications:", error);
  } finally {
    mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
};

createSampleInAppNotifications();
