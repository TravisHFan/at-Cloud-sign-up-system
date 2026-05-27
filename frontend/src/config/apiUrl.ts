export const DEFAULT_API_BASE_URL = "http://localhost:5001/api";

const HAS_PROTOCOL = /^[a-z][a-z0-9+.-]*:\/\//i;
const LOCAL_HOST_WITH_OPTIONAL_PORT =
  /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:\/|$)/i;

export function withDefaultProtocol(url: string): string {
  const trimmed = url.trim();

  if (!trimmed || trimmed.startsWith("/") || HAS_PROTOCOL.test(trimmed)) {
    return trimmed;
  }

  if (LOCAL_HOST_WITH_OPTIONAL_PORT.test(trimmed)) {
    return `http://${trimmed}`;
  }

  return `https://${trimmed}`;
}

export function sanitizeBaseURL(url: string): string {
  if (!url) return "/api";

  let sanitized = withDefaultProtocol(url);
  sanitized = sanitized.replace(/\/+$/, "");
  sanitized = sanitized.replace(/\/api\/v1(?=$|\/|\?|#)/, "/api");
  sanitized = sanitized.replace(/\/api\/api$/, "/api");

  if (!/\/api$/.test(sanitized)) {
    sanitized = `${sanitized}/api`;
  }

  return sanitized;
}

export function resolveApiBaseURL(configuredUrl?: string): string {
  return sanitizeBaseURL(configuredUrl || DEFAULT_API_BASE_URL);
}

export function getOriginFromURL(url: string): string | null {
  const normalized = withDefaultProtocol(url);
  const match = normalized.match(/^(https?:\/\/[^/?#]+)/i);
  return match?.[1]?.replace(/\/+$/, "") || null;
}

export function getApiOrigin(apiBaseURL: string): string {
  return getOriginFromURL(sanitizeBaseURL(apiBaseURL)) || "";
}

export function resolveSocketURL(
  configuredApiUrl?: string,
  configuredSocketUrl?: string,
): string {
  if (configuredSocketUrl?.trim()) {
    return (
      getOriginFromURL(configuredSocketUrl) ||
      withDefaultProtocol(configuredSocketUrl)
    );
  }

  return getApiOrigin(resolveApiBaseURL(configuredApiUrl));
}
