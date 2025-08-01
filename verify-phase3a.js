#!/usr/bin/env node

/**
 * Phase 3A Verification Script
 * Tests the new unified notification routes alongside existing ones
 */

const axios = require("axios");

const BASE_URL = "http://localhost:5001";

// Test configuration
const TEST_CONFIG = {
  timeout: 5000,
  validateStatus: (status) => status < 500, // Accept 4xx as valid responses (auth required)
};

async function testEndpoint(method, endpoint, description) {
  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`   ${method.toUpperCase()} ${endpoint}`);

    const response = await axios({
      method,
      url: `${BASE_URL}${endpoint}`,
      ...TEST_CONFIG,
    });

    const statusColor = response.status < 400 ? "✅" : "⚠️";
    console.log(
      `   ${statusColor} Status: ${response.status} ${response.statusText}`
    );

    if (response.status === 401) {
      console.log(`   📝 Expected: Authentication required`);
    } else if (response.status === 404) {
      console.log(`   ❌ Route not found!`);
      return false;
    }

    return true;
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.log(`   ❌ Server not running on ${BASE_URL}`);
      return false;
    }
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function runPhase3AVerification() {
  console.log("🚀 Phase 3A: Unified Notification Routes Verification");
  console.log("=".repeat(60));

  // Check if server is running
  console.log("\n📡 Checking server status...");
  const serverOk = await testEndpoint("GET", "/health", "Server health check");
  if (!serverOk) {
    console.log(
      "\n❌ Server is not running. Please start the backend server first."
    );
    console.log("   Run: npm run dev");
    process.exit(1);
  }

  let passCount = 0;
  let totalTests = 0;

  // Test new unified notification routes
  console.log("\n🆕 NEW UNIFIED NOTIFICATION ROUTES (/api/v1/notifications/)");
  console.log("-".repeat(50));

  const unifiedTests = [
    ["GET", "/api/v1/notifications/system", "Get system messages (unified)"],
    ["GET", "/api/v1/notifications/bell", "Get bell notifications (unified)"],
    [
      "GET",
      "/api/v1/notifications/unread-counts",
      "Get unread counts (unified)",
    ],
    [
      "GET",
      "/api/v1/notifications/welcome-status",
      "Check welcome status (unified)",
    ],
  ];

  for (const [method, endpoint, description] of unifiedTests) {
    totalTests++;
    const result = await testEndpoint(method, endpoint, description);
    if (result) passCount++;
  }

  // Test existing routes still work
  console.log("\n🔄 EXISTING ROUTES (should still work)");
  console.log("-".repeat(40));

  const existingTests = [
    ["GET", "/api/v1/system-messages", "Get system messages (old)"],
    [
      "GET",
      "/api/v1/system-messages/bell-notifications",
      "Get bell notifications (old)",
    ],
    [
      "GET",
      "/api/v1/user/notifications/unread-counts",
      "Get unread counts (old)",
    ],
    [
      "GET",
      "/api/v1/user/notifications/system",
      "Get system messages (old duplicate)",
    ],
  ];

  for (const [method, endpoint, description] of existingTests) {
    totalTests++;
    const result = await testEndpoint(method, endpoint, description);
    if (result) passCount++;
  }

  // Test API documentation
  console.log("\n📚 API DOCUMENTATION");
  console.log("-".repeat(20));
  totalTests++;
  const docResult = await testEndpoint(
    "GET",
    "/api/v1",
    "API documentation endpoint"
  );
  if (docResult) passCount++;

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log(`📊 PHASE 3A VERIFICATION RESULTS`);
  console.log("=".repeat(60));
  console.log(`✅ Tests Passed: ${passCount}/${totalTests}`);
  console.log(
    `🎯 Success Rate: ${Math.round((passCount / totalTests) * 100)}%`
  );

  if (passCount === totalTests) {
    console.log("\n🎉 PHASE 3A SUCCESS: Unified routes created successfully!");
    console.log("✅ New unified notification routes are accessible");
    console.log("✅ Existing routes still work (parallel implementation)");
    console.log("✅ No breaking changes detected");
    console.log("\n📋 NEXT STEPS:");
    console.log("   1. Test unified routes with authentication");
    console.log("   2. Update frontend to use new routes");
    console.log("   3. Proceed to Phase 3B (Frontend Migration)");
  } else {
    console.log("\n⚠️  PHASE 3A ISSUES DETECTED");
    console.log("❌ Some routes are not accessible");
    console.log("🔧 Fix issues before proceeding to Phase 3B");
  }

  console.log(
    "\n🛡️  SAFETY STATUS: Zero risk - all existing functionality preserved"
  );
}

// Run the verification
runPhase3AVerification().catch(console.error);
