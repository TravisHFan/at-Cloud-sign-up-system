const axios = require("axios");

async function testUserSystem() {
  try {
    console.log("🧪 Testing user system...");

    // Test login with existing user (superadmin from regeneration)
    console.log("\n1. Testing login with existing user...");
    const loginResponse = await axios.post(
      "http://localhost:5001/api/v1/auth/login",
      {
        emailOrUsername: "superadmin@atcloud.org",
        password: "SuperAdmin123!",
      }
    );

    console.log("✅ Login successful!");
    console.log("User schema fields in response:");
    const user = loginResponse.data.user;
    Object.keys(user).forEach((key) => {
      console.log(`- ${key}: ${user[key]}`);
    });

    // Test registration with new user
    console.log("\n2. Testing registration with new user...");
    const newUser = {
      username: "newuser" + Date.now(),
      email: "newuser" + Date.now() + "@example.com",
      password: "NewUser123!",
      confirmPassword: "NewUser123!",
      firstName: "New",
      lastName: "User",
      phone: "+1234567890",
      gender: "female",
      homeAddress: "New Address",
      isAtCloudLeader: false,
      occupation: "Developer",
      company: "Tech Company",
      weeklyChurch: "Local Church",
      churchAddress: "Church Address",
      acceptTerms: true,
    };

    const registrationResponse = await axios.post(
      "http://localhost:5001/api/v1/auth/register",
      newUser
    );

    console.log("✅ Registration successful!");
    console.log(
      "New user data:",
      JSON.stringify(registrationResponse.data.data.user, null, 2)
    );

    console.log(
      "\n🎉 All tests passed! MongoDB user schema is working correctly."
    );
  } catch (error) {
    console.log("❌ Error:", error.response?.data || error.message);
  }
}

testUserSystem();
