// Debug script to check what's happening with the phone field in frontend
// Open browser console and run this to see the current user data

console.log("🔍 Debugging Phone Field Issue");
console.log("================================");

// Check if we're in the browser
if (typeof window !== "undefined" && window.localStorage) {
  const authToken = localStorage.getItem("authToken");
  console.log("📱 Auth Token exists:", !!authToken);

  // Try to get user data from local storage or session storage
  const userData =
    localStorage.getItem("userData") || sessionStorage.getItem("userData");
  if (userData) {
    console.log("👤 User Data from storage:", JSON.parse(userData));
  }

  // Check if React DevTools or context is available
  if (window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log("⚛️ React detected - check React DevTools for AuthContext");
  }

  console.log("\n🎯 To debug further:");
  console.log("1. Go to React DevTools > Components");
  console.log("2. Find AuthProvider component");
  console.log("3. Check currentUser.phone value");
  console.log("4. Find Profile component");
  console.log("5. Check userData.phone in useProfileForm hook");
} else {
  console.log("❌ Not running in browser environment");
}

// If running in React context (for developers to run in browser console)
if (typeof window !== "undefined" && window.React) {
  console.log("\n📋 Browser Debug Commands:");
  console.log("// Check current auth state (run in console):");
  console.log("JSON.parse(localStorage.getItem('authToken') || '{}')");
  console.log("\n// Force refresh profile data:");
  console.log("window.location.reload()");
}
