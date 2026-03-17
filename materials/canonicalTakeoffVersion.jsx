/**
 * Canonical Takeoff Version Lock
 * 
 * ⚠️ CRITICAL: DO NOT MODIFY WITHOUT EXPLICIT v2 VERSIONING
 * 
 * This is FenceBuddy-owned immutable logic.
 * Canonical takeoff v1.0 locked after field validation (2026-01-19).
 * 
 * All geometry calculations, post counts, panel spacing, gate logic,
 * hardware rules, and material quantities are frozen.
 * 
 * 🚨 HARD CONSTRAINTS:
 * - DO NOT change any existing takeoff outputs (quantities, counts, rounding, waste %)
 * - DO NOT change spacing rules, panel widths, or post selection logic
 * - DO NOT change gate logic, corner logic, terminal/end post logic
 * - DO NOT change hardware doubling rules or material calculations
 * - DO NOT expose takeoff rules in onboarding UI
 * - DO NOT create admin controls for spacing/panels/post ratios
 * 
 * ✅ WHAT CAN CHANGE (Mapping Layer Only):
 * - Company-specific SKU mappings (canonical_key → supplier_sku + unit_cost)
 * - Catalog item costs and supplier references
 * - Display names and categories (for UI only)
 * 
 * This creates a strict boundary:
 * - Behavior Layer (LOCKED): Geometry → canonical quantities
 * - Mapping Layer (EDITABLE): Canonical key → supplier SKU + cost
 */

export const CANONICAL_TAKEOFF_VERSION = "v1.0";
export const CANONICAL_TAKEOFF_LOCKED = true;
export const CANONICAL_TAKEOFF_LOCKED_AT = "2026-01-19";

/**
 * Canonical Catalog Reference (Read-Only)
 * 
 * This is NOT where rules live - rules remain in code.
 * This is only a reference list for mapping canonical keys to supplier SKUs.
 * 
 * Each canonical key represents a specific fence component with:
 * - Deterministic quantity calculation (locked in code)
 * - Category for organization (UI only)
 * - Unit of measure (immutable)
 * - Description for clarity
 * 
 * ⚠️ DO NOT ALLOW CRUD BY CUSTOMERS OR COMPANY SETTINGS
 * ⚠️ DO NOT STORE BEHAVIOR RULES HERE (spacing, counts, ratios, etc.)
 */
export const CANONICAL_CATALOG_REFERENCE = {
  // Vinyl Posts
  "vinyl_post_end_5x5": {
    category: "post",
    unit: "each",
    description: "5x5 Vinyl End Post (locked calculation: per run endpoints)"
  },
  "vinyl_post_corner_5x5": {
    category: "post",
    unit: "each",
    description: "5x5 Vinyl Corner Post (locked calculation: per corner points)"
  },
  "vinyl_post_line_4x4": {
    category: "post",
    unit: "each",
    description: "4x4 Vinyl Line Post (locked calculation: spacing-based)"
  },
  
  // Vinyl Panels & Rails
  "vinyl_panel_privacy_6ft": {
    category: "panel",
    unit: "each",
    description: "6ft Privacy Panel (locked calculation: run length / panel width)"
  },
  "vinyl_rail_top": {
    category: "rail",
    unit: "each",
    description: "Top Rail (locked calculation: per panel bay)"
  },
  "vinyl_rail_bottom": {
    category: "rail",
    unit: "each",
    description: "Bottom Rail (locked calculation: per panel bay)"
  },
  
  // Chain Link Components
  "chainlink_fabric_6ft_galv_50ft_roll": {
    category: "fabric",
    unit: "roll",
    description: "6ft Galv Fabric 50ft Roll (locked calculation: LF / 50, rounded up)"
  },
  "chainlink_post_terminal_galv_2.5in": {
    category: "post",
    unit: "each",
    description: "Terminal Post 2.5in (locked calculation: per terminal point)"
  },
  "chainlink_post_line_galv_2in": {
    category: "post",
    unit: "each",
    description: "Line Post 2in (locked calculation: spacing-based)"
  },
  "chainlink_top_rail_galv_21ft": {
    category: "rail",
    unit: "each",
    description: "Top Rail 21ft Stick (locked calculation: LF / 21, rounded up)"
  },
  
  // Hardware
  "vinyl_hardware_galvanized_post": {
    category: "hardware",
    unit: "each",
    description: "Galvanized Insert Post (locked calculation: per vinyl post)"
  },
  "vinyl_hardware_nodig_donut": {
    category: "hardware",
    unit: "each",
    description: "No-Dig Donut (locked calculation: 2x per end/corner post)"
  },
  "chainlink_hardware_tension_wire": {
    category: "hardware",
    unit: "lf",
    description: "Tension Wire (locked calculation: total LF)"
  },
  
  // Gates
  "vinyl_gate_single_4ft": {
    category: "gate",
    unit: "each",
    description: "4ft Single Gate (locked calculation: per gate instance)"
  },
  "chainlink_gate_single_4ft_galv": {
    category: "gate",
    unit: "each",
    description: "4ft Galv Single Gate (locked calculation: per gate instance)"
  },
  
  // Concrete
  "concrete_bag_80lb": {
    category: "concrete",
    unit: "bag",
    description: "80lb Concrete Bag (locked calculation: bags per post type)"
  }
};

