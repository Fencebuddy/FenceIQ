/**
 * ROLE→UCK MAPPER SERVICE (V2 HARDENED)
 * 
 * Looks up logical fence roles against company-scoped FenceRoleConfig.
 * If role not found → returns CONFIG_MISSING (not unmapped).
 * If role found → returns catalog-backed UCK.
 * 
 * V2 ENHANCEMENTS:
 * - Role normalization (strips 5x5, 4x4, etc.)
 * - Direct catalog fallback if FenceRoleConfig fails
 * - Explicit warnings for role mapping failures
 * 
 * CRITICAL: No silent failures allowed.
 */

import { base44 } from '@/api/base44Client';
import { normalizeRole } from './roleNormalizer';

/**
 * Resolve a single role to its UCK (V2 HARDENED)
 * @returns { uck: string | null, status: 'MAPPED' | 'CONFIG_MISSING', reason?: string }
 */
export async function resolveRoleToUck(role, companyId, fenceRoleConfigs = [], catalog = null) {
  if (!role || !companyId) {
    return {
      uck: null,
      status: 'CONFIG_MISSING',
      reason: 'Missing role or companyId'
    };
  }

  // STEP 1: Try raw role lookup
  let mapping = fenceRoleConfigs.find(
    config => config.companyId === companyId && config.role === role && config.enabled
  );

  if (mapping && mapping.uck) {
    return {
      uck: mapping.uck,
      status: 'MAPPED',
      mappingId: mapping.id,
      normalizedRole: null
    };
  }

  // STEP 2: Try normalized role lookup
  const normalizedRole = normalizeRole(role);
  if (normalizedRole !== role) {
    mapping = fenceRoleConfigs.find(
      config => config.companyId === companyId && config.role === normalizedRole && config.enabled
    );

    if (mapping && mapping.uck) {
      console.warn(`[ROLE NORMALIZED] raw=${role} normalized=${normalizedRole} → UCK=${mapping.uck}`);
      return {
        uck: mapping.uck,
        status: 'MAPPED',
        mappingId: mapping.id,
        normalizedRole: normalizedRole,
        normalizedUsed: true
      };
    }
  }

  // STEP 3: FAILSAFE - Try direct catalog lookup (role AS uck)
  if (catalog && catalog.length > 0) {
    // Try raw role as UCK
    const catalogItem = catalog.find(c => c.canonical_key === role);
    if (catalogItem) {
      console.warn(`[UCK FALLBACK USED] role=${role} matched_uck=${role} catalog_id=${catalogItem.id}`);
      return {
        uck: role,
        status: 'MAPPED',
        mappingId: null,
        catalogFallbackUsed: true,
        catalogItemId: catalogItem.id
      };
    }

    // Try normalized role as UCK
    if (normalizedRole !== role) {
      const normalizedCatalogItem = catalog.find(c => c.canonical_key === normalizedRole);
      if (normalizedCatalogItem) {
        console.warn(`[UCK FALLBACK USED] role=${role} normalized=${normalizedRole} matched_uck=${normalizedRole} catalog_id=${normalizedCatalogItem.id}`);
        return {
          uck: normalizedRole,
          status: 'MAPPED',
          mappingId: null,
          normalizedRole: normalizedRole,
          catalogFallbackUsed: true,
          catalogItemId: normalizedCatalogItem.id
        };
      }
    }
  }

  // STEP 4: NOT FOUND - Emit warning
  console.warn(`[ROLE MAP MISS] raw=${role} normalized=${normalizedRole}`);
  
  return {
    uck: null,
    status: 'CONFIG_MISSING',
    reason: `No mapping for role '${role}' (normalized: '${normalizedRole}') in FenceRoleConfig or catalog`,
    normalizedRole: normalizedRole
  };
}

/**
 * Batch resolve roles to UCKs
 * Fetches FenceRoleConfig once, then applies to all roles
 */
export async function resolveRolesToUcks(roles, companyId) {
  if (!companyId || !roles || roles.length === 0) {
    return [];
  }

  // Fetch all active mappings for this company
  const fenceRoleConfigs = await base44.entities.FenceRoleConfig.filter({
    companyId,
    enabled: true
  });

  // Resolve each role
  return roles.map(role =>
    resolveRoleToUck(role, companyId, fenceRoleConfigs)
  );
}

/**
 * Apply Role→UCK mapping to takeoff line items (V2 HARDENED)
 * 
 * Resolution Order:
 * 1. FenceRoleConfig (raw role)
 * 2. FenceRoleConfig (normalized role)
 * 3. Direct catalog lookup (failsafe)
 * 4. Mark as CONFIG_MISSING (blocks pricing)
 * 
 * Returns { items, unmappedRoles }
 */
