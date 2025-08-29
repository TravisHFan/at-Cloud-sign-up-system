#!/usr/bin/env node

import mongoose from "mongoose";

async function checkDatabases() {
  try {
    // Connect to MongoDB without database selection
    const mongoHost = process.env.MONGODB_URI
      ? process.env.MONGODB_URI.split("/").slice(0, -1).join("/") + "/"
      : "mongodb://localhost:27017/";
    await mongoose.connect(mongoHost);
    const admin = mongoose.connection.db?.admin();
    if (!admin) throw new Error("Admin connection failed");

    // List all databases
    const dbs = await admin.listDatabases();
    console.log("=== ALL DATABASES ===");
    dbs.databases.forEach((db: { name: string; sizeOnDisk?: number }) => {
      const size = typeof db.sizeOnDisk === "number" ? db.sizeOnDisk : 0;
      console.log(`- ${db.name} (${size} bytes)`);
    });

    await mongoose.disconnect();

    // Check atcloud-signup
    console.log("\n=== ATCLOUD-SIGNUP DATABASE ===");
    try {
      const mainDbUri =
        process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
      await mongoose.connect(mainDbUri);
      const collections1 = await mongoose.connection.db
        ?.listCollections()
        .toArray();
      if (collections1 && collections1.length > 0) {
        console.log("Collections:");
        for (const col of collections1) {
          const count = await mongoose.connection.db
            ?.collection(col.name)
            .countDocuments();
          console.log(`- ${col.name}: ${count} documents`);
        }
      } else {
        console.log("No collections found");
      }
      await mongoose.disconnect();
    } catch (error) {
      console.log("Database does not exist or is empty");
      await mongoose.disconnect();
    }

    // Check atcloud-signup-system
    console.log("\n=== ATCLOUD-SIGNUP-SYSTEM DATABASE ===");
    try {
      const systemDbHost = process.env.MONGODB_URI
        ? process.env.MONGODB_URI.split("/").slice(0, -1).join("/") +
          "/atcloud-signup-system"
        : "mongodb://localhost:27017/atcloud-signup-system";
      await mongoose.connect(systemDbHost);
      const collections2 = await mongoose.connection.db
        ?.listCollections()
        .toArray();
      if (collections2 && collections2.length > 0) {
        console.log("Collections:");
        for (const col of collections2) {
          const count = await mongoose.connection.db
            ?.collection(col.name)
            .countDocuments();
          console.log(`- ${col.name}: ${count} documents`);
        }
      } else {
        console.log("No collections found");
      }
      await mongoose.disconnect();
    } catch (error) {
      console.log("Database does not exist or is empty");
      await mongoose.disconnect();
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

checkDatabases();
