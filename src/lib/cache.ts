/**
 * Simple in-memory cache for configuration and frequently accessed data
 * Helps reduce file I/O and database queries
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class Cache {
  private store: Map<string, CacheEntry<any>> = new Map();

  /**
   * Get cached value if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set a cached value with TTL (time to live in milliseconds)
   * Default TTL is 5 minutes (300000 ms)
   */
  set<T>(key: string, data: T, ttl: number = 300000): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache if not found
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 300000
  ): Promise<T> {
    const cached = this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }

  /**
   * Clean up expired entries (garbage collection)
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.store.entries()) {
      const isExpired = now - entry.timestamp > entry.ttl;
      if (isExpired) {
        this.store.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

// Export singleton instance
export const cache = new Cache();

// Store interval ID for cleanup
let cleanupIntervalId: NodeJS.Timeout | null = null;

// Run cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  cleanupIntervalId = setInterval(() => {
    const removed = cache.cleanup();
    if (removed > 0) {
      console.log(`[CACHE] Cleaned up ${removed} expired entries`);
    }
  }, 10 * 60 * 1000); // 10 minutes
}

// Cleanup function to stop the interval
export function stopCacheCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}
