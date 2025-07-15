const axios = require("axios");

async function testSuperAdminProfile() {
  try {
    console.log("🧪 Testing Super Admin Profile with Correct Credentials");
    console.log("====================================================\n");

    // Test with correct Super Admin credentials
    const loginData = {
      emailOrUsername: "travisfan", // Current username
      password: "SuperAdmin123!", // Original password should still work
    };

    console.log(
      "🔑 Attempting login with username:",
      loginData.emailOrUsername
    );

    const loginResponse = await axios.post(
      "http://localhost:5001/api/v1/auth/login",
      loginData
    );

    if (!loginResponse.data.success) {
      console.log("❌ Login failed:", loginResponse.data.message);

      // Try with email instead
      console.log("\n🔄 Trying with email instead...");
      loginData.emailOrUsername = "new-email@example.com";

      const emailLoginResponse = await axios.post(
        "http://localhost:5001/api/v1/auth/login",
        loginData
      );

      if (!emailLoginResponse.data.success) {
        console.log(
          "❌ Email login also failed:",
          emailLoginResponse.data.message
        );
        return;
      }

      console.log("✅ Email login successful!");
      var token = emailLoginResponse.data.data.accessToken;
      var loginUser = emailLoginResponse.data.data.user;
    } else {
      console.log("✅ Username login successful!");
      var token = loginResponse.data.data.accessToken;
      var loginUser = loginResponse.data.data.user;
    }

    console.log("📊 Login Response Data:");
    console.log("   - User ID:", loginUser.id);
    console.log("   - Username:", loginUser.username);
    console.log("   - Email:", loginUser.email);
    console.log(
      "   - System Authorization Level:",
      loginUser.role || "MISSING!"
    );
    console.log("   - @Cloud Leader:", loginUser.isAtCloudLeader);

    // Get detailed profile
    console.log("\n📋 Fetching detailed profile...");
    const profileResponse = await axios.get(
      "http://localhost:5001/api/v1/users/profile",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const profileUser = profileResponse.data.data.user;

    console.log("✅ Profile retrieved successfully");
    console.log("📊 Complete Profile Data for Frontend:");
    console.log("   - ID:", profileUser.id);
    console.log("   - Username:", profileUser.username);
    console.log("   - Email:", profileUser.email);
    console.log("   - First Name:", profileUser.firstName || "Not set");
    console.log("   - Last Name:", profileUser.lastName || "Not set");
    console.log("   - Phone:", profileUser.phone || "Not set");
    console.log(
      "   - System Authorization Level:",
      profileUser.role || "MISSING!"
    );
    console.log("   - @Cloud Leader Status:", profileUser.isAtCloudLeader);
    console.log("   - Role in @Cloud:", profileUser.roleInAtCloud || "Not set");
    console.log("   - Occupation:", profileUser.occupation || "Not set");
    console.log("   - Company:", profileUser.company || "Not set");
    console.log("   - Weekly Church:", profileUser.weeklyChurch || "Not set");
    console.log("   - Email Notifications:", profileUser.emailNotifications);
    console.log("   - SMS Notifications:", profileUser.smsNotifications);
    console.log("   - Push Notifications:", profileUser.pushNotifications);
    console.log("   - Account Verified:", profileUser.isVerified);
    console.log("   - Account Active:", profileUser.isActive);

    if (profileUser.role) {
      console.log("\n✅ SUCCESS: System Authorization Level is present");
      console.log(`   Frontend should display: "${profileUser.role}"`);
    } else {
      console.log(
        "\n❌ ISSUE: System Authorization Level is missing from profile response"
      );
    }

    console.log("\n🎯 For Frontend Integration:");
    console.log('   The "role" field contains the System Authorization Level');
    console.log(
      "   Use: user.role to display in the System Information footer"
    );
    console.log("\n💡 If frontend shows empty, check:");
    console.log('   1. Frontend is reading the "role" field correctly');
    console.log("   2. Authentication token is being sent properly");
    console.log("   3. Profile API call is successful");
  } catch (error) {
    if (error.response?.status === 429) {
      console.log("⏳ Rate limited - please wait a moment and try again");
    } else {
      console.log("❌ Error:", error.response?.data || error.message);
    }
  }
}

testSuperAdminProfile();