/**
 * Validate that canonical key exists in reference catalog
 * (Prevents typos and ensures all keys are documented)
 */
export function validateCanonicalKey(canonicalKey) {
  if (!CANONICAL_CATALOG_REFERENCE[canonicalKey]) {
    console.warn(
      `[Canonical Takeoff] Undocumented canonical key: ${canonicalKey}. ` +
      `All canonical keys must be registered in CANONICAL_CATALOG_REFERENCE.`
    );
    return false;
  }
  return true;
}

/**
 * Runtime guard: Prevent modification of canonical behavior
 * 
 * Call this before any operation that might change takeoff logic.
 * Throws error if attempting to modify locked behavior.
 */
export function assertCanonicalImmutability(operation) {
  if (!CANONICAL_TAKEOFF_LOCKED) {
    return; // Lock not enforced
  }
  
  const FORBIDDEN_OPERATIONS = [
    'update_spacing_rules',
    'update_panel_width',
    'update_post_selection_logic',
    'update_gate_hardware_rules',
    'update_waste_percentage',
    'update_corner_quantities',
    'update_terminal_quantities',
    'modify_canonical_catalog_behavior'
  ];
  
  if (FORBIDDEN_OPERATIONS.includes(operation)) {
    throw new Error(
      `🚨 CANONICAL TAKEOFF LOCKED (v${CANONICAL_TAKEOFF_VERSION})\n` +
      `Operation "${operation}" is forbidden.\n` +
      `Canonical takeoff logic is immutable. Mapping only.\n` +
      `To modify behavior, create Canonical Takeoff v2.0.`
    );
  }
}

/**
 * Dev-only: Snapshot test harness for canonical takeoff
 * 
 * Compares a known fixture job's output against stored snapshot.
 * Logs loud warning if output differs (indicates drift).
 * 
 * Usage in dev:
 *   const output = buildTakeoff(...);
 *   validateTakeoffSnapshot('test-job-vinyl-6ft', output);
 */
export function validateTakeoffSnapshot(fixtureId, actualOutput) {
  if (process.env.NODE_ENV === 'production') {
    return; // Only run in dev
  }
  
  // TODO: Add snapshot fixtures for critical test cases
  // For now, just validate structure hasn't changed
  
  const requiredFields = ['lineItems', 'postCounts', 'total_lf'];
  const missingFields = requiredFields.filter(field => !(field in actualOutput));
  
  if (missingFields.length > 0) {
    console.error(
      `[Canonical Takeoff] Output structure changed! Missing fields: ${missingFields.join(', ')}\n` +
      `This may indicate canonical logic drift. Fixture: ${fixtureId}`
    );
  }
}

/**
 * Frozen Behavior Components (v1.0)
 * 
 * These are the immutable calculation modules:
 * - Geometry → canonical quantities (canonicalTakeoffEngine)
 * - Post layout and spacing (postLayoutEngine)
 * - Gate extraction and placement
 * - Material calculations and waste percentages
 * - Hardware doubling rules
 * - Concrete quantities
 * - Panel/rail/fabric calculations
 * 
 * DO NOT MODIFY THESE MODULES WITHOUT v2 VERSIONING
 */