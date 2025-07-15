const mongoose = require("mongoose");
const axios = require("axios");

async function testWelcomeMessage() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    // First, authenticate as the test user to get a token
    console.log("🔐 Logging in as test user...");
    const loginResponse = await axios.post(
      "http://localhost:5001/api/v1/auth/login",
      {
        emailOrUsername: "test@atcloud.com",
        password: "password123",
      }
    );

    if (!loginResponse.data.success) {
      throw new Error("Login failed: " + loginResponse.data.message);
    }

    console.log("Login response:", JSON.stringify(loginResponse.data, null, 2));

    const token = loginResponse.data.data.accessToken;
    const userId = loginResponse.data.data.user.id;
    console.log(
      "✅ Login successful! Token:",
      token ? token.substring(0, 20) + "..." : "No token"
    );

    // Now test creating a welcome message using the auto endpoint
    console.log("📨 Testing welcome message creation...");
    const messageData = {
      title: "🎉 Welcome to @Cloud Event Management System!",
      content: `Hello Test! Welcome to the @Cloud Event Management System. We're excited to have you join our community! Here you can discover upcoming events, connect with other members, and participate in exciting activities. Feel free to explore the platform and don't hesitate to reach out if you need any assistance. Happy networking!`,
      type: "announcement",
      priority: "high",
      targetUserId: userId,
      creator: {
        id: "super-admin-id",
        name: "Super Admin",
        email: "admin@atcloud.com",
      },
    };

    const messageResponse = await axios.post(
      "http://localhost:5001/api/v1/system-messages/auto",
      messageData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (messageResponse.data.success) {
      console.log("🎉 Welcome message created successfully!");
      console.log(
        "Full response:",
        JSON.stringify(messageResponse.data, null, 2)
      );
    } else {
      console.error(
        "❌ Failed to create welcome message:",
        messageResponse.data.message
      );
    }

    // Verify the message was saved to database
    console.log("🔍 Verifying message in database...");
    const getMessagesResponse = await axios.get(
      "http://localhost:5001/api/v1/system-messages",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (getMessagesResponse.data.success) {
      const messages = getMessagesResponse.data.data.systemMessages;
      const welcomeMessage = messages.find((msg) =>
        msg.title.includes("Welcome")
      );
      if (welcomeMessage) {
        console.log("✅ Welcome message found in database!");
        console.log("Title:", welcomeMessage.title);
        console.log(
          "Content preview:",
          welcomeMessage.content.substring(0, 100) + "..."
        );
        console.log("Is Read:", welcomeMessage.isRead);
      } else {
        console.log("❌ Welcome message not found in retrieved messages");
        console.log("Available messages:", messages.length);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
    process.exit(0);
  }
}

testWelcomeMessage();
