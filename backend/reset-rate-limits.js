#!/usr/bin/env node

// Simple script to clear rate limit counters
// This can be useful during development when you hit rate limits

const { execSync } = require("child_process");

console.log("🔄 Clearing rate limit counters...");

// If you're using memory store (default), restarting the server clears rate limits
// If you're using Redis or another persistent store, you'd need to clear that

try {
  // Kill any existing backend processes
  console.log("Stopping backend processes...");
  execSync('pkill -f "npm run dev" || true', { stdio: "inherit" });

  console.log("✅ Rate limits should be cleared when you restart the server.");
  console.log(
    "💡 Tip: Rate limits have been increased to 1000 requests per 15 minutes for development."
  );
} catch (error) {
  console.error("❌ Error:", error.message);
}
