#!/usr/bin/env node

/**
 * Generate secure secrets for production deployment
 * Run: node generate-secrets.js
 */

const crypto = require("crypto");

console.log("=".repeat(60));
console.log("🔐 SECURE SECRETS FOR PRODUCTION DEPLOYMENT");
console.log("=".repeat(60));
console.log();

console.log("📋 Copy these values to your Render environment variables:");
console.log();

console.log("JWT_ACCESS_SECRET=");
console.log(crypto.randomBytes(64).toString("hex"));
console.log();

console.log("JWT_REFRESH_SECRET=");
console.log(crypto.randomBytes(64).toString("hex"));
console.log();

console.log("JWT_SECRET=");
console.log(crypto.randomBytes(64).toString("hex"));
console.log();

console.log("ROLE_ASSIGNMENT_REJECTION_SECRET=");
console.log(crypto.randomBytes(32).toString("hex"));
console.log();

console.log("GUEST_INVITATION_DECLINE_SECRET=");
console.log(crypto.randomBytes(32).toString("hex"));
console.log();

console.log("⚠️  Important Security Notes:");
console.log("- Never commit these secrets to version control");
console.log("- Store them securely in Render's environment variables");
console.log("- Use different secrets for development and production");
console.log("- Rotate these secrets periodically");
console.log();
console.log("🚀 Ready for deployment!");
