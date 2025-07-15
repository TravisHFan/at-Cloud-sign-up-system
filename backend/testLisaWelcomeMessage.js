const mongoose = require("mongoose");
const axios = require("axios");

async function testLisaWelcomeMessage() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    // Login as Lisa to get her token
    console.log("🔐 Logging in as Lisa...");
    const lisaLoginResponse = await axios.post(
      "http://localhost:5001/api/v1/auth/login",
      {
        emailOrUsername: "lisa@atcloud.com",
        password: "password123",
      }
    );

    if (!lisaLoginResponse.data.success) {
      throw new Error("Lisa login failed: " + lisaLoginResponse.data.message);
    }

    const lisaToken = lisaLoginResponse.data.data.accessToken;
    const lisaUserId = lisaLoginResponse.data.data.user.id;
    console.log("✅ Lisa login successful! User ID:", lisaUserId);

    // Test creating a welcome message for Lisa using auto endpoint
    console.log("📨 Testing Lisa's welcome message creation...");
    const welcomeMessageData = {
      title: "🎉 Welcome to @Cloud Event Management System!",
      content: `Hello Lisa! Welcome to the @Cloud Event Management System. We're excited to have you join our community! Here you can discover upcoming events, connect with other members, and participate in exciting activities. Feel free to explore the platform and don't hesitate to reach out if you need any assistance. Happy networking!`,
      type: "announcement",
      priority: "high",
      targetUserId: lisaUserId, // Target specifically to Lisa
      creator: {
        id: "super-admin-id",
        name: "Super Admin",
        email: "admin@atcloud.com",
      },
    };

    const messageResponse = await axios.post(
      "http://localhost:5001/api/v1/system-messages/auto",
      welcomeMessageData,
      {
        headers: {
          Authorization: `Bearer ${lisaToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (messageResponse.data.success) {
      console.log("🎉 Lisa's welcome message created successfully!");
      console.log(
        "Target User ID:",
        messageResponse.data.data.systemMessage.targetUserId
      );
    } else {
      console.error(
        "❌ Failed to create Lisa's welcome message:",
        messageResponse.data.message
      );
    }

    // Verify Lisa can see her welcome message
    console.log("🔍 Checking Lisa's system messages...");
    const lisaMessagesResponse = await axios.get(
      "http://localhost:5001/api/v1/system-messages",
      {
        headers: {
          Authorization: `Bearer ${lisaToken}`,
        },
      }
    );

    if (lisaMessagesResponse.data.success) {
      const lisaMessages = lisaMessagesResponse.data.data.systemMessages;
      const lisaWelcomeMessage = lisaMessages.find(
        (msg) =>
          msg.title.includes("Welcome") && msg.targetUserId === lisaUserId
      );
      if (lisaWelcomeMessage) {
        console.log("✅ Lisa can see her welcome message!");
        console.log("- Title:", lisaWelcomeMessage.title);
        console.log("- Target User ID:", lisaWelcomeMessage.targetUserId);
        console.log("- Is Read:", lisaWelcomeMessage.isRead);
      } else {
        console.log("❌ Lisa cannot see her welcome message");
        console.log("Available messages for Lisa:", lisaMessages.length);
        lisaMessages.forEach((msg) => {
          console.log(`  - "${msg.title}" (targetUserId: ${msg.targetUserId})`);
        });
      }
    }

    // Login as Sarah to test if she can see Lisa's welcome message (she shouldn't)
    console.log("\n🔐 Logging in as Sarah to test privacy...");
    const sarahLoginResponse = await axios.post(
      "http://localhost:5001/api/v1/auth/login",
      {
        emailOrUsername: "sarah@atcloud.com",
        password: "password123",
      }
    );

    if (sarahLoginResponse.data.success) {
      const sarahToken = sarahLoginResponse.data.data.accessToken;
      const sarahUserId = sarahLoginResponse.data.data.user.id;
      console.log("✅ Sarah login successful! User ID:", sarahUserId);

      // Check if Sarah can see Lisa's welcome message (she shouldn't)
      const sarahMessagesResponse = await axios.get(
        "http://localhost:5001/api/v1/system-messages",
        {
          headers: {
            Authorization: `Bearer ${sarahToken}`,
          },
        }
      );

      if (sarahMessagesResponse.data.success) {
        const sarahMessages = sarahMessagesResponse.data.data.systemMessages;
        const lisaWelcomeInSarahList = sarahMessages.find(
          (msg) =>
            msg.title.includes("Welcome") && msg.targetUserId === lisaUserId
        );

        if (lisaWelcomeInSarahList) {
          console.log(
            "❌ BUG: Sarah can see Lisa's welcome message (she shouldn't!)"
          );
          console.log("- Title:", lisaWelcomeInSarahList.title);
          console.log("- Target User ID:", lisaWelcomeInSarahList.targetUserId);
        } else {
          console.log("✅ CORRECT: Sarah cannot see Lisa's welcome message");
        }

        console.log(`Sarah sees ${sarahMessages.length} total system messages`);
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

testLisaWelcomeMessage();
