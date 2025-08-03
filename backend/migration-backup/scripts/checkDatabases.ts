#!/usr/bin/env node

import mongoose from "mongoose";

async function checkDatabases() {
  try {
    // Connect to MongoDB without database selection
    await mongoose.connect("mongodb://localhost:27017/");
    const admin = mongoose.connection.db?.admin();
    if (!admin) throw new Error("Admin connection failed");

    // List all databases
    const dbs = await admin.listDatabases();
    console.log("=== ALL DATABASES ===");
    dbs.databases.forEach((db: any) =>
      console.log(`- ${db.name} (${db.sizeOnDisk} bytes)`)
    );

    await mongoose.disconnect();

    // Check atcloud-signup
    console.log("\n=== ATCLOUD-SIGNUP DATABASE ===");
    try {
      await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
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
      await mongoose.connect("mongodb://localhost:27017/atcloud-signup-system");
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
