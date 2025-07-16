#!/usr/bin/env node

/**
 * Quick setup script for @Cloud Event Sign-up System
 * This script will:
 * 1. Create .env file if it doesn't exist
 * 2. Set up initial admin user
 * 3. Create sample data for testing
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🚀 Setting up @Cloud Event Sign-up System...\n");

// Check if .env exists
const envPath = path.join(__dirname, "backend", ".env");
const envExamplePath = path.join(__dirname, ".env.example");

if (!fs.existsSync(envPath)) {
  console.log("📝 Creating .env file...");
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log("✅ .env file created from .env.example");
    console.log(
      "⚠️  Please edit backend/.env with your MongoDB URI and JWT secrets\n"
    );
  } else {
    console.log("❌ .env.example not found. Please create .env manually.\n");
    process.exit(1);
  }
} else {
  console.log("✅ .env file already exists\n");
}

// Setup database and initial data
try {
  console.log("🗄️  Setting up database and initial admin user...");
  process.chdir(path.join(__dirname, "backend"));

  // Install dependencies if needed
  if (!fs.existsSync("node_modules")) {
    console.log("📦 Installing backend dependencies...");
    execSync("npm install", { stdio: "inherit" });
  }

  // Setup admin user
  console.log("👤 Creating admin user...");
  execSync("npm run setup-users", { stdio: "inherit" });

  console.log("\n✅ Setup completed successfully!");
  console.log("\n📋 Next steps:");
  console.log("1. Edit backend/.env with your MongoDB URI");
  console.log("2. Run: cd backend && npm run dev");
  console.log("3. In another terminal: cd frontend && npm run dev");
  console.log("\n🔑 Default admin login:");
  console.log("   Username: admin");
  console.log("   Password: AdminPassword123!");
} catch (error) {
  console.error("❌ Setup failed:", error.message);
  console.log("\n🔧 Manual setup required:");
  console.log("1. Make sure MongoDB is running");
  console.log("2. Edit backend/.env with correct MongoDB URI");
  console.log("3. Run: cd backend && npm run setup-users");
  process.exit(1);
}
