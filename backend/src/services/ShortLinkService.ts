import { Types } from "mongoose";
import ShortLink, { IShortLink } from "../models/ShortLink";
import Event from "../models/Event";
import { generateUniqueShortKey } from "../utils/shortLinkKey";
import { createLogger } from "./LoggerService";
import LruCache from "../utils/lru";
import {
  shortLinkCacheHitCounter,
  shortLinkCacheMissCounter,
  shortLinkCacheEvictionCounter,
  shortLinkCacheEntriesGauge,
  shortLinkExpireCounter,
} from "./PrometheusMetricsService";

const log = createLogger("ShortLinkService");

// Initialize single in-process LRU cache for short link resolutions.
// Configurable via env; defaults chosen for moderate memory footprint.
const MAX = parseInt(process.env.SHORTLINK_CACHE_MAX || "3000", 10);
const TTL_MS = parseInt(process.env.SHORTLINK_CACHE_TTL_MS || "300000", 10); // 5m
const NEG_TTL_MS = parseInt(
  process.env.SHORTLINK_CACHE_NEGATIVE_TTL_MS || "30000",
  10
); // 30s

// Store active links: key -> { slug, eventId, expiresAtMs }
// We include expiresAtMs so that if a link expires sooner than the cache TTL,
// we can invalidate it on lookup and return 410 (expired) instead of serving
// a stale active entry.
type CacheValue = { slug: string; eventId: string; expiresAtMs: number };

const shortLinkCache = new LruCache<CacheValue>({
  maxSize: MAX,
  ttlMs: TTL_MS,
  negativeTtlMs: NEG_TTL_MS,
  enableNegative: true,
});

function recordEvictions(evicted: number) {
  if (!evicted) return;
  try {
    shortLinkCacheEvictionCounter.inc(evicted);
  } catch {}
}

function updateEntriesGauge() {
  try {
    shortLinkCacheEntriesGauge.set(shortLinkCache.size());
  } catch {}
}

export type ShortLinkCreationResult = {
  created: boolean;
  shortLink: IShortLink;
};

export class ShortLinkService {
  /**
   * Compute expiry for a short link: use event end date/time if possible, otherwise default +30 days.
   */
  static computeExpiry(event: {
    endDate?: string;
    endTime?: string;
    date?: string;
    time?: string;
  }): Date {
    try {
      if (event?.endDate && event?.endTime) {
        const iso = `${event.endDate}T${event.endTime}:00Z`; // assume stored as wall clock w/out TZ; treat as UTC fallback
        const d = new Date(iso);
        if (!isNaN(d.getTime())) return d;
      }
    } catch {}
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  }

  /**
   * Get existing active short link for event (idempotent) or create a new one.
   * Validates publish status & at least one public role.
   */
  static async getOrCreateForEvent(
    eventId: string,
    userId: string
  ): Promise<ShortLinkCreationResult> {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new Error("Invalid eventId");
    }

    const event = await Event.findById(eventId).select(
      "publish publicSlug roles date endDate time endTime"
    );
    if (!event) {
      throw new Error("Event not found");
    }
    if (!event.publish || !event.publicSlug) {
      throw new Error("Event is not published");
    }
    const hasPublicRole =
      Array.isArray(event.roles) &&
      event.roles.some(
        (r: { openToPublic?: boolean }) => r.openToPublic === true
      );
    if (!hasPublicRole) {
      throw new Error("Event has no public roles");
    }

    // Idempotent: return existing active (not expired) link if present
    const existing = await ShortLink.findOne({
      eventId: event._id,
      isExpired: false,
      expiresAt: { $gt: new Date() },
    });
    if (existing) {
      return { created: false, shortLink: existing };
    }

    const key = await generateUniqueShortKey();
    const expiresAt = ShortLinkService.computeExpiry({
      endDate: (event as unknown as { endDate?: string }).endDate,
      endTime: (event as unknown as { endTime?: string }).endTime,
      date: (event as unknown as { date?: string }).date,
      time: (event as unknown as { time?: string }).time,
    });

    const shortLink = await ShortLink.create({
      key,
      eventId: event._id,
      targetSlug: event.publicSlug,
      createdBy: new Types.ObjectId(userId),
      expiresAt,
      isExpired: false,
    });

