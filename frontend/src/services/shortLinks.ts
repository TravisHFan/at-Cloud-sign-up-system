// Short Links frontend client utilities
// Provides idempotent creation & status lookup with lightweight in-memory caching.

export interface ShortLinkRecord {
  key: string;
  eventId: string;
  slug: string;
  expiresAt?: string | Date;
  url: string; // server-provided (may be relative)
}

export type ShortLinkStatus =
  | { state: "active"; slug: string; eventId: string }
  | { state: "expired" }
  | { state: "not_found" };

interface CreateResponse {
  success: boolean;
  created: boolean;
  data: {
    key: string;
    eventId: string;
    slug: string;
    expiresAt?: string;
    url: string;
  };
}

interface StatusActiveResponse {
  success: true;
  data: { status: "active"; slug: string; eventId: string };
}

const createCache = new Map<string, ShortLinkRecord>(); // eventId -> record
const statusCache = new Map<string, { status: ShortLinkStatus; ts: number }>(); // key -> status with timestamp

const STATUS_TTL_MS = 15_000; // 15s is enough for UI freshness without hammering

export async function getOrCreateShortLink(
  eventId: string
): Promise<ShortLinkRecord> {
  if (createCache.has(eventId)) return createCache.get(eventId)!;
  // Auth: endpoint requires organizer privileges; include bearer token + credentials
  const token = localStorage.getItem("authToken");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/public/short-links`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ eventId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Short link create failed (${res.status})${text ? ": " + text : ""}`
    );
  }
  const json = (await res.json()) as CreateResponse;
  const rec: ShortLinkRecord = {
    key: json.data.key,
    eventId: json.data.eventId,
    slug: json.data.slug,
    expiresAt: json.data.expiresAt,
    url: json.data.url,
  };
  createCache.set(eventId, rec);
  return rec;
}

export async function getShortLinkStatus(
  key: string
): Promise<ShortLinkStatus> {
  const now = Date.now();
  const cached = statusCache.get(key);
  if (cached && now - cached.ts < STATUS_TTL_MS) return cached.status;
  // Status lookup may also require auth if backend restricts certain metadata; include token if present
  const token = localStorage.getItem("authToken");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `/api/public/short-links/${encodeURIComponent(key)}`,
    {
      headers,
      credentials: "include",
    }
  );
  if (res.status === 200) {
    const json = (await res.json()) as StatusActiveResponse;
    const status: ShortLinkStatus = {
      state: "active",
      slug: json.data.slug,
      eventId: json.data.eventId,
    };
    statusCache.set(key, { status, ts: now });
    return status;
  }
  if (res.status === 410) {
    await res.json(); // consume body for consistency (message not needed in UI cache)
    const status: ShortLinkStatus = { state: "expired" };
    statusCache.set(key, { status, ts: now });
    return status;
  }
  if (res.status === 404) {
    const status: ShortLinkStatus = { state: "not_found" };
    statusCache.set(key, { status, ts: now });
    return status;
  }
  const text = await res.text();
  throw new Error(
    `Status request failed (${res.status})${text ? ": " + text : ""}`
  );
}

export async function ensureShortLink(
  eventId: string
): Promise<{ record: ShortLinkRecord; status: ShortLinkStatus }> {
  const record = await getOrCreateShortLink(eventId);
  const status = await getShortLinkStatus(record.key);
  return { record, status };
}

export function clearShortLinkCaches() {
  createCache.clear();
  statusCache.clear();
}
