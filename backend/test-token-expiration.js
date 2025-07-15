const axios = require("axios");

async function testTokenExpiration() {
  try {
    console.log("🧪 Testing new 2-hour token expiration...");

    // Login with one of the test users
    const loginResponse = await axios.post(
      "http://localhost:5001/api/v1/auth/login",
      {
        emailOrUsername: "participant_emily",
        password: "Participant123!",
      }
    );

    if (loginResponse.data.success) {
      console.log("✅ Login successful!");

      const tokenData = loginResponse.data.data;
      const accessToken = tokenData.accessToken;
      const expiresAt = new Date(tokenData.expiresAt);
      const now = new Date();

      // Calculate time difference in hours
      const timeDifference =
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      console.log("📋 Token Information:");
      console.log(`  - Token issued at: ${now.toISOString()}`);
      console.log(`  - Token expires at: ${expiresAt.toISOString()}`);
      console.log(`  - Token lifetime: ${timeDifference.toFixed(2)} hours`);

      if (timeDifference >= 1.9 && timeDifference <= 2.1) {
        console.log("✅ Token expiration correctly set to ~2 hours!");
      } else {
        console.log(
          "❌ Token expiration is not 2 hours:",
          timeDifference.toFixed(2),
          "hours"
        );
      }

      // Test the token by making an authenticated request
      console.log("\n🔐 Testing token authentication...");
      const profileResponse = await axios.get(
        "http://localhost:5001/api/v1/auth/profile",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (profileResponse.data.success) {
        console.log("✅ Token authentication successful!");
        console.log(
          "👤 User:",
          profileResponse.data.data.user.firstName,
          profileResponse.data.data.user.lastName
        );
      }
    } else {
      console.log("❌ Login failed:", loginResponse.data.message);
    }
  } catch (error) {
    if (error.response?.status === 429) {
      console.log("⏳ Rate limited - please wait a moment and try again");
    } else {
      console.log("❌ Error:", error.response?.data || error.message);
    }
  }
}

testTokenExpiration();
