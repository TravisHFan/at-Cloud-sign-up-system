const axios = require("axios");

const BASE_URL = "http://localhost:5001/api/v1";

// Test with different user credentials
const TEST_CREDENTIALS = [
  { username: "john_doe", password: "AdminPassword123!" },
  { username: "admin", password: "AdminPassword123!" },
  { username: "testleader", password: "LeaderPassword123!" },
  { username: "testuser", password: "UserPassword123!" },
];

async function testChatNotification() {
  console.log("🧪 Testing Chat Notification System...\n");

  let authToken = null;
  let userId = null;

  // Try to login with different credentials
  for (const creds of TEST_CREDENTIALS) {
    try {
      console.log(`🔐 Trying login with username: ${creds.username}`);
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        emailOrUsername: creds.username,
        password: creds.password,
      });

      if (loginResponse.data.success) {
        authToken = loginResponse.data.data.token;
        userId = loginResponse.data.data.user.id;
        console.log(`✅ Login successful as ${creds.username} (ID: ${userId})`);
        break;
      }
    } catch (error) {
      console.log(
        `❌ Login failed for ${creds.username}: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  if (!authToken) {
    console.log("❌ Could not login with any credentials");
    return;
  }

  try {
    // Get all users to find someone to send a message to
    console.log("\n👥 Getting all users...");
    const usersResponse = await axios.get(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const allUsers = usersResponse.data.data;
    const recipientUser = allUsers.find((user) => user.id !== userId);

    if (!recipientUser) {
      console.log("❌ No other users found to send message to");
      return;
    }

    console.log(
      `📤 Sending message to user: ${recipientUser.firstName} ${recipientUser.lastName} (${recipientUser.username})`
    );

    // Send a direct message
    const messageResponse = await axios.post(
      `${BASE_URL}/messages`,
      {
        content:
          "Test message for chat notification - this should appear in bell!",
        receiverId: recipientUser.id,
        messageType: "text",
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    if (messageResponse.data.success) {
      console.log("✅ Message sent successfully!");
      console.log("📋 Message ID:", messageResponse.data.data.message._id);

      // Check if notification was created
      console.log("\n🔔 Checking if notification was created...");
      setTimeout(async () => {
        try {
          const notificationsResponse = await axios.get(
            `${BASE_URL}/user/notifications/bell`,
            {
              headers: { Authorization: `Bearer ${authToken}` },
            }
          );

          console.log(
            "📊 Recent notifications:",
            notificationsResponse.data.data.notifications.slice(0, 3)
          );
        } catch (error) {
          console.log(
            "❌ Error checking notifications:",
            error.response?.data?.message || error.message
          );
        }
      }, 1000);
    } else {
      console.log("❌ Failed to send message:", messageResponse.data.message);
    }
  } catch (error) {
    console.error(
      "❌ Test failed:",
      error.response?.data?.message || error.message
    );
  }
}

testChatNotification();
