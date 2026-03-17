/**
 * STRICT V2 RESOLVER GUARDS
 * 
 * Enforces Genesis mode restrictions:
 * - NO legacy V1 resolver paths
 * - NO localStorage fallbacks
 * - NO direct MaterialCatalog text matching
 * - ONLY CompanySkuMap with deterministic mappingKey resolution
 */

const BLOCKED_PATHS = {
    LEGACY_RESOLVER: 'LEGACY_PATH_BLOCKED',
    LOCALSTORAGE_ACCESS: 'LOCALSTORAGE_BLOCKED',
    DIRECT_CATALOG_MATCH: 'DIRECT_CATALOG_BLOCKED',
    FALLBACK_ATTEMPTED: 'FALLBACK_BLOCKED'
};

export class StrictV2ResolverGuards {
    constructor(companySettings = {}) {
        this.genesisMode = companySettings.genesisResolverMode === true;
        this.catalogOnlyMode = companySettings.useMaterialCatalogOnly === true;
        this.allowFallbacks = companySettings.allowResolverFallbacks === true;
        this.useUniversalResolver = companySettings.useUniversalResolver === true;
    }

    /**
     * Enforce strict resolution rules
     * @throws {Error} if Genesis mode is violated
     */
    validateResolution(context) {
        if (!this.genesisMode && !this.useUniversalResolver) {
            // V1 mode - allow legacy paths
            return { allowed: true };
        }

        const { resolverPhase, dataSource, fallbackUsed, localStorageAccess } = context;

        // Block localStorage access
        if (localStorageAccess) {
            throw new Error(BLOCKED_PATHS.LOCALSTORAGE_ACCESS + ': Genesis mode forbids localStorage takeoff');
        }

        // Block fallbacks if not explicitly enabled
        if (fallbackUsed && !this.allowFallbacks) {
            throw new Error(BLOCKED_PATHS.FALLBACK_ATTEMPTED + ': Resolver fallbacks disabled in Genesis mode');
        }

        // Block direct catalog matching
        if (dataSource === 'CATALOG_TEXT_MATCH') {
            throw new Error(BLOCKED_PATHS.DIRECT_CATALOG_MATCH + ': Direct MaterialCatalog matching forbidden in Genesis mode');
        }

        // Require CompanySkuMap resolution
        if (dataSource !== 'COMPANY_SKU_MAP' && dataSource !== 'UNRESOLVED') {
            console.warn(`[StrictV2] Unexpected dataSource: ${dataSource}`);
        }

        return { allowed: true };
    }

    /**
     * Validate that only approved resolution pathways are used
     */
    validateResolutionPath(path) {
        const ALLOWED_PATHS = [
            'COMPANY_SKU_MAP_LOCKED',
            'COMPANY_SKU_MAP_UNLOCKED',
            'UNRESOLVED'
        ];

        if (this.genesisMode && !ALLOWED_PATHS.includes(path)) {
            throw new Error(`RESOLUTION_PATH_BLOCKED: ${path} not allowed in Genesis mode`);
        }
    }

    /**
     * Guard against legacy V1 resolver invocation
     */
    blockLegacyResolver(resolverName) {
        if (this.genesisMode) {
            throw new Error(`${BLOCKED_PATHS.LEGACY_RESOLVER}: ${resolverName} blocked in Genesis mode`);
        }
    }

    /**
     * Guard against localStorage takeoff access
     */
    blockLocalStorageAccess() {
        if (this.genesisMode || this.useUniversalResolver) {
            throw new Error(`${BLOCKED_PATHS.LOCALSTORAGE_ACCESS}: Genesis/Universal mode forbids localStorage`);
        }
    }

    /**
     * Return human-readable error for UI
     */
    formatGuardError(error) {
        const message = error.message || error.toString();
        
        if (message.includes(BLOCKED_PATHS.LOCALSTORAGE_ACCESS)) {
            return {
                code: BLOCKED_PATHS.LOCALSTORAGE_ACCESS,
                userMessage: 'Takeoff data from storage is not allowed in Genesis mode',
                action: 'Rebuild takeoff from map data'
            };
        }

        if (message.includes(BLOCKED_PATHS.LEGACY_RESOLVER)) {
            return {
                code: BLOCKED_PATHS.LEGACY_RESOLVER,
                userMessage: 'Legacy resolver is disabled in Genesis mode',
                action: 'Use V2 CompanySkuMap resolver'
            };
        }

        if (message.includes(BLOCKED_PATHS.FALLBACK_ATTEMPTED)) {
            return {
                code: BLOCKED_PATHS.FALLBACK_ATTEMPTED,
                userMessage: 'Material mapping is incomplete - fallbacks disabled',
                action: 'Map missing UCKs in Fence System Config'
            };
        }

        if (message.includes(BLOCKED_PATHS.DIRECT_CATALOG_MATCH)) {
            return {
                code: BLOCKED_PATHS.DIRECT_CATALOG_MATCH,
                userMessage: 'Direct catalog matching is not allowed',
                action: 'Use deterministic UCK-based resolution'
            };
        }

        return {
            code: 'UNKNOWN_GUARD_ERROR',
            userMessage: message,
            action: 'Contact support'
        };
    }
}

export default StrictV2ResolverGuards;