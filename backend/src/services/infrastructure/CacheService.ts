/**
 * CacheService - In-Memory Cache with TTL and Smart Invalidation
 *
 * Provides high-performance caching for frequently accessed data including:
 * - Analytics data (counters, aggregations)
 * - Event listings with registration counts
 * - Role availability and signup counts
 * - User session data and permissions
 *
 * Features:
 * - TTL (Time To Live) support
 * - Smart cache invalidation
 * - Performance metrics
 * - Memory management
 * - Cache warming strategies
 */

import { EventEmitter } from "events";

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in seconds
  accessCount: number;
  lastAccessed: number;
  tags?: string[]; // For grouped invalidation
}

export interface CacheMetrics {
  totalKeys: number;
  totalMemoryUsage: number; // Estimated bytes
  hitCount: number;
  missCount: number;
  hitRate: number; // Percentage
  evictionCount: number;
  averageResponseTime: number;
  oldestEntry: number; // Timestamp
  mostAccessedKey: string | null;
}

export interface CacheOptions {
  defaultTtl?: number; // Default TTL in seconds
  maxSize?: number; // Maximum number of entries
  maxMemoryMB?: number; // Maximum memory usage in MB
  cleanupInterval?: number; // Cleanup interval in seconds
  enableMetrics?: boolean;
}

export interface CacheQueryOptions {
  ttl?: number;
  tags?: string[];
  skipCache?: boolean;
  refreshCache?: boolean;
}

type CacheEventType =
  | "hit"
  | "miss"
  | "set"
  | "delete"
  | "eviction"
  | "cleanup";

export class CacheService extends EventEmitter {
  private cache = new Map<string, CacheEntry>();
  private readonly options: Required<CacheOptions>;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private metrics: CacheMetrics;

  constructor(options: CacheOptions = {}) {
    super();

    this.options = {
      defaultTtl: options.defaultTtl ?? 300, // 5 minutes default
      maxSize: options.maxSize ?? 1000,
      maxMemoryMB: options.maxMemoryMB ?? 100,
      cleanupInterval: options.cleanupInterval ?? 60, // 1 minute
      enableMetrics: options.enableMetrics ?? true,
    };

    this.metrics = {
      totalKeys: 0,
      totalMemoryUsage: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      evictionCount: 0,
      averageResponseTime: 0,
      oldestEntry: 0,
      mostAccessedKey: null,
    };

    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.recordMiss();
        this.emit("miss", { key, timestamp: Date.now() });
        return null;
      }

      // Check if expired
      const now = Date.now();
      const isExpired = now - entry.timestamp > entry.ttl * 1000;

      if (isExpired) {
        this.cache.delete(key);
        this.recordMiss();
        this.emit("miss", { key, timestamp: now, reason: "expired" });
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = now;

      this.recordHit(Date.now() - startTime);
      this.emit("hit", { key, timestamp: now });

      return entry.data as T;
    } catch (error) {
      this.recordMiss();
      throw error;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheQueryOptions = {}
  ): Promise<void> {
    const ttl = options.ttl ?? this.options.defaultTtl;
    const now = Date.now();

    // Handle zero TTL (immediate expiration - don't cache)
    if (ttl === 0) {
      return;
    }

    // Check if we need to evict entries
    if (this.cache.size >= this.options.maxSize) {
      await this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: now,
      ttl,
      accessCount: 0,
      lastAccessed: now,
      tags: options.tags || [],
    };

    this.cache.set(key, entry);
    this.updateMetrics();

    this.emit("set", { key, ttl, tags: options.tags, timestamp: now });
  }

  /**
   * Delete specific key
   */
  async delete(key: string): Promise<boolean> {
    const existed = this.cache.delete(key);

    if (existed) {
      this.updateMetrics();
      this.emit("delete", { key, timestamp: Date.now() });
    }

    return existed;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const keyCount = this.cache.size;
    this.cache.clear();
    this.updateMetrics();

    this.emit("cleanup", {
      type: "manual",
      keysRemoved: keyCount,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let removedCount = 0;
    const toRemove: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags && entry.tags.some((tag) => tags.includes(tag))) {
        toRemove.push(key);
      }
    }

    toRemove.forEach((key) => {
      this.cache.delete(key);
      removedCount++;
    });

    if (removedCount > 0) {
      this.updateMetrics();
      this.emit("cleanup", {
        type: "tag-invalidation",
        tags,
        keysRemoved: removedCount,
        timestamp: Date.now(),
      });
    }

    return removedCount;
  }

  /**
   * Get or set pattern - execute function if cache miss
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheQueryOptions = {}
  ): Promise<T> {
    // Check for skip cache option
    if (options.skipCache) {
      return await fetchFunction();
    }

    // Check for refresh cache option
    if (options.refreshCache) {
      const value = await fetchFunction();
      await this.set(key, value, options);
      return value;
    }

    // Try to get from cache first
    const cachedValue = await this.get<T>(key);

    if (cachedValue !== null) {
      return cachedValue;
    }

    // Cache miss - fetch and store
    const value = await fetchFunction();
    await this.set(key, value, options);

    return value;
  }

  /**
   * Cache warming - preload commonly accessed data
   */
  async warmCache(
    entries: Array<{
      key: string;
      fetchFunction: () => Promise<any>;
      options?: CacheQueryOptions;
    }>
  ): Promise<void> {
    const promises = entries.map(async ({ key, fetchFunction, options }) => {
      try {
        const value = await fetchFunction();
        await this.set(key, value, options);
      } catch (error) {
        console.warn(`Failed to warm cache for key: ${key}`, error);
      }
    });

    await Promise.all(promises);

    this.emit("cleanup", {
      type: "cache-warming",
      keysAdded: entries.length,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get cache health information
   */
  getHealthInfo(): {
    status: "healthy" | "warning" | "critical";
    details: Record<string, any>;
  } {
    const metrics = this.getMetrics();
    const memoryUsageMB = metrics.totalMemoryUsage / (1024 * 1024);
    const hitRate = metrics.hitRate;

    let status: "healthy" | "warning" | "critical" = "healthy";
    const details: Record<string, any> = {
      memoryUsageMB: Math.max(0.01, Math.round(memoryUsageMB * 100) / 100), // Minimum 0.01 MB to show usage
      hitRate: Math.round(hitRate * 100) / 100,
      totalKeys: metrics.totalKeys,
      maxSizeUtilization: (metrics.totalKeys / this.options.maxSize) * 100,
    };

    // Determine health status (only if we have sufficient data)
    const totalRequests = metrics.hitCount + metrics.missCount;
    if (totalRequests > 5) {
      // Only check hit rate if we have enough data
      if (memoryUsageMB > this.options.maxMemoryMB * 0.9 || hitRate < 50) {
        status = "critical";
      } else if (
        memoryUsageMB > this.options.maxMemoryMB * 0.7 ||
        hitRate < 70
      ) {
        status = "warning";
      }
    }

    return { status, details };
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.options.cleanupInterval * 1000);
  }

  /**
   * Stop automatic cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      const isExpired = now - entry.timestamp > entry.ttl * 1000;

      if (isExpired) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.updateMetrics();
      this.emit("cleanup", {
        type: "expired",
        keysRemoved: removedCount,
        timestamp: now,
      });
    }
  }

  /**
   * Evict least recently used entries
   */
  private async evictLeastRecentlyUsed(): Promise<void> {
    if (this.cache.size === 0) return;

    // Sort by last accessed time
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.lastAccessed - b.lastAccessed
    );

    // Remove oldest 10% of entries
    const toRemove = Math.max(1, Math.floor(this.cache.size * 0.1));

    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
      this.metrics.evictionCount++;
    }

    this.updateMetrics();
    this.emit("eviction", {
      keysRemoved: toRemove,
      timestamp: Date.now(),
    });
  }

