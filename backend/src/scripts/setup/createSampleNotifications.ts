import mongoose from "mongoose";
import dotenv from "dotenv";
import Notification from "../models/Notification";
import { User } from "../models";

// Load environment variables
dotenv.config();

const createSampleNotifications = async () => {
  try {
    // Connect to MongoDB
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB");

    // Get a user to create notifications for
    const user = await User.findOne();
    if (!user) {
      console.log("❌ No users found. Please run create-sample-data first.");
      return;
    }

    // Clear existing notifications for this user
    await Notification.deleteMany({ recipient: user._id });
    console.log("🧹 Cleared existing notifications");

    // Create sample notifications
    const sampleNotifications = [
      {
        recipient: user._id,
        type: "in-app",
        category: "system",
        title: "Welcome to @Cloud!",
        message:
          "Thank you for joining our community. We're excited to have you!",
        status: "sent",
        priority: "normal",
        retryCount: 0,
        maxRetries: 3,
      },
      {
        recipient: user._id,
        type: "in-app",
        category: "system",
        title: "Profile Update Reminder",
        message: "Please complete your profile to get the most out of @Cloud.",
        status: "sent",
        priority: "low",
        retryCount: 0,
        maxRetries: 3,
      },
      {
        recipient: user._id,
        type: "in-app",
        category: "registration",
        title: "Event Registration Confirmed",
        message:
          "Your registration for Tech Innovation Summit has been confirmed.",
        status: "read",
        priority: "normal",
        retryCount: 0,
        maxRetries: 3,
        readAt: new Date(),
      },
      {
        recipient: user._id,
        type: "in-app",
        category: "system",
        title: "New Feature Available",
        message:
          "Check out our new chat feature to connect with other members!",
        status: "sent",
        priority: "normal",
        retryCount: 0,
        maxRetries: 3,
      },
    ];

    // Insert notifications
    const createdNotifications = await Notification.insertMany(
      sampleNotifications
    );
    console.log(
      `🎉 Created ${createdNotifications.length} sample notifications`
    );

    // Display created notifications
    createdNotifications.forEach((notif, index) => {
      console.log(`${index + 1}. ${notif.title} (${notif.status})`);
    });
  } catch (error) {
    console.error("❌ Error creating sample notifications:", error);
  } finally {
    mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
};

createSampleNotifications();
