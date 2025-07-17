import mongoose from "mongoose";
import { User } from "../models";

(async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");

    const users = await User.find({}, "username email role isActive").limit(10);
    users.forEach((user) => {
    });

    mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    mongoose.disconnect();
  }
})();
