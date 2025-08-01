const crypto = require("crypto");

// From the database, the hashed token starts with: 583d5ee442452468325e...
const hashedTokenFromDB = "583d5ee442452468325e..."; // We'll need the full hash

console.log(
  "🔧 This script would normally bruteforce the token, but that's not practical."
);
console.log("");
console.log(
  "💡 Instead, let's create a test token directly in the database for testing:"
);

// Let's create a known test token
const testToken = "test-password-change-token-123";
const testHashedToken = crypto
  .createHash("sha256")
  .update(testToken)
  .digest("hex");

console.log("📋 Test Token (raw):", testToken);
console.log("🔒 Test Token (hashed):", testHashedToken);
console.log("");
console.log("We can update the database with this known token for testing...");
