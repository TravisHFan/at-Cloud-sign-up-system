/**
 * Simple notification test script to verify backend connectivity
 */

const axios = require("axios");

const BASE_URL = "http://localhost:5001/api/v1";

async function testNotificationAPI() {
  try {
    console.log("🧪 Testing notification API accessibility...");

    // First test if the server is running
    try {
      const healthCheck = await axios.get(`${BASE_URL}/auth/health`, {
        timeout: 5000,
      });
      console.log("✅ Backend server is running");
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(
          "✅ Backend server is running (404 expected for non-existent health endpoint)"
        );
      } else {
        console.log("❌ Backend server might not be running:", error.message);
        return;
      }
    }

    // Test notification endpoint without auth (should get 401)
    try {
      const response = await axios.get(`${BASE_URL}/notifications`);
      console.log("⚠️ Unexpected: Got response without auth:", response.status);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(
          "✅ Notification endpoint requires authentication (as expected)"
        );
      } else {
        console.log(
          "❌ Unexpected error:",
          error.response?.status || error.message
        );
      }
    }

    console.log("✅ Basic connectivity test complete");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the test
testNotificationAPI();
