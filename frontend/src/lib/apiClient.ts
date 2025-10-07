// Centralized API client for frontend
// Handles production backend host vs local dev relative proxy.
// Usage:
//   const res = await apiFetch('/audit-logs?param=1');
//   const data = await res.json();

interface ImportMetaEnvLike {
  VITE_API_URL?: string;
  [key: string]: string | undefined;
}

// Narrow typing for import.meta.env (Vite provides typings if using vite/client but keep local fallback)
const env: ImportMetaEnvLike =
  (typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: ImportMetaEnvLike }).env) ||
  {};
const raw = env.VITE_API_URL;

// Normalize base (can be undefined in dev). Examples accepted:
//   atcloud-backend.onrender.com
//   https://atcloud-backend.onrender.com
//   https://atcloud-backend.onrender.com/api
const BASE = (() => {
  if (!raw) return "";
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProto.replace(/\/+$/g, "");
})();

const BASE_HAS_API = /\/api$/i.test(BASE);

export function apiUrl(path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (!BASE) return `/api${clean}`; // dev relative
  return BASE_HAS_API ? `${BASE}${clean}` : `${BASE}/api${clean}`;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem("authToken");
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(apiUrl(path), { ...init, headers });
}

export function getAuthToken() {
  return localStorage.getItem("authToken");
}
