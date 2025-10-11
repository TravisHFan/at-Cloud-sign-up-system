// Centralized session expiration handler for the frontend
// Shows a clear prompt and redirects to login once.

let sessionPromptShown = false;

// Lightweight pub/sub so components (e.g., a top-level listener) can show a custom modal
type SessionExpiredListener = () => void;
const listeners: SessionExpiredListener[] = [];

export function onSessionExpired(listener: SessionExpiredListener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function handleSessionExpired(): void {
  if (sessionPromptShown) return;
  sessionPromptShown = true;

  try {
    localStorage.removeItem("authToken");
  } catch {
    void 0;
  }

  // Notify UI layer to render modal; fallback to alert if no listener registered
  if (listeners.length > 0) {
    listeners.forEach((l) => {
      try {
        l();
      } catch {
        // swallow listener errors
      }
    });
  } else if (
    typeof window !== "undefined" &&
    typeof window.alert === "function"
  ) {
    window.alert("Your session has expired. Please sign in again.");
    // Only redirect if using fallback alert (no modal listeners registered)
    setTimeout(() => {
      try {
        if (typeof window !== "undefined" && window.location) {
          window.location.assign("/login");
        }
      } catch {
        void 0;
      }
    }, 0);
  }
}

// For tests or resets (not used in production runtime)
export function __resetSessionPromptFlag() {
  sessionPromptShown = false;
}
