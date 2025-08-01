#!/usr/bin/env node

/**
 * Notification Trio Test Runner
 * Executes comprehensive tests to verify all notification trios are working
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🧪 Notification Trio Test Suite");
console.log("=".repeat(60));
console.log(
  "🎯 Testing all 8 notification event types for complete trio functionality"
);
console.log("📧 Auto-Email + 💬 System Message + 🔔 Bell Notification");

// Test configuration
const testConfig = {
  testTimeout: 30000,
  setupTimeout: 10000,
  verbose: true,
};

// Check if required test files exist
const testFiles = [
  "backend/tests/notificationTrioUnit.test.js",
  "backend/tests/notificationTrioIntegration.test.js",
];

console.log("\n📁 Checking test files...");
for (const testFile of testFiles) {
  const fullPath = path.join(__dirname, "..", testFile);
  if (fs.existsSync(fullPath)) {
    console.log(`   ✅ ${testFile}`);
  } else {
    console.log(`   ❌ ${testFile} - NOT FOUND`);
    process.exit(1);
  }
}

// Test execution functions
async function runUnitTests() {
  console.log("\n🔬 RUNNING UNIT TESTS");
  console.log("-".repeat(40));
  console.log("📋 Testing individual notification trio components");

  try {
    const output = execSync(
      "npm test -- --testPathPattern=notificationTrioUnit.test.js --verbose",
      {
        cwd: path.join(__dirname, ".."),
        encoding: "utf8",
        timeout: testConfig.testTimeout,
      }
    );

    console.log("✅ Unit Tests: PASSED");
    return true;
  } catch (error) {
    console.log("❌ Unit Tests: FAILED");
    console.log(error.stdout || error.message);
    return false;
  }
}

async function runIntegrationTests() {
  console.log("\n🔗 RUNNING INTEGRATION TESTS");
  console.log("-".repeat(40));
  console.log("📋 Testing complete notification trio workflows");

  try {
    const output = execSync(
      "npm test -- --testPathPattern=notificationTrioIntegration.test.js --verbose",
      {
        cwd: path.join(__dirname, ".."),
        encoding: "utf8",
        timeout: testConfig.testTimeout,
      }
    );

    console.log("✅ Integration Tests: PASSED");
    return true;
  } catch (error) {
    console.log("❌ Integration Tests: FAILED");
    console.log(error.stdout || error.message);
    return false;
  }
}

async function runLiveEndpointTests() {
  console.log("\n🌐 RUNNING LIVE ENDPOINT TESTS");
  console.log("-".repeat(40));
  console.log("📋 Testing notification API endpoints accessibility");

  try {
    const output = execSync("node verify-complete-trios.js", {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
      timeout: testConfig.testTimeout,
    });

    if (output.includes("🎯 Success Rate: 100%")) {
      console.log("✅ Live Endpoint Tests: PASSED");
      return true;
    } else {
      console.log("❌ Live Endpoint Tests: Some endpoints not accessible");
      return false;
    }
  } catch (error) {
    console.log("❌ Live Endpoint Tests: FAILED");
    console.log("Make sure backend server is running on localhost:5001");
    return false;
  }
}

// Main test execution
async function runAllTests() {
  console.log("\n🚀 Starting Comprehensive Notification Trio Test Suite...");

  const results = {
    unit: false,
    integration: false,
    endpoints: false,
  };

  // Run unit tests
  results.unit = await runUnitTests();

  // Run integration tests
  results.integration = await runIntegrationTests();

  // Run live endpoint tests
  results.endpoints = await runLiveEndpointTests();

  // Generate summary
  console.log("\n" + "=".repeat(60));
  console.log("🎯 COMPREHENSIVE TEST RESULTS");
  console.log("=".repeat(60));

  const testSummary = [
    {
      name: "Unit Tests",
      status: results.unit,
      description: "Individual component testing",
    },
    {
      name: "Integration Tests",
      status: results.integration,
      description: "End-to-end workflow testing",
    },
    {
      name: "Live Endpoint Tests",
      status: results.endpoints,
      description: "API accessibility testing",
    },
  ];

  let passedCount = 0;
  for (const test of testSummary) {
    const statusIcon = test.status ? "✅" : "❌";
    const statusText = test.status ? "PASSED" : "FAILED";
    console.log(
      `   ${statusIcon} ${test.name}: ${statusText} (${test.description})`
    );
    if (test.status) passedCount++;
  }

  const successRate = Math.round((passedCount / testSummary.length) * 100);
  console.log(
    `\n📊 Overall Success Rate: ${passedCount}/${testSummary.length} (${successRate}%)`
  );

  if (passedCount === testSummary.length) {
    console.log(
      "\n🎉 ALL TESTS PASSED! Notification trio system is fully verified!"
    );
    console.log("\n📋 VERIFIED CAPABILITIES:");
    console.log("   ✅ All 8 notification event types working");
    console.log(
      "   ✅ Email + System Message + Bell Notification trios complete"
    );
    console.log("   ✅ UnifiedMessageController architecture functioning");
    console.log("   ✅ Real-time WebSocket notifications working");
    console.log("   ✅ Error handling and graceful degradation verified");
    console.log("   ✅ API endpoints accessible and secure");

    console.log("\n🏆 NOTIFICATION SYSTEM STATUS: PRODUCTION READY!");
    process.exit(0);
  } else {
    console.log("\n⚠️  SOME TESTS FAILED - System needs attention");
    console.log(
      "🔧 Please review failed tests and fix issues before production"
    );
    process.exit(1);
  }
}

// Handle process interruption
process.on("SIGINT", () => {
  console.log("\n\n🛑 Test execution interrupted by user");
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.log("\n❌ Uncaught exception during testing:");
  console.log(error.message);
  process.exit(1);
});

// Start test execution
runAllTests().catch((error) => {
  console.log("\n❌ Test execution failed:");
  console.log(error.message);
  process.exit(1);
});
