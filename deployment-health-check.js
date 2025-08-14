#!/usr/bin/env node

/**
 * Deployment Health Check Script
 * Validates configuration and environment for production deployment
 */

const fs = require("fs");
const path = require("path");

console.log("🏥 DEPLOYMENT HEALTH CHECK");
console.log("=".repeat(50));

let issues = [];
let warnings = [];

// Check Backend Configuration
console.log("\n📦 BACKEND CHECKS:");

// 1. Check package.json dependencies
try {
  const backendPkg = JSON.parse(
    fs.readFileSync("./backend/package.json", "utf8")
  );

  // Check if TypeScript is in dependencies (required for Render)
  if (backendPkg.dependencies?.typescript) {
    console.log("✅ TypeScript in dependencies");
  } else {
    issues.push(
      "❌ TypeScript missing from dependencies (required for Render build)"
    );
  }

  // Check if @types packages are in dependencies
  const typePackages = Object.keys(backendPkg.dependencies || {}).filter(
    (pkg) => pkg.startsWith("@types/")
  );
  if (typePackages.length > 5) {
    console.log("✅ Type packages in dependencies");
  } else {
    issues.push("❌ @types packages missing from dependencies");
  }
} catch (error) {
  issues.push("❌ Cannot read backend/package.json");
}

// 2. Check environment variable handling
try {
  const configService = fs.readFileSync(
    "./backend/src/services/ConfigService.ts",
    "utf8"
  );
  if (configService.includes("process.env.PORT")) {
    console.log("✅ PORT environment variable configured");
  } else {
    warnings.push("⚠️ PORT environment variable not found in ConfigService");
  }
} catch (error) {
  warnings.push("⚠️ Cannot check ConfigService.ts");
}

// 3. Check for hardcoded localhost URLs
try {
  const apiFile = fs.readFileSync(
    "./backend/src/services/infrastructure/emailService.ts",
    "utf8"
  );
  const localhostCount = (apiFile.match(/localhost/g) || []).length;
  if (localhostCount > 0) {
    console.log(
      `⚠️ Found ${localhostCount} localhost references (should use env vars)`
    );
  } else {
    console.log("✅ No hardcoded localhost URLs");
  }
} catch (error) {
  warnings.push("⚠️ Cannot check for hardcoded URLs");
}

// Check Frontend Configuration
console.log("\n🌐 FRONTEND CHECKS:");

// 1. Check package.json
try {
  const frontendPkg = JSON.parse(
    fs.readFileSync("./frontend/package.json", "utf8")
  );
  if (frontendPkg.scripts?.build) {
    console.log("✅ Build script exists");
  } else {
    issues.push("❌ Frontend build script missing");
  }
} catch (error) {
  issues.push("❌ Cannot read frontend/package.json");
}

// 2. Check CSP configuration
try {
  const indexHtml = fs.readFileSync("./frontend/index.html", "utf8");
  if (indexHtml.includes("at-cloud-sign-up-system-backend.onrender.com")) {
    console.log("✅ CSP includes production backend URL");
  } else {
    issues.push("❌ CSP missing production backend URL");
  }
} catch (error) {
  issues.push("❌ Cannot check CSP configuration");
}

// 3. Check environment variable usage
try {
  const apiService = fs.readFileSync("./frontend/src/services/api.ts", "utf8");
  if (apiService.includes("import.meta.env.VITE_API_URL")) {
    console.log("✅ Frontend uses environment variables for API URL");
  } else {
    issues.push("❌ Frontend not configured for environment variables");
  }
} catch (error) {
  issues.push("❌ Cannot check frontend API configuration");
}

// Check Production Files
console.log("\n🚀 PRODUCTION FILES:");

// 1. Check for render.yaml
if (fs.existsSync("./render.yaml")) {
  console.log("✅ render.yaml exists");
} else {
  warnings.push("⚠️ render.yaml missing (optional but recommended)");
}

// 2. Check for deployment guide
if (fs.existsSync("./DEPLOYMENT_GUIDE.md")) {
  console.log("✅ Deployment guide exists");
} else {
  warnings.push("⚠️ DEPLOYMENT_GUIDE.md missing");
}

// 3. Check for secret generator
if (fs.existsSync("./generate-secrets.js")) {
  console.log("✅ Secret generator exists");
} else {
  warnings.push("⚠️ generate-secrets.js missing");
}

// 4. Check for production env file
if (fs.existsSync("./frontend/.env.production")) {
  console.log("✅ Frontend production env file exists");
} else {
  warnings.push("⚠️ Frontend .env.production missing");
}

// Check Build Process
console.log("\n🔨 BUILD VERIFICATION:");

// Check if dist directories exist (indicates successful builds)
if (fs.existsSync("./backend/dist")) {
  console.log("✅ Backend compiled successfully");
} else {
  warnings.push("⚠️ Backend not compiled (run npm run build)");
}

if (fs.existsSync("./frontend/dist")) {
  console.log("✅ Frontend built successfully");
} else {
  warnings.push("⚠️ Frontend not built (run npm run build)");
}

// Summary
console.log("\n📋 SUMMARY:");
console.log("=".repeat(50));

if (issues.length === 0) {
  console.log("✅ NO CRITICAL ISSUES FOUND!");
  console.log("🚀 Project appears ready for deployment");
} else {
  console.log(`❌ ${issues.length} CRITICAL ISSUES FOUND:`);
  issues.forEach((issue) => console.log(`   ${issue}`));
}

if (warnings.length > 0) {
  console.log(`\n⚠️ ${warnings.length} WARNINGS:`);
  warnings.forEach((warning) => console.log(`   ${warning}`));
}

console.log("\n📚 NEXT STEPS:");
if (issues.length > 0) {
  console.log("1. Fix critical issues above");
  console.log("2. Re-run this health check");
  console.log("3. Test builds locally");
  console.log("4. Deploy to Render");
} else {
  console.log("1. Commit changes to git");
  console.log("2. Push to GitHub");
  console.log("3. Deploy on Render");
  console.log("4. Set environment variables");
  console.log("5. Test production deployment");
}

// Exit with appropriate code
process.exit(issues.length > 0 ? 1 : 0);
