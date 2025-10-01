import crypto from "crypto";
import LruCache from "../utils/lru";

export interface PublicEventsListParams {
  page: number;
  pageSize: number;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  sort?: string;
}

interface CacheEntry {
  etag: string;
  payload: unknown;
  createdAt: number;
}

// Config
const MAX = parseInt(process.env.PUBLIC_EVENTS_LIST_CACHE_MAX || "300", 10);
const TTL_MS = parseInt(
  process.env.PUBLIC_EVENTS_LIST_CACHE_TTL_MS || "60000",
  10
); // 60s

let version = 2; // bumped after adding `type` to list payload

const cache = new LruCache<CacheEntry>({ maxSize: MAX, ttlMs: TTL_MS });

function stableKey(params: PublicEventsListParams): string {
  const base = JSON.stringify([
    version,
    params.page,
    params.pageSize,
    params.type || "",
    params.dateFrom || "",
    params.dateTo || "",
    params.q || "",
    params.sort || "startAsc",
  ]);
  return crypto.createHash("sha1").update(base).digest("hex");
}

export function bumpPublicEventsListVersion(): void {
  version += 1;
}

export async function getOrSetPublicEventsList(
  params: PublicEventsListParams,
  loader: () => Promise<unknown>
): Promise<CacheEntry> {
  const key = stableKey(params);
  const found = cache.get(key);
  if (found.hit && found.value) {
    return found.value;
  }
  const payload = await loader();
  // ETag is hash of key + short hash of payload JSON
  const json = JSON.stringify(payload);
  const etagHash = crypto
    .createHash("sha1")
    .update(key + json)
    .digest("hex");
  const etag = `W/"ple-${etagHash}"`;
  const entry: CacheEntry = { etag, payload, createdAt: Date.now() };
  cache.set(key, entry);
  return entry;
}

export const __TEST__ = {
  clear() {
    cache.clear();
  },
  getVersion() {
    return version;
  },
};
