/**
 * MAPPING VALIDATION GUARDRAIL
 * Prevents field-unsafe mappings (e.g., 48" fabric → 6ft canonical key)
 * CRITICAL: Must run before all CompanyMaterialMapping writes
 */

/**
 * Parse height expectations from canonical key
 * Returns height in inches or null
 */
function parseCanonicalHeight(role_key) {
    const lower = role_key.toLowerCase();
    
    // Direct height patterns
    if (lower.includes('_4ft_') || lower.includes('_4_')) return 48;
    if (lower.includes('_5ft_') || lower.includes('_5_')) return 60;
    if (lower.includes('_6ft_') || lower.includes('_6_')) return 72;
    if (lower.includes('_8ft_') || lower.includes('_8_')) return 96;
    if (lower.includes('_10ft_') || lower.includes('_10_')) return 120;
    
    return null;
}

/**
 * Parse coating expectations from canonical key
 * Returns 'galvanized' | 'aluminized' | 'black_vinyl' | null
 */
function parseCanonicalCoating(role_key) {
    const lower = role_key.toLowerCase();
    
    if (lower.includes('blk') && (lower.includes('vnl') || lower.includes('vinyl'))) {
        return 'black_vinyl';
    }
    if (lower.includes('aluminized') || lower.includes('alum')) {
        return 'aluminized';
    }
    if (lower.includes('galv')) {
        return 'galvanized';
    }
    
    return null;
}

/**
 * Parse height from supplier product name
 * Returns height in inches or null
 */
function parseProductHeight(product_name) {
    if (!product_name) return null;
    
    const lower = product_name.toLowerCase();
    
    // Pattern: x48in, x60in, x72in
    const xPattern = /x(\d+)in/i;
    const xMatch = lower.match(xPattern);
    if (xMatch) return parseInt(xMatch[1]);
    
    // Pattern: 48", 60", 72"
    const inchPattern = /(\d+)"/;
    const inchMatch = product_name.match(inchPattern);
    if (inchMatch) return parseInt(inchMatch[1]);
    
    // Pattern: 4ft, 5ft, 6ft
    const ftPattern = /(\d+)ft/i;
    const ftMatch = lower.match(ftPattern);
    if (ftMatch) return parseInt(ftMatch[1]) * 12;
    
    return null;
}

/**
 * Parse coating from supplier product name
 * Returns 'galvanized' | 'aluminized' | 'black_vinyl' | null
 */
function parseProductCoating(product_name) {
    if (!product_name) return null;
    
    const upper = product_name.toUpperCase();
    
    if (upper.includes('BLK') && (upper.includes('VNL') || upper.includes('VINYL'))) {
        return 'black_vinyl';
    }
    if (upper.includes('ALUMINIZED') || upper.includes('ALUM')) {
        return 'aluminized';
    }
    if (upper.includes('GALV') || upper.includes('HOT DIP')) {
        return 'galvanized';
    }
    
    return null;
}

/**
 * Check if canonical key is a chain link fabric item that requires strict validation
 */
function isFabricCanonicalKey(role_key) {
    if (!role_key) return false;
    const lower = role_key.toLowerCase();
    return lower.startsWith('chainlink_fabric_') || 
           lower.includes('_fabric_') || 
           lower.includes('_mesh_');
}

/**
 * MAIN VALIDATION: Checks if mapping is compatible
 * Throws error with actionable message if incompatible
 * 
 * @param {Object} mapping - { role_key, supplier_product_name, unit_of_measure, family }
 * @throws {Error} if validation fails
 */
export function validateMappingCompatibility(mapping) {
    const { role_key, supplier_product_name, unit_of_measure, family } = mapping;
    
    // Only validate fabric items strictly
    if (!isFabricCanonicalKey(role_key)) {
        return; // Other items pass through
    }
    
    // Parse expectations from canonical key
    const expectedHeight = parseCanonicalHeight(role_key);
    const expectedCoating = parseCanonicalCoating(role_key);
    
    // Parse actual attributes from product
    const actualHeight = parseProductHeight(supplier_product_name);
    const actualCoating = parseProductCoating(supplier_product_name);
    
    // Validation errors
    const errors = [];
    
    // Height mismatch
    if (expectedHeight && actualHeight && expectedHeight !== actualHeight) {
        errors.push(
            `Height mismatch: expected ${expectedHeight}in, found ${actualHeight}in`
        );
    }
    
    // Height missing from product name
    if (expectedHeight && !actualHeight) {
        errors.push(
            `Cannot parse height from product name "${supplier_product_name}"`
        );
    }
    
    // Coating mismatch
    if (expectedCoating && actualCoating && expectedCoating !== actualCoating) {
        errors.push(
            `Coating mismatch: expected ${expectedCoating}, found ${actualCoating}`
        );
    }
    
    // Coating missing from product name
    if (expectedCoating && !actualCoating) {
        errors.push(
            `Cannot parse coating from product name "${supplier_product_name}"`
        );
    }
    
    // Throw actionable error
    if (errors.length > 0) {
        const errorMsg = [
            `❌ Invalid mapping blocked for ${role_key}:`,
            `Expected: ${expectedHeight}in ${expectedCoating || 'any coating'}`,
            `Product: "${supplier_product_name}"`,
            `Found: ${actualHeight || '?'}in ${actualCoating || '?'}`,
            '',
            errors.join('; '),
            '',
            'Fix: Update supplier_product_name to include correct height (x72in) and coating (GALV/ALUMINIZED/BLK VNL)'
        ].join('\n');
        
        throw new Error(errorMsg);
    }
}

/**
 * Check if catalog item is compatible with canonical key (for suggestions filtering)
 * Returns true if compatible, false otherwise
 */
export function isCatalogItemCompatible(canonicalKey, catalogItem) {
    if (!isFabricCanonicalKey(canonicalKey)) {
        return true; // Non-fabric items always compatible
    }
    
    const productName = catalogItem.supplier_product_name || catalogItem.crm_name || '';
    
    // Exclude obviously wrong categories
    const lower = productName.toLowerCase();
    if (lower.includes('gate') || 
        lower.includes('post') || 
        lower.includes('vinyl panel') ||
        lower.includes('picket')) {
        return false;
    }
    
    // Must look like a fabric roll
    if (!lower.includes('roll') && !lower.includes('rll') && !lower.includes('ft')) {
        return false;
    }
    
    // Parse and match attributes
    const expectedHeight = parseCanonicalHeight(canonicalKey);
    const expectedCoating = parseCanonicalCoating(canonicalKey);
    
    const actualHeight = parseProductHeight(productName);
    const actualCoating = parseProductCoating(productName);
    
    // Strict match required
    if (expectedHeight && actualHeight && expectedHeight !== actualHeight) {
        return false;
    }
    
    if (expectedCoating && actualCoating && expectedCoating !== actualCoating) {
        return false;
    }
    
    return true;
}

/**
 * Get human-readable expectations for display
 */
export function getExpectedAttributes(canonicalKey) {
    const height = parseCanonicalHeight(canonicalKey);
    const coating = parseCanonicalCoating(canonicalKey);
    
    return {
        height_in: height,
        coating: coating,
        display: `${height}in ${coating || 'any coating'}`
    };
}