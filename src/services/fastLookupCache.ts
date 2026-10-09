/**
 * FastLookupCache - Enterprise In-Memory SWR Cache & Deduplication for Kuyumcu ERP
 * Provides instantaneous (0ms) data access for lookups, currencies, tellers, products,
 * and company definitions with Stale-While-Revalidate and background preloading.
 */

import { apiClient } from "./apiClient";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class FastLookupCacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default freshness

  /**
   * Get cached data or execute fetcher with deduplication and Stale-While-Revalidate
   */
  public async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = this.defaultTTL
  ): Promise<T> {
    const entry = this.cache.get(key);
    const now = Date.now();

    // If cached and still valid
    if (entry) {
      // If expired, trigger background revalidation silently
      if (now - entry.timestamp > ttlMs) {
        this.revalidateInBackground(key, fetcher);
      }
      return entry.data as T;
    }

    // If request is already in-flight, return the existing promise
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key)! as Promise<T>;
    }

    // Execute new fetcher and deduplicate
    const promise = fetcher()
      .then((data) => {
        if (data !== null && data !== undefined) {
          this.cache.set(key, { data, timestamp: Date.now() });
        }
        return data;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Get synchronous value if exists in cache (0ms)
   */
  public getSync<T>(key: string): T | undefined {
    return this.cache.get(key)?.data as T | undefined;
  }

  /**
   * Set value in cache directly
   */
  public set<T>(key: string, data: T): void {
    if (data !== null && data !== undefined) {
      this.cache.set(key, { data, timestamp: Date.now() });
    }
  }

  /**
   * Invalidate specific key or keys starting with prefix
   */
  public invalidate(keyOrPrefix: string): void {
    for (const k of this.cache.keys()) {
      if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) {
        this.cache.delete(k);
      }
    }
  }

  /**
   * Clear entire cache
   */
  public clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  private revalidateInBackground<T>(key: string, fetcher: () => Promise<T>): void {
    if (this.inFlight.has(key)) return;
    const promise = fetcher()
      .then((data) => {
        if (data !== null && data !== undefined) {
          this.cache.set(key, { data, timestamp: Date.now() });
        }
        return data;
      })
      .catch(() => {
        // Keep stale cache on background network error
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, promise);
  }

  /**
   * Pre-warm all critical ERP lookups in parallel
   */
  public preloadAll(): void {
    const token = localStorage.getItem("kuyumcu_erp_access_token");
    if (!token) return;

    // Fire preloads concurrently in low priority background
    Promise.allSettled([
      this.get("vezneler", () => apiClient.get("/vezne").then((r) => r.data || [])),
      this.get("paralar", () => apiClient.get("/para").then((r) => r.data || [])),
      this.get("urunler", () => apiClient.get("/sarraf-fis/urunler").then((r) => r.data || [])),
      this.get("cariKartlar", () => apiClient.get("/cari").then((r) => r.data || [])),
      this.get("cariLookups", () => apiClient.get("/cari/lookups").then((r) => r.data || null)),
      this.get("companyDefinitions", () => apiClient.get("/company/definitions").then((r) => r.data || null)),
      this.get("kurTablo_0", () => apiClient.get("/kur/tablo", { tur: 0 }).then((r) => r.data || null)),
      this.get("kurTablo_1", () => apiClient.get("/kur/tablo", { tur: 1 }).then((r) => r.data || null)),
      this.get("statistics", () => apiClient.get("/istatistik").then((r) => r.data || [])),
      this.get("numerators", () => apiClient.get("/numerator").then((r) => r.data || [])),
      this.get("bankalar", () => apiClient.get("/banka/hesaplar", { aktif: true }).then((r) => r.data || [])),
      this.get("poslar", () => apiClient.get("/banka/pos-cihazlari").then((r) => r.data || [])),
      this.get("iskontolar", () => apiClient.get("/iskonto", { aktif: true }).then((r) => r.data || [])),
      this.get("kayitsizMusteriler", () => apiClient.get("/doviz-fis/kayitsiz-musteriler").then((r) => r.data || [])),
    ]).catch(() => {});
  }
}

export const FastLookupCache = new FastLookupCacheManager();
