/**
 * Simple API test for unified notification endpoints
 */

const axios = require("axios");

const BASE_URL = "http://localhost:5001/api/v1";

async function testHealthCheck() {
  try {
    console.log("🔍 Testing health check...");
    const response = await axios.get(
      `${BASE_URL.replace("/api/v1", "")}/health`
    );

    if (response.data.success) {
      console.log("✅ Backend is healthy");
      return true;
    }
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
    return false;
  }
}

async function testAPIInfo() {
  try {
    console.log("📋 Testing API info...");
    const response = await axios.get(BASE_URL);

    if (response.data.success) {
      console.log("✅ API info endpoint working");
      return true;
    }
  } catch (error) {
    console.error("❌ API info failed:", error.message);
    return false;
  }
}

async function testUnifiedNotificationsEndpoint() {
  try {
    console.log(
      "🔔 Testing unified notifications endpoint (should fail auth)..."
    );
    const response = await axios.get(`${BASE_URL}/notifications/v2`);

    // This should fail with auth error, which means the endpoint exists
    console.log("⚠️  Unexpected success (should require auth)");
    return false;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log(
        "✅ Unified notifications endpoint exists (auth required as expected)"
      );
      return true;
    } else {
      console.error("❌ Unexpected error:", error.message);
      return false;
    }
  }
}

async function runBasicTest() {
  console.log("🚀 Starting Basic API Test\n");

  const healthOk = await testHealthCheck();
  const apiOk = await testAPIInfo();
  const unifiedOk = await testUnifiedNotificationsEndpoint();

  console.log("\n📊 Test Results:");
  console.log(`Health Check: ${healthOk ? "✅" : "❌"}`);
  console.log(`API Info: ${apiOk ? "✅" : "❌"}`);
  console.log(`Unified Notifications Endpoint: ${unifiedOk ? "✅" : "❌"}`);

  if (healthOk && apiOk && unifiedOk) {
    console.log("\n🎉 BASIC TESTS PASSED! 🎉");
    console.log("✅ Backend is running correctly");
    console.log("✅ Unified notification endpoints are accessible");
    console.log("✅ Authentication is properly protecting the endpoints");
  } else {
    console.log("\n❌ SOME TESTS FAILED");
  }
}

runBasicTest().catch((error) => {
  console.error("❌ Unexpected error:", error);
});
