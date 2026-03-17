/**
 * MATERIAL COST CATALOG
 * 
 * Single source of truth for material costs in FenceBuddy.
 * 
 * CRITICAL RULES:
 * - Costs are stored GLOBALLY, not per job
 * - Jobs reference materials by materialKey only
 * - NO calculations, NO markup, NO labor logic
 * - Takeoff engine outputs quantities only
 * 
 * This is STORAGE ONLY - pricing engine will be layered later.
 */

import { base44 } from '@/api/base44Client';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type MaterialCost = {
  id: string;
  materialKey: string;           // Must match canonical material identifier used in takeoff
  materialName: string;          // Human readable
  materialType: 'vinyl' | 'wood' | 'chainlink' | 'aluminum' | 'general';

  supplier?: string;             // Optional (Home Depot, Master Halco, etc.)
  sku?: string;                  // Optional supplier SKU

  unit: 'each' | 'lf' | 'roll' | 'box' | 'bag';
  unitCost: number;              // Raw cost only (no markup)

  packagingQty?: number;         // e.g. 10 per box, 330 LF per roll
  roundingRule?: 'none' | 'up';  // Stored for future use only

  notes?: string;                // Admin notes only

  isActive: boolean;             // Allows deactivation without deletion

  created_date: string;          // Built-in from Base44
  updated_date: string;          // Built-in from Base44
};

// ============================================
// CRUD FUNCTIONS
// ============================================

/**
 * Get all material costs (active and inactive)
 */
export async function getAllMaterialCosts(): Promise<MaterialCost[]> {
  const costs = await base44.entities.MaterialCost.list('-updated_date');
  return costs as MaterialCost[];
}

/**
 * Get material cost by canonical materialKey
 * Returns null if not found
 */
export async function getMaterialCostByKey(materialKey: string): Promise<MaterialCost | null> {
  const results = await base44.entities.MaterialCost.filter({ materialKey });
  return results.length > 0 ? (results[0] as MaterialCost) : null;
}

/**
 * Upsert material cost
 * - If materialKey exists, replaces existing record
 * - If new, creates new record
 * - Never duplicates materialKey
 * 
 * IMPORTANT: This does NOT calculate anything. It only stores raw cost data.
 */
export async function upsertMaterialCost(cost: Omit<MaterialCost, 'id' | 'created_date' | 'updated_date'>): Promise<MaterialCost> {
  // Check if materialKey already exists
  const existing = await getMaterialCostByKey(cost.materialKey);

  if (existing) {
    // Update existing record
    const updated = await base44.entities.MaterialCost.update(existing.id, cost);
    return updated as MaterialCost;
  } else {
    // Create new record
    const created = await base44.entities.MaterialCost.create(cost);
    return created as MaterialCost;
  }
}

/**
 * Deactivate material cost (never delete - preserve historical data)
 */
export async function deactivateMaterialCost(id: string): Promise<void> {
  await base44.entities.MaterialCost.update(id, { isActive: false });
}

/**
 * Reactivate material cost
 */
export async function reactivateMaterialCost(id: string): Promise<void> {
  await base44.entities.MaterialCost.update(id, { isActive: true });
}

/**
 * Get only active material costs
 */
export async function getActiveMaterialCosts(): Promise<MaterialCost[]> {
  const costs = await base44.entities.MaterialCost.filter({ isActive: true }, '-updated_date');
  return costs as MaterialCost[];
}

/**
 * Get material costs by type
 */
export async function getMaterialCostsByType(materialType: MaterialCost['materialType']): Promise<MaterialCost[]> {
  const costs = await base44.entities.MaterialCost.filter({ materialType, isActive: true }, '-updated_date');
  return costs as MaterialCost[];
}

// ============================================
// IMPORT HELPERS
// ============================================

/**
 * Normalize material name to materialKey
 * 
 * Examples:
 * "5x5 Vinyl End Post" → "vinyl_post_end_5x5"
 * "Galv Post 8ft" → "galvanized_post_8ft"
 * 
 * IMPORTANT: This is a simple normalizer. In production, you should:
 * - Maintain a mapping table
 * - Log mismatches
 * - Reject imports if materialKey is missing
 */
export function normalizeMaterialKey(materialName: string): string {
  return materialName
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, '_')     // Replace spaces with underscores
    .replace(/_+/g, '_')      // Collapse multiple underscores
    .trim();
}

/**
 * Validate material cost data before import
 * Returns error message if invalid, null if valid
 */
export function validateMaterialCost(cost: Partial<MaterialCost>): string | null {
  if (!cost.materialKey || cost.materialKey.trim() === '') {
    return 'materialKey is required';
  }

  if (!cost.materialName || cost.materialName.trim() === '') {
    return 'materialName is required';
  }

  if (!cost.materialType) {
    return 'materialType is required';
  }

  if (!['vinyl', 'wood', 'chainlink', 'aluminum', 'general'].includes(cost.materialType)) {
    return 'Invalid materialType';
  }

  if (!cost.unit) {
    return 'unit is required';
  }

  if (!['each', 'lf', 'roll', 'box', 'bag'].includes(cost.unit)) {
    return 'Invalid unit';
  }

  if (typeof cost.unitCost !== 'number' || cost.unitCost < 0) {
    return 'unitCost must be a positive number';
  }

  return null;
}

// ============================================
// FUTURE FUNCTIONALITY (DO NOT IMPLEMENT)
// ============================================

// FUTURE:
// - Job cost calculation (materialQty × unitCost)
// - Margin application (cost × markup %)
// - Supplier PO pricing (with supplier-specific margins)
// - Cost history by effective date (time-based pricing)
// - Bulk import from CSV/API
// - Cost comparison across suppliers
// - Labor cost layering
// - Geographic pricing adjustments

// FUTURE PRICING ENGINE WILL:
// 1. Read takeoff quantities from canonical takeoff engine
// 2. Lookup costs from this catalog by materialKey
// 3. Apply markup/margin rules
// 4. Generate final pricing
//
// This ensures:
// - Clean separation of concerns
// - No contamination of takeoff logic
// - Easy to rebuild pricing without affecting material calculations
// - Historical cost data preserved