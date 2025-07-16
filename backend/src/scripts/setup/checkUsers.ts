import mongoose from "mongoose";
import { User } from "../models";

(async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("Connected to MongoDB");

    const users = await User.find({}, "username email role isActive").limit(10);
    console.log("Available users:");
    users.forEach((user) => {
      console.log(
        `- Username: ${user.username}, Email: ${user.email}, Role: ${user.role}, Active: ${user.isActive}`
      );
    });

    mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    mongoose.disconnect();
  }
})();
