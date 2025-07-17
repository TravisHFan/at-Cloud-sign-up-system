import mongoose from "mongoose";
import SystemMessage, { ISystemMessage } from "../models/SystemMessage";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";

const sampleSystemMessages = [
  {
    title: "Welcome to @Cloud Platform",
    content:
      "Thank you for joining our event management system. Explore upcoming events and connect with your community!",
    type: "announcement",
    priority: "high",
    creator: {
      id: "admin",
      name: "System Admin",
      email: "admin@atcloud.com",
    },
    isActive: true,
    readByUsers: [],
  },
  {
    title: "New Feature: Event Analytics",
    content:
      "We've added comprehensive analytics for event organizers. Check out the new dashboard features!",
    type: "update",
    priority: "medium",
    creator: {
      id: "admin",
      name: "System Admin",
      email: "admin@atcloud.com",
    },
    isActive: true,
    readByUsers: [],
  },
  {
    title: "Scheduled Maintenance",
    content:
      "System maintenance scheduled for Sunday 2AM-4AM EST. Some features may be temporarily unavailable.",
    type: "maintenance",
    priority: "high",
    creator: {
      id: "admin",
      name: "System Admin",
      email: "admin@atcloud.com",
    },
    isActive: true,
    readByUsers: [],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
  },
  {
    title: "Security Enhancement",
    content:
      "We've upgraded our security protocols. Please review your password strength in profile settings.",
    type: "warning",
    priority: "medium",
    creator: {
      id: "admin",
      name: "System Admin",
      email: "admin@atcloud.com",
    },
    isActive: true,
    readByUsers: [],
  },
  {
    title: "Mobile App Update",
    content:
      "Our mobile app has been updated with improved performance and new features. Update now for the best experience!",
    type: "announcement",
    priority: "low",
    creator: {
      id: "admin",
      name: "System Admin",
      email: "admin@atcloud.com",
    },
    isActive: true,
    readByUsers: [],
  },
];

async function createSampleSystemMessages() {
  try {
    await mongoose.connect(MONGODB_URI);

    // Clear existing system messages
    await SystemMessage.deleteMany({});

    // Create new system messages
    const createdMessages = await SystemMessage.insertMany(
      sampleSystemMessages
    );

    createdMessages.forEach((message: any, index: number) => {
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error creating sample system messages:", error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  createSampleSystemMessages();
}

export { createSampleSystemMessages };