    // Prime cache with new active link (best-effort)
    try {
      const evicted = shortLinkCache.set(key, {
        slug: shortLink.targetSlug,
        eventId: shortLink.eventId.toString(),
        expiresAtMs: expiresAt.getTime(),
      });
      updateEntriesGauge();
      recordEvictions(evicted);
    } catch {}

    log.info("Short link created", undefined, {
      key,
      eventId: event._id.toString(),
      expiresAt: expiresAt.toISOString(),
    });

    return { created: true, shortLink };
  }

  /**
   * Resolve key into redirect target.
   * Returns: { status: "active" | "expired" | "not_found", slug?: string }
   */
  static async resolveKey(
    key: string
  ): Promise<
    | { status: "active"; slug: string; eventId: string }
    | { status: "expired" }
    | { status: "not_found" }
  > {
    // 1. Attempt cache lookup
    try {
      const { hit, value, negative } = shortLinkCache.get(key);
      if (hit) {
        if (negative) {
          shortLinkCacheHitCounter.inc({ type: "negative" });
          return { status: "not_found" };
        }
        if (value) {
          // If cached entry has passed its own expiry, evict and treat as miss (will fall through to DB logic below)
          if (value.expiresAtMs <= Date.now()) {
            try {
              shortLinkCache.delete(key);
              updateEntriesGauge();
            } catch {}
          } else {
            shortLinkCacheHitCounter.inc({ type: "positive" });
            return {
              status: "active",
              slug: value.slug,
              eventId: value.eventId,
            };
          }
        }
        // fall through as miss
        shortLinkCacheMissCounter.inc();
      } else {
        shortLinkCacheMissCounter.inc();
      }
    } catch {}

    const link = await ShortLink.getActiveByKey(key);
    if (link) {
      // Populate cache
      try {
        const evicted = shortLinkCache.set(key, {
          slug: link.targetSlug,
          eventId: link.eventId.toString(),
          expiresAtMs: link.expiresAt?.getTime?.() || Date.now(),
        });
        updateEntriesGauge();
        recordEvictions(evicted);
      } catch {}
      return {
        status: "active",
        slug: link.targetSlug,
        eventId: link.eventId.toString(),
      };
    }
    // Check if it ever existed (for 410 vs 404 differentiation)
    const anyLink = await ShortLink.findOne({ key }).select(
      "isExpired expiresAt"
    );
    if (!anyLink) {
      try {
        shortLinkCache.setNegative(key);
      } catch {}
      return { status: "not_found" };
    }
    return { status: "expired" };
  }

  /** Mark all links for an event expired (e.g. on unpublish) */
  static async expireAllForEvent(eventId: string): Promise<number> {
    if (!Types.ObjectId.isValid(eventId)) return 0;
    const res = await ShortLink.updateMany(
      { eventId: new Types.ObjectId(eventId), isExpired: false },
      { $set: { isExpired: true, expiresAt: new Date() } }
    );
    log.info("Expired short links for event", undefined, {
      eventId,
      modified: res.modifiedCount,
    });
    // Invalidate any cache entries for this event (linear scan of modest size)
    try {
      // We don't have reverse index; iterate map keys (bounded by max size)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internal: any = shortLinkCache as any;
      const map: Map<string, unknown> = internal.map; // relying on internal shape; acceptable within service boundary
      const toDelete: string[] = [];
      const now = Date.now();
      map.forEach((entry: any, key: string) => {
        if (entry?.expiresAt < now) return; // skip already expired in cache
        if (!entry?.negative && entry?.value?.eventId === eventId) {
          toDelete.push(key);
        }
      });
      for (const k of toDelete) shortLinkCache.delete(k);
      if (toDelete.length) updateEntriesGauge();
      try {
        shortLinkExpireCounter.inc();
      } catch {}
    } catch {}
    return res.modifiedCount || 0;
  }

  /** INTERNAL: test helper to clear cache between unit tests to avoid cross-test pollution */
  static __clearCacheForTests(): void {
    try {
      shortLinkCache.clear();
      updateEntriesGauge();
    } catch {}
  }
}

export default ShortLinkService;
