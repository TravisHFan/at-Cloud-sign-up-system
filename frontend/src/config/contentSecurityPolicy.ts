import { DEFAULT_API_BASE_URL, getOriginFromURL } from "./apiUrl";

export const DEFAULT_BACKEND_ORIGINS = [
  "http://localhost:5001",
  "https://at-cloud-sign-up-system-backend.onrender.com",
  "https://atcloud-erp-backend-prod.onrender.com",
  "https://atcloud-erp-backend-staging.onrender.com",
];

function uniqueSources(sources: Array<string | null | undefined>): string[] {
  return Array.from(new Set(sources.filter(Boolean) as string[]));
}

export function getBackendOrigins(
  apiUrl: string = DEFAULT_API_BASE_URL,
): string[] {
  return uniqueSources([...DEFAULT_BACKEND_ORIGINS, getOriginFromURL(apiUrl)]);
}

export function buildContentSecurityPolicy(
  apiUrl: string = DEFAULT_API_BASE_URL,
): string {
  const backendOrigins = getBackendOrigins(apiUrl);

  const directives = [
    ["default-src", "'self'"],
    ["script-src", "'self'", "'unsafe-eval'", "'unsafe-inline'"],
    ["style-src", "'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    [
      "img-src",
      "'self'",
      "data:",
      "blob:",
      ...backendOrigins,
      "https://i.ytimg.com",
      "https://*.ytimg.com",
    ],
    ["font-src", "'self'", "data:", "https://fonts.gstatic.com"],
    ["connect-src", "'self'", "ws:", "wss:", ...backendOrigins],
    ["media-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-src", "'self'", "https://www.youtube.com", "https://youtube.com"],
  ];

  return `${directives.map((directive) => directive.join(" ")).join("; ")};`;
}