export async function applyRoleToUckMapping(lineItems, companyId, catalog = null) {
  if (!companyId || !lineItems || lineItems.length === 0) {
    return { items: lineItems, unmappedRoles: [] };
  }

  // Fetch all active mappings for this company
  const fenceRoleConfigs = await base44.entities.FenceRoleConfig.filter({
    companyId,
    enabled: true
  });

  const unmappedRoles = [];
  const mapped = lineItems.map(item => {
    const role = item.role || item.canonical_key; // Fall back to old-style UCK if no role
    
    if (!role) {
      return item; // Skip if no role/uck
    }

    // V2 HARDENED RESOLUTION - try all resolution paths
    const resolution = resolveRoleToUckSync(role, companyId, fenceRoleConfigs, catalog);

    if (resolution.status === 'MAPPED' && resolution.uck) {
      // Mapped - use UCK from resolution
      return {
        ...item,
        canonical_key: resolution.uck, // Store as canonical_key for resolver
        role: role, // Keep original role for debug
        roleToUckMappingId: resolution.mappingId,
        roleToUckMappingStatus: 'MAPPED',
        roleNormalized: resolution.normalizedRole,
        roleNormalizationUsed: resolution.normalizedUsed || false,
        catalogFallbackUsed: resolution.catalogFallbackUsed || false
      };
    } else {
      // Not mapped - CONFIG_MISSING
      unmappedRoles.push({
        role,
        normalizedRole: resolution.normalizedRole,
        lineItemName: item.lineItemName,
        quantityCalculated: item.quantityCalculated
      });
      
      return {
        ...item,
        canonical_key: null, // No UCK to resolve
        role: role,
        roleToUckMappingStatus: 'CONFIG_MISSING',
        roleToUckMappingReason: resolution.reason || `No mapping for role '${role}' in FenceRoleConfig`
      };
    }
  });

  return { items: mapped, unmappedRoles };
}

/**
 * Synchronous version of resolveRoleToUck for batch operations
 * Uses pre-fetched configs and catalog
 */
function resolveRoleToUckSync(role, companyId, fenceRoleConfigs = [], catalog = null) {
  if (!role || !companyId) {
    return {
      uck: null,
      status: 'CONFIG_MISSING',
      reason: 'Missing role or companyId'
    };
  }

  // STEP 1: Try raw role lookup
  let mapping = fenceRoleConfigs.find(
    config => config.companyId === companyId && config.role === role && config.enabled
  );

  if (mapping && mapping.uck) {
    return {
      uck: mapping.uck,
      status: 'MAPPED',
      mappingId: mapping.id,
      normalizedRole: null
    };
  }

  // STEP 2: Try normalized role lookup
  const normalizedRole = normalizeRole(role);
  if (normalizedRole !== role) {
    mapping = fenceRoleConfigs.find(
      config => config.companyId === companyId && config.role === normalizedRole && config.enabled
    );

    if (mapping && mapping.uck) {
      console.warn(`[ROLE NORMALIZED] raw=${role} normalized=${normalizedRole} → UCK=${mapping.uck}`);
      return {
        uck: mapping.uck,
        status: 'MAPPED',
        mappingId: mapping.id,
        normalizedRole: normalizedRole,
        normalizedUsed: true
      };
    }
  }

  // STEP 3: FAILSAFE - Try direct catalog lookup (role AS uck)
  if (catalog && catalog.length > 0) {
    // Try raw role as UCK
    const catalogItem = catalog.find(c => c.canonical_key === role);
    if (catalogItem) {
      console.warn(`[UCK FALLBACK USED] role=${role} matched_uck=${role} catalog_id=${catalogItem.id}`);
      return {
        uck: role,
        status: 'MAPPED',
        mappingId: null,
        catalogFallbackUsed: true,
        catalogItemId: catalogItem.id
      };
    }

    // Try normalized role as UCK
    if (normalizedRole !== role) {
      const normalizedCatalogItem = catalog.find(c => c.canonical_key === normalizedRole);
      if (normalizedCatalogItem) {
        console.warn(`[UCK FALLBACK USED] role=${role} normalized=${normalizedRole} matched_uck=${normalizedRole} catalog_id=${normalizedCatalogItem.id}`);
        return {
          uck: normalizedRole,
          status: 'MAPPED',
          mappingId: null,
          normalizedRole: normalizedRole,
          catalogFallbackUsed: true,
          catalogItemId: normalizedCatalogItem.id
        };
      }
    }
  }

  // STEP 4: NOT FOUND - Emit warning
  console.warn(`[ROLE MAP MISS] raw=${role} normalized=${normalizedRole}`);
  
  return {
    uck: null,
    status: 'CONFIG_MISSING',
    reason: `No mapping for role '${role}' (normalized: '${normalizedRole}') in FenceRoleConfig or catalog`,
    normalizedRole: normalizedRole
  };
}