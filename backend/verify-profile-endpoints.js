const axios = require("axios");

async function verifyAllProfileEndpoints() {
  try {
    console.log("🧪 Verifying All Profile-Related Endpoints");
    console.log("==========================================\n");

    // Login as Super Admin
    const loginResponse = await axios.post(
      "http://localhost:5001/api/v1/auth/login",
      {
        emailOrUsername: "travisfan",
        password: "SuperAdmin123!",
      }
    );

    const token = loginResponse.data.data.accessToken;
    console.log("✅ Login successful\n");

    // Test 1: GET /api/v1/users/profile (UserController.getProfile)
    console.log("📋 Test 1: GET /api/v1/users/profile");
    const userProfile = await axios.get(
      "http://localhost:5001/api/v1/users/profile",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    console.log("Response structure:", {
      success: userProfile.data.success,
      hasData: !!userProfile.data.data,
      hasUser: !!userProfile.data.data?.user,
      role: userProfile.data.data?.user?.role || "MISSING",
    });

    // Test 2: GET /api/v1/auth/profile (AuthController.getProfile)
    console.log("\n📋 Test 2: GET /api/v1/auth/profile");
    try {
      const authProfile = await axios.get(
        "http://localhost:5001/api/v1/auth/profile",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log("Response structure:", {
        success: authProfile.data.success,
        hasData: !!authProfile.data.data,
        hasUser: !!authProfile.data.data?.user,
        role: authProfile.data.data?.user?.role || "MISSING",
      });
    } catch (error) {
      console.log(
        "Auth profile endpoint error:",
        error.response?.status,
        error.response?.data?.message
      );
    }

    // Test 3: Check what fields are actually returned
    console.log("\n📋 Test 3: Complete Field Analysis");
    const user = userProfile.data.data.user;

    console.log("All fields returned in profile:");
    Object.keys(user).forEach((key) => {
      console.log(`   - ${key}: ${user[key]}`);
    });

    // Test 4: Verify role field specifically
    console.log("\n📋 Test 4: Role Field Verification");
    if (user.role) {
      console.log("✅ Role field is present");
      console.log("   Value:", `"${user.role}"`);
      console.log("   Type:", typeof user.role);
      console.log("   Length:", user.role.length);
    } else {
      console.log("❌ Role field is missing or empty");
    }

    // Test 5: JSON structure for frontend
    console.log("\n📋 Test 5: JSON Structure for Frontend");
    console.log("Complete user object as JSON:");
    console.log(JSON.stringify(user, null, 2));

    console.log("\n🎯 Summary for Frontend Developers:");
    console.log("   - API Endpoint: GET /api/v1/users/profile");
    console.log("   - Authorization: Bearer token required");
    console.log("   - Response path: response.data.data.user.role");
    console.log(
      '   - Expected value: "Super Admin", "Administrator", "Leader", or "Participant"'
    );
    console.log("\n💡 If System Authorization Level shows empty in frontend:");
    console.log("   1. Check if API call is successful");
    console.log("   2. Verify response.data.data.user.role exists");
    console.log("   3. Check for JavaScript/TypeScript property access errors");
    console.log("   4. Ensure authentication token is valid");
  } catch (error) {
    if (error.response?.status === 429) {
      console.log("⏳ Rate limited - please wait a moment and try again");
    } else {
      console.log("❌ Error:", error.response?.data || error.message);
    }
  }
}

verifyAllProfileEndpoints();
