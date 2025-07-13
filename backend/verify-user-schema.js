require("dotenv").config();
const mongoose = require("mongoose");

async function verifyUserSchema() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup"
    );
    console.log("📊 MongoDB User Schema Verification");

    const db = mongoose.connection.db;
    const users = await db.collection("users").find({}).limit(1).toArray();

    if (users.length > 0) {
      const user = users[0];
      console.log("\n✅ Sample User Schema Fields:");
      Object.keys(user).forEach((key) => {
        if (key !== "password" && key !== "__v") {
          console.log(`- ${key}: ${typeof user[key]} = ${user[key]}`);
        } else if (key === "password") {
          console.log(`- ${key}: [HASHED]`);
        }
      });

      // Check critical notification fields
      const notificationFields = [
        "emailNotifications",
        "smsNotifications",
        "pushNotifications",
      ];
      const missingFields = notificationFields.filter(
        (field) => user[field] === undefined
      );

      console.log("\n🔔 Notification Settings Check:");
      if (missingFields.length === 0) {
        console.log("✅ All notification fields present!");
        notificationFields.forEach((field) => {
          console.log(`  - ${field}: ${user[field]}`);
        });
      } else {
        console.log("❌ Missing notification fields:", missingFields);
      }

      // Check @Cloud specific fields
      const atCloudFields = ["isAtCloudLeader", "ministry", "churchName"];
      console.log("\n⛪ @Cloud Ministry Fields:");
      atCloudFields.forEach((field) => {
        if (user[field] !== undefined) {
          console.log(`  ✅ ${field}: ${user[field]}`);
        } else {
          console.log(`  ❌ ${field}: missing`);
        }
      });
    } else {
      console.log("❌ No users found in database");
    }

    const userCount = await db.collection("users").countDocuments();
    console.log(`\n📈 Total users in collection: ${userCount}`);

    await mongoose.connection.close();
    console.log("\n✅ Schema verification complete!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

verifyUserSchema();
