/**
 * EXECUTIVE STATE CACHE
 * 60 second TTL to prevent recomputation on every render
 */

const cache = new Map();
const TTL_MS = 60 * 1000; // 60 seconds

export function getCachedState(companyId, range) {
  const key = `${companyId}:${range}`;
  const entry = cache.get(key);
  
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > TTL_MS) {
    cache.delete(key);
    return null;
  }
  
  return entry.state;
}

export function setCachedState(companyId, range, state) {
  const key = `${companyId}:${range}`;
  cache.set(key, {
    state,
    timestamp: Date.now()
  });
}

export function clearCache() {
  cache.clear();
}