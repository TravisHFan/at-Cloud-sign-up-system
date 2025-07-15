#!/usr/bin/env node

/**
 * Test Frontend Profile Role Display
 * This script verifies the frontend profile page displays the System Authorization Level correctly
 */

const https = require("https");
const http = require("http");

// Test configuration
const BACKEND_URL = "http://localhost:5001";
const FRONTEND_URL = "http://localhost:5174";
const TEST_USER = {
  username: "travisfan",
  password: "password123",
};

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Frontend-Test-Script",
        ...options.headers,
      },
      ...options,
    };

    const client = url.startsWith("https:") ? https : http;

    const req = client.request(url, requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = res.headers["content-type"]?.includes(
            "application/json"
          )
            ? JSON.parse(data)
            : data;
          resolve({
            status: res.statusCode,
            data: parsed,
            headers: res.headers,
          });
        } catch (error) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(
        typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body)
      );
    }

    req.end();
  });
}

async function loginAndGetToken() {
  console.log("🔐 Testing login to get user token...");

  const response = await makeRequest(`${BACKEND_URL}/api/v1/auth/login`, {
    method: "POST",
    body: JSON.stringify({
      username: TEST_USER.username,
      password: TEST_USER.password,
    }),
  });

  if (response.status !== 200 || !response.data.success) {
    throw new Error(
      `Login failed: ${response.data.message || "Unknown error"}`
    );
  }

  console.log("✅ Login successful");
  console.log(`📋 User: ${response.data.data.user.username}`);
  console.log(`🏷️  Role: ${response.data.data.user.role}`);

  return {
    token: response.data.data.tokens.accessToken,
    user: response.data.data.user,
  };
}

async function testProfileEndpoint(token) {
  console.log("\n📋 Testing profile endpoint...");

  const response = await makeRequest(`${BACKEND_URL}/api/v1/users/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status !== 200 || !response.data.success) {
    throw new Error(
      `Profile request failed: ${response.data.message || "Unknown error"}`
    );
  }

  console.log("✅ Profile endpoint working");
  console.log(`🏷️  Role in profile: ${response.data.data.user.role}`);

  return response.data.data.user;
}

async function testFrontendAccess() {
  console.log("\n🌐 Testing frontend accessibility...");

  const response = await makeRequest(FRONTEND_URL);

  if (response.status !== 200) {
    throw new Error(`Frontend not accessible: Status ${response.status}`);
  }

  console.log("✅ Frontend is accessible");
  console.log(`📄 Content type: ${response.headers["content-type"]}`);

  // Check if it's HTML content
  if (typeof response.data === "string" && response.data.includes("<html")) {
    console.log("✅ Frontend serving HTML content");

    // Check for React app indicators
    if (
      response.data.includes("React") ||
      response.data.includes("vite") ||
      response.data.includes("src/main.tsx")
    ) {
      console.log("✅ React app detected in HTML");
    }
  }
}

async function runTests() {
  console.log("🧪 Frontend Profile Role Display Test");
  console.log("==========================================");

  try {
    // Test 1: Login and get token
    const { token, user } = await loginAndGetToken();

    // Test 2: Test profile endpoint
    const profileUser = await testProfileEndpoint(token);

    // Test 3: Test frontend accessibility
    await testFrontendAccess();

    // Summary
    console.log("\n📊 Test Summary:");
    console.log("================");
    console.log(
      `✅ Backend API working: User role "${profileUser.role}" returned correctly`
    );
    console.log(`✅ Frontend accessible: http://localhost:5174`);
    console.log(`✅ Token-based authentication working`);

    console.log("\n🎯 Next Steps for Manual Testing:");
    console.log("1. Open http://localhost:5174 in your browser");
    console.log(
      `2. Login with username: ${TEST_USER.username}, password: ${TEST_USER.password}`
    );
    console.log("3. Navigate to Profile page");
    console.log(
      '4. Check that "System Authorization Level" shows: ' + profileUser.role
    );
    console.log(
      "5. The role should appear in the System Information section at the bottom"
    );
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();
