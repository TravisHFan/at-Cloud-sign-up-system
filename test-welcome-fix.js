// Test script to verify welcome message fix
const fetch = require("node-fetch");

const BASE_URL = "http://localhost:5001/api/v1";

async function testWelcomeMessageFix() {
  console.log("🧪 Testing Welcome Message Fix...\n");

  try {
    // Test 1: Login as Mike Wilson
    console.log("1. Logging in as Mike Wilson...");
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "mike_wilson",
        password: "Password123!",
      }),
    });

    const loginData = await loginResponse.json();

    if (!loginData.success) {
      console.error("❌ Login failed:", loginData.message);
      return;
    }

    const token = loginData.data.token;
    console.log("✅ Login successful");

    // Test 2: Check welcome message status
    console.log("2. Checking welcome message status...");
    const statusResponse = await fetch(
      `${BASE_URL}/system-messages/welcome-status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const statusData = await statusResponse.json();
    console.log("📝 Welcome message status:", statusData);

    // Test 3: Get current system messages
    console.log("3. Fetching current system messages...");
    const messagesResponse = await fetch(`${BASE_URL}/system-messages`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const messagesData = await messagesResponse.json();
    console.log(
      "📨 System messages count:",
      messagesData.data?.systemMessages?.length || 0
    );

    // Count welcome messages
    const welcomeMessages =
      messagesData.data?.systemMessages?.filter((msg) =>
        msg.title.includes("Welcome to @Cloud")
      ) || [];
    console.log("🎉 Welcome messages found:", welcomeMessages.length);

    if (welcomeMessages.length > 1) {
      console.log("⚠️  Multiple welcome messages detected!");
      welcomeMessages.forEach((msg, index) => {
        console.log(
          `   ${index + 1}. Created: ${new Date(
            msg.createdAt
          ).toLocaleString()}`
        );
      });
    } else if (welcomeMessages.length === 1) {
      console.log("✅ Exactly one welcome message found");
    } else {
      console.log("📭 No welcome messages found");
    }

    // Test 4: Test creating a welcome message (should be blocked if already exists)
    console.log("4. Testing welcome message creation...");
    const createResponse = await fetch(`${BASE_URL}/system-messages/auto`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "🎉 Welcome to @Cloud Event Management System!",
        content: "Test welcome message",
        type: "announcement",
        priority: "high",
        targetUserId: loginData.data.user.id,
        creator: {
          id: "test-admin",
          name: "Test Admin",
          email: "admin@example.com",
        },
      }),
    });

    const createData = await createResponse.json();
    console.log("📤 Create message response:", createData.message);

    console.log("\n✅ Welcome message fix test completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testWelcomeMessageFix();
