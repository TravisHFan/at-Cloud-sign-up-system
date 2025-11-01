// API Configuration
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api";

// Normalize and sanitize provided base URL (remove legacy version segments)
export function sanitizeBaseURL(url: string): string {
  if (!url) return "/api";
  let sanitized = url.trim();
  // Remove any trailing slashes first
  sanitized = sanitized.replace(/\/$/, "");
  // Replace legacy /api/v1 with /api
  sanitized = sanitized.replace(/\/api\/v1(?=$|\b)/, "/api");
  // Collapse duplicate /api/api
  sanitized = sanitized.replace(/\/api\/api$/, "/api");
  // Ensure ends with /api (if it already ends with /api that's fine)
  if (!/\/api$/.test(sanitized)) {
    sanitized = sanitized + "/api";
  }
  return sanitized;
}
