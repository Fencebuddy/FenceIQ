/**
 * CANONICAL TENANT SOURCE
 * Single source of truth for active companyId
 * Prevents multi-tenant leaks and cross-company data bleeding
 */

import { base44 } from '@/api/base44Client';

let cachedCompanyId = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get active company ID for current session
 * @returns {Promise<string>} companyId
 * @throws {Error} if companyId cannot be resolved
 */
export async function getActiveCompanyId() {
  // Check cache first
  if (cachedCompanyId && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedCompanyId;
  }

  try {
    // Strategy: Use getCompanyContext function (already exists and scoped)
    const ctx = await base44.functions.invoke('getCompanyContext', {});
    
    if (!ctx?.data?.success || !ctx?.data?.companyId) {
      throw new Error('Company context not available');
    }

    cachedCompanyId = ctx.data.companyId;
    cacheTimestamp = Date.now();
    
    return cachedCompanyId;
  } catch (error) {
    console.error('[getActiveCompanyId] Failed to resolve company:', error);
    throw new Error('Cannot determine active company - multi-tenant safety block');
  }
}

/**
 * Clear cached company ID (use after logout/company switch)
 */
export function clearCompanyCache() {
  cachedCompanyId = null;
  cacheTimestamp = null;
}