// Lightweight LRU cache with TTL and optional negative caching support.
// We avoid external deps to keep footprint small.
// Keys: string; Values generic.
// Eviction: on set when size exceeds max; also opportunistic cleanup on get.

export interface LruCacheOptions {
  maxSize: number; // maximum number of positive entries
  ttlMs: number; // time to live for positive entries
  negativeTtlMs?: number; // time to live for negative (miss) entries
  enableNegative?: boolean; // store negative lookups
}

interface InternalEntry<V> {
  key: string;
  value?: V; // undefined signifies negative cache if negative flag true
  expiresAt: number; // epoch ms
  negative: boolean;
  prev?: InternalEntry<V> | null;
  next?: InternalEntry<V> | null;
}

export class LruCache<V> {
  private map = new Map<string, InternalEntry<V>>();
  private head: InternalEntry<V> | null = null; // MRU
  private tail: InternalEntry<V> | null = null; // LRU
  private positiveCount = 0; // track number of non-negative entries
  private opts: Required<LruCacheOptions>;

  constructor(opts: LruCacheOptions) {
    if (opts.maxSize <= 0) throw new Error("maxSize must be > 0");
    if (opts.ttlMs <= 0) throw new Error("ttlMs must be > 0");
    this.opts = {
      negativeTtlMs: 30_000,
      enableNegative: false,
      ...opts,
    } as Required<LruCacheOptions>;
  }

  private unlink(entry: InternalEntry<V>): void {
    if (entry.prev) entry.prev.next = entry.next;
    else this.head = entry.next || null;
    if (entry.next) entry.next.prev = entry.prev;
    else this.tail = entry.prev || null;
    entry.prev = entry.next = undefined;
  }

  private linkAtHead(entry: InternalEntry<V>): void {
    entry.prev = null;
    entry.next = this.head;
    if (this.head) this.head.prev = entry;
    this.head = entry;
    if (!this.tail) this.tail = entry;
  }

  private evictIfNeeded(): number {
    let evicted = 0;
    while (this.positiveCount > this.opts.maxSize && this.tail) {
      const toRemove = this.tail;
      this.removeEntry(toRemove);
      evicted++;
    }
    return evicted;
  }

  private removeEntry(entry: InternalEntry<V>): void {
    this.unlink(entry);
    this.map.delete(entry.key);
    if (!entry.negative) this.positiveCount--;
  }

  size(): number {
    return this.positiveCount;
  }

  /** Clear all cached entries (including negative). */
  clear(): void {
    this.map.clear();
    this.head = this.tail = null;
    this.positiveCount = 0;
  }

  /** Get value; returns undefined if miss or if negative cached miss. "negative" indicates negative cache hit. */
  get(key: string): { hit: boolean; value?: V; negative?: boolean } {
    const entry = this.map.get(key);
    if (!entry) return { hit: false };
    if (entry.expiresAt < Date.now()) {
      this.removeEntry(entry);
      return { hit: false };
    }
    // Move to head (MRU)
    this.unlink(entry);
    this.linkAtHead(entry);
    if (entry.negative) return { hit: true, negative: true };
    return { hit: true, value: entry.value };
  }

  /** Set positive value. Returns number of evicted positive entries. */
  set(key: string, value: V): number {
    let entry = this.map.get(key);
    const expiresAt = Date.now() + this.opts.ttlMs;
    if (entry) {
      if (entry.negative) {
        // upgrading from negative to positive
        entry.negative = false;
        this.positiveCount++;
      }
      entry.value = value;
      entry.expiresAt = expiresAt;
      this.unlink(entry);
      this.linkAtHead(entry);
    } else {
      entry = { key, value, expiresAt, negative: false };
      this.map.set(key, entry);
      this.linkAtHead(entry);
      this.positiveCount++;
    }
    const evicted = this.evictIfNeeded();
    return evicted;
  }

  /** Record negative (not found / expired) if enabled */
  setNegative(key: string): void {
    if (!this.opts.enableNegative) return;
    const ttl = this.opts.negativeTtlMs;
    const expiresAt = Date.now() + ttl;
    let entry = this.map.get(key);
    if (entry) {
      if (!entry.negative) {
        // convert positive to negative (rare)
        entry.negative = true;
        entry.value = undefined;
        this.positiveCount--;
      }
      entry.expiresAt = expiresAt;
      this.unlink(entry);
      this.linkAtHead(entry);
    } else {
      entry = { key, expiresAt, negative: true };
      this.map.set(key, entry);
      this.linkAtHead(entry);
    }
  }

  /** Delete an entry (positive or negative) */
  delete(key: string): void {
    const entry = this.map.get(key);
    if (!entry) return;
    this.removeEntry(entry);
  }
}

export default LruCache;
