const mongoose = require("mongoose");
require("dotenv").config();

// Basic User schema for checking
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
});

const User = mongoose.model("User", userSchema);

async function checkPhoneData() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup"
    );
    console.log("📋 Checking user phone data:");

    const users = await User.find({}, "firstName lastName email phone").limit(
      10
    );
    users.forEach((user) => {
      console.log(
        `- ${user.firstName} ${user.lastName}: email=${user.email}, phone=${
          user.phone || "NOT SET"
        }`
      );
    });

    const totalUsers = await User.countDocuments();
    const usersWithPhone = await User.countDocuments({
      phone: { $exists: true, $ne: null, $ne: "" },
    });

    console.log(
      `\n📊 Summary: ${usersWithPhone}/${totalUsers} users have phone numbers`
    );

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
  }
}

checkPhoneData();
