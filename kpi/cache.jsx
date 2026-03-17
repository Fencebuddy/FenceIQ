/**
 * KPI CACHE SERVICE
 * In-memory cache with TTL for fast dashboard rendering
 */

const cache = new Map();
const TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate cache key from filters
 */
export function buildCacheKey(companyId, range, filters, groupBy) {
    const parts = [
        companyId,
        range.start,
        range.end,
        filters.repId || 'all',
        filters.territoryId || 'all',
        filters.leadSource || 'all',
        filters.productSystem || 'all',
        filters.financingOnly ? 'fin' : 'all',
        filters.installStage || 'all',
        filters.crewId || 'all',
        (groupBy || []).join(',')
    ];
    return `kpi:${parts.join(':')}`;
}

/**
 * Get cached value if not expired
 */
export function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > TTL) {
        cache.delete(key);
        return null;
    }
    
    console.log('[KPI Cache] Hit:', key);
    return entry.value;
}

/**
 * Store value in cache
 */
export function setCached(key, value) {
    cache.set(key, {
        value,
        timestamp: Date.now()
    });
    console.log('[KPI Cache] Set:', key);
}

/**
 * Clear all cache entries
 */
export function clearCache() {
    cache.clear();
    console.log('[KPI Cache] Cleared');
}

/**
 * Clear cache entries matching pattern
 */
export function clearCachePattern(companyId) {
    const pattern = `kpi:${companyId}:`;
    for (const key of cache.keys()) {
        if (key.startsWith(pattern)) {
            cache.delete(key);
        }
    }
    console.log('[KPI Cache] Cleared pattern:', pattern);
}