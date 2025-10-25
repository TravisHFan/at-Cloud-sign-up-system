/**
 * Email Deduplication Module
 *
 * Prevents duplicate emails from being sent within a configurable time window
 * Uses in-memory cache with TTL-based expiration
 */

import { EmailOptions } from "./EmailTransporter";

export class EmailDeduplication {
  // In-memory dedup cache: key -> lastSentAt (ms)
  private static dedupeCache: Map<string, number> = new Map();

  /**
   * Test-only: clear internal dedupe cache to avoid cross-test interference.
   * Safe to call in any environment; no effect on behavior other than cache state.
   */
  static __clearDedupeCacheForTests(): void {
    try {
      this.dedupeCache.clear();
    } catch {}
  }

  /**
   * Get deduplication TTL in milliseconds from environment or default
   */
  private static getDedupTtlMs(): number {
    const n = Number(process.env.EMAIL_DEDUP_TTL_MS || "120000");
    return Number.isFinite(n) && n > 0 ? n : 120000; // default 2 minutes
  }

  /**
   * Simple hash function for email content (djb2-like)
   */
  private static simpleHash(input: string): string {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 33) ^ input.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  /**
   * Generate a deduplication key from email options
   */
  private static makeDedupKey(options: EmailOptions): string {
    const toField = options.to;
    const primary = Array.isArray(toField) ? toField[0] || "" : toField || "";
    const email = primary.toString().trim().toLowerCase();
    const subject = (options.subject || "").trim();
    const bodySig = this.simpleHash(`${options.html}\n${options.text || ""}`);
    return `${email}|${subject}|${bodySig}`;
  }

  /**
   * Purge expired entries from cache
   */
  private static purgeExpiredDedup(now: number, ttl: number) {
    if (this.dedupeCache.size === 0) return;
    for (const [k, ts] of this.dedupeCache.entries()) {
      if (now - ts > ttl) this.dedupeCache.delete(k);
    }
  }

  /**
   * Check if deduplication is enabled via environment variable
   */
  static isDedupeEnabled(): boolean {
    // Explicit opt-in via env to avoid surprising behavior in tests/dev
    return process.env.EMAIL_DEDUP_ENABLE === "true";
  }

  /**
   * Check if email is a duplicate and should be skipped
   * Returns true if duplicate, false if should be sent
   * Also records the email in cache if not a duplicate
   */
  static isDuplicate(options: EmailOptions): boolean {
    if (!this.isDedupeEnabled()) return false;

    const now = Date.now();
    const ttl = this.getDedupTtlMs();
    const key = this.makeDedupKey(options);

    // Purge expired entries periodically
    this.purgeExpiredDedup(now, ttl);

    const lastSent = this.dedupeCache.get(key);
    if (lastSent && now - lastSent < ttl) {
      // Duplicate within TTL window
      return true;
    }

    // Not a duplicate - record in cache
    this.dedupeCache.set(key, now);
    return false;
  }
}
