#!/usr/bin/env node

/**
 * @Cloud Role Admin Notifications - Complete Test Suite Runner
 *
 * PURPOSE: Execute all test scripts for @Cloud role admin notifications
 * Runs comprehensive tests for all scenarios and error handling
 *
 * USAGE: node run-all-atcloud-tests.js
 */

const { spawn } = require("child_process");
const path = require("path");

const tests = [
  {
    name: "Scenario 1: New User Signup Tests",
    script: "test-atcloud-signup-notifications.js",
    description: "Tests new user registration with @Cloud role",
  },
  {
    name: "Scenarios 2 & 3: Profile Update Tests",
    script: "test-atcloud-profile-notifications.js",
    description: "Tests profile changes No→Yes and Yes→No",
  },
  {
    name: "End-to-End Integration Tests",
    script: "test-atcloud-integration.js",
    description: "Complete integration testing of all scenarios",
  },
  {
    name: "Error Handling Tests",
    script: "test-atcloud-error-handling.js",
    description: "Tests system resilience and graceful degradation",
  },
];

function runTest(test) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running: ${test.name}`);
    console.log(`📋 ${test.description}`);
    console.log("=".repeat(60));

    const child = spawn("node", [test.script], {
      cwd: __dirname,
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ ${test.name} completed`);
        resolve();
      } else {
        console.log(`❌ ${test.name} failed with code ${code}`);
        reject(new Error(`Test failed with code ${code}`));
      }
    });

    child.on("error", (error) => {
      console.log(`💥 ${test.name} error:`, error.message);
      reject(error);
    });
  });
}

async function runAllTests() {
  console.log("🎬 @Cloud Role Admin Notifications - Complete Test Suite");
  console.log("🎯 Testing all scenarios and error conditions");
  console.log("=".repeat(80));

  const results = {
    passed: 0,
    failed: 0,
    errors: [],
  };

  for (const test of tests) {
    try {
      await runTest(test);
      results.passed++;

      // Wait between tests to avoid conflicts
      console.log("\n⏳ Waiting 3 seconds before next test...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      results.failed++;
      results.errors.push({ test: test.name, error: error.message });

      // Continue with other tests even if one fails
      console.log(`⚠️  Continuing with remaining tests...\n`);
    }
  }

  // Final summary
  console.log("\n\n📊 COMPLETE TEST SUITE SUMMARY");
  console.log("=".repeat(50));
  console.log(`✅ Passed: ${results.passed}/${tests.length} test suites`);
  console.log(`❌ Failed: ${results.failed}/${tests.length} test suites`);

  if (results.errors.length > 0) {
    console.log("\n❌ Failed Tests:");
    results.errors.forEach((error) => {
      console.log(`   • ${error.test}: ${error.error}`);
    });
  }

  if (results.passed === tests.length) {
    console.log("\n🎉 ALL TEST SUITES COMPLETED SUCCESSFULLY!");
    console.log("✅ @Cloud role admin notification system is fully functional");
  } else {
    console.log("\n⚠️  Some test suites encountered issues");
    console.log("   Check individual test outputs for details");
  }

  console.log("\n📝 MANUAL VERIFICATION REQUIRED:");
  console.log("   □ Check admin email inboxes for notifications");
  console.log("   □ Verify admin system messages and bell notifications");
  console.log(
    "   □ Confirm users did NOT receive their own @Cloud notifications"
  );
  console.log("   □ Review server console logs for proper error handling");

  console.log("\n🏁 Test suite execution complete!");
}

// Check if all test files exist
const missingFiles = [];
tests.forEach((test) => {
  const filePath = path.join(__dirname, test.script);
  try {
    require.resolve(filePath);
  } catch (error) {
    missingFiles.push(test.script);
  }
});

if (missingFiles.length > 0) {
  console.log("❌ Missing test files:");
  missingFiles.forEach((file) => console.log(`   • ${file}`));
  console.log(
    "\nPlease ensure all test files are present before running the test suite."
  );
  process.exit(1);
}

// Run the test suite
runAllTests().catch((error) => {
  console.log("\n💥 Test suite runner failed:", error);
  process.exit(1);
});
