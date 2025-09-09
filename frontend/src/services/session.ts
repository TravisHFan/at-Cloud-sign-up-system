// Centralized session expiration handler for the frontend
// Shows a clear prompt and redirects to login once.

let sessionPromptShown = false;

export function handleSessionExpired(): void {
  if (sessionPromptShown) return;
  sessionPromptShown = true;
  try {
    // Simple, universally-available prompt
    window.alert("Your session has expired. Please sign in again.");
  } finally {
    try {
      localStorage.removeItem("authToken");
    } catch {
      // noop: localStorage may be unavailable (e.g., in privacy modes/tests)
      void 0;
    }
    // Navigate to login page
    try {
      if (typeof window !== "undefined" && window.location) {
        window.location.assign("/login");
      }
    } catch {
      // noop: navigation not implemented in some environments (e.g., jsdom)
      void 0;
    }
  }
}

// For tests or resets (not used in production runtime)
export function __resetSessionPromptFlag() {
  sessionPromptShown = false;
}
