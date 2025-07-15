// Quick navigation test
// Open browser console and run: checkNavigation()

window.checkNavigation = function () {
  const currentUrl = window.location.href;
  const currentPath = window.location.pathname;

  console.log("🔍 Navigation Debug:", {
    currentUrl,
    currentPath,
    reactRouterLocation: window.history.state,
    outletElement:
      document.querySelector('[data-testid="outlet"]') ||
      document.querySelector("main"),
    dashboardLayoutExists: !!document.querySelector('[class*="min-h-screen"]'),
  });

  // Test navigation
  console.log("🚀 Testing navigation to profile...");
  window.history.pushState({}, "", "/dashboard/profile");

  setTimeout(() => {
    console.log("📊 After navigation:", {
      newUrl: window.location.href,
      newPath: window.location.pathname,
      pageContent:
        document.querySelector("main")?.textContent?.slice(0, 100) ||
        "No main content",
    });
  }, 100);
};

console.log("🔧 Navigation debug loaded. Run checkNavigation() in console.");