  /**
   * Record cache hit
   */
  private recordHit(responseTime: number): void {
    if (!this.options.enableMetrics) return;

    this.metrics.hitCount++;

    // Update average response time
    const totalHits = this.metrics.hitCount;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (totalHits - 1) + responseTime) /
      totalHits;
  }

  /**
   * Record cache miss
   */
  private recordMiss(): void {
    if (!this.options.enableMetrics) return;

    this.metrics.missCount++;
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    if (!this.options.enableMetrics) return;

    this.metrics.totalKeys = this.cache.size;
    this.metrics.totalMemoryUsage = this.estimateMemoryUsage();

    const totalRequests = this.metrics.hitCount + this.metrics.missCount;
    this.metrics.hitRate =
      totalRequests > 0 ? (this.metrics.hitCount / totalRequests) * 100 : 0;

    // Find oldest entry and most accessed key
    let oldestTimestamp = Date.now();
    let mostAccessedCount = 0;
    let mostAccessedKey: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }

      if (entry.accessCount > mostAccessedCount) {
        mostAccessedCount = entry.accessCount;
        mostAccessedKey = key;
      }
    }

    this.metrics.oldestEntry = oldestTimestamp;
    this.metrics.mostAccessedKey = mostAccessedKey;
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Rough estimation: key size + JSON.stringify size + metadata overhead
      totalSize += key.length * 2; // UTF-16 chars
      totalSize += JSON.stringify(entry.data).length * 2;
      totalSize += 100; // Metadata overhead
    }

    return totalSize;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.stopCleanupTimer();
    this.cache.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const cacheService = new CacheService({
  defaultTtl: 300, // 5 minutes
  maxSize: 2000,
  maxMemoryMB: 150,
  cleanupInterval: 60,
  enableMetrics: true,
});

// Convenience methods for common caching patterns
export class CachePatterns {
  /**
   * Cache analytics data with 10-minute TTL
   */
  static async getAnalyticsData<T>(
    key: string,
    fetchFunction: () => Promise<T>
  ): Promise<T> {
    return cacheService.getOrSet(key, fetchFunction, {
      ttl: 600, // 10 minutes
      tags: ["analytics"],
    });
  }

  /**
   * Cache event listings with 2-minute TTL
   */
  static async getEventListing<T>(
    key: string,
    fetchFunction: () => Promise<T>
  ): Promise<T> {
    return cacheService.getOrSet(key, fetchFunction, {
      ttl: 120, // 2 minutes
      tags: ["events", "listings"],
    });
  }

  /**
   * Cache role availability with 1-minute TTL
   */
  static async getRoleAvailability<T>(
    eventId: string,
    roleId: string,
    fetchFunction: () => Promise<T>
  ): Promise<T> {
    const key = `role-availability:${eventId}:${roleId}`;
    return cacheService.getOrSet(key, fetchFunction, {
      ttl: 60, // 1 minute
      tags: ["roles", "events", `event:${eventId}`],
    });
  }

  /**
   * Cache user session data with 30-minute TTL
   */
  static async getUserSession<T>(
    userId: string,
    fetchFunction: () => Promise<T>
  ): Promise<T> {
    const key = `user-session:${userId}`;
    return cacheService.getOrSet(key, fetchFunction, {
      ttl: 1800, // 30 minutes
      tags: ["users", "sessions", `user:${userId}`],
    });
  }

  /**
   * Cache user listings with 2-minute TTL
   */
  static async getUserListing<T>(
    key: string,
    fetchFunction: () => Promise<T>
  ): Promise<T> {
    return cacheService.getOrSet(key, fetchFunction, {
      ttl: 120, // 2 minutes
      tags: ["users", "listings"],
    });
  }

  /**
   * Cache search results with 1-minute TTL (shorter due to dynamic nature)
   */
  static async getSearchResults<T>(
    key: string,
    fetchFunction: () => Promise<T>
  ): Promise<T> {
    return cacheService.getOrSet(key, fetchFunction, {
      ttl: 60, // 1 minute
      tags: ["search", "users", "events"],
    });
  }

  /**
   * Invalidate event-related caches
   */
  static async invalidateEventCache(eventId: string): Promise<void> {
    await cacheService.invalidateByTags([
      "events",
      "listings",
      "roles",
      "search",
      `event:${eventId}`,
    ]);
  }

  /**
   * Invalidate user-related caches
   */
  static async invalidateUserCache(userId: string): Promise<void> {
    await cacheService.invalidateByTags([
      "users",
      "sessions",
      "listings",
      "search",
      `user:${userId}`,
    ]);
  }

  /**
   * Invalidate analytics caches
   */
  static async invalidateAnalyticsCache(): Promise<void> {
    await cacheService.invalidateByTags(["analytics"]);
  }
}
