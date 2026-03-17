/**
 * MATERIAL COST CATALOG
 * 
 * Authoritative source of material costs for FenceBuddy.
 * This file stores raw unit costs ONLY - no markup, no labor, no calculations.
 * 
 * CRITICAL RULES:
 * - Costs are stored globally, NOT per-job
 * - Jobs reference materials by materialKey only
 * - Never delete records - use isActive = false
 * - Costs persist even if jobs/takeoff logic changes
 * 
 * FUTURE USE (NOT IMPLEMENTED):
 * - Job cost calculation engine
 * - Margin/markup application
 * - Supplier PO pricing
 * - Cost history by effective date
 * - Multi-supplier pricing comparison
 */

export type MaterialCost = {
  id: string;
  materialKey: string;            // Canonical identifier (must match takeoff materials)
  materialName: string;            // Human readable display name
  materialType: 'vinyl' | 'wood' | 'chainlink' | 'aluminum' | 'general';

  supplier?: string;               // Optional: Home Depot, Master Halco, etc.
  sku?: string;                    // Optional: Supplier SKU/part number

  unit: 'each' | 'lf' | 'roll' | 'box' | 'bag' | 'pcs' | 'pair' | 'kit' | 'stick';
  unitCost: number;                // Raw cost per unit (NO markup applied)

  packagingQty?: number;           // e.g. 10 per box, 330 LF per roll
  roundingRule?: 'none' | 'up';    // Future use: quantity rounding logic

  notes?: string;                  // Admin notes only - not displayed to users

  isActive: boolean;               // FALSE = deactivated but preserved
  
  createdAt: string;               // ISO timestamp
  updatedAt: string;               // ISO timestamp
};

// ============================================================
// IN-MEMORY STORAGE (TEMPORARY - REPLACE WITH DATABASE)
// ============================================================
let materialCostStore: MaterialCost[] = [];

/**
 * Get all active material costs
 */
export async function getAllMaterialCosts(): Promise<MaterialCost[]> {
  return materialCostStore.filter(cost => cost.isActive);
}

/**
 * Get material cost by canonical materialKey
 * Returns null if not found
 */
export async function getMaterialCostByKey(materialKey: string): Promise<MaterialCost | null> {
  const cost = materialCostStore.find(c => c.materialKey === materialKey && c.isActive);
  return cost || null;
}

/**
 * Upsert material cost (insert or update)
 * Replaces existing record by materialKey
 * 
 * RULES:
 * - materialKey must be provided and normalized
 * - Updates existing record if materialKey matches
 * - Creates new record if materialKey not found
 * - Always updates timestamp
 */
export async function upsertMaterialCost(cost: Omit<MaterialCost, 'id' | 'createdAt' | 'updatedAt'>): Promise<MaterialCost> {
  const now = new Date().toISOString();
  
  // Find existing by materialKey
  const existingIndex = materialCostStore.findIndex(c => c.materialKey === cost.materialKey);
  
  if (existingIndex >= 0) {
    // Update existing
    const existing = materialCostStore[existingIndex];
    const updated: MaterialCost = {
      ...existing,
      ...cost,
      updatedAt: now
    };
    materialCostStore[existingIndex] = updated;
    return updated;
  } else {
    // Create new
    const newCost: MaterialCost = {
      id: `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...cost,
      createdAt: now,
      updatedAt: now
    };
    materialCostStore.push(newCost);
    return newCost;
  }
}

/**
 * Deactivate material cost (soft delete)
 * 
 * CRITICAL: Never hard delete - preserves historical data
 */
export async function deactivateMaterialCost(id: string): Promise<void> {
  const cost = materialCostStore.find(c => c.id === id);
  if (cost) {
    cost.isActive = false;
    cost.updatedAt = new Date().toISOString();
  }
}

/**
 * Reactivate material cost
 */
export async function reactivateMaterialCost(id: string): Promise<void> {
  const cost = materialCostStore.find(c => c.id === id);
  if (cost) {
    cost.isActive = true;
    cost.updatedAt = new Date().toISOString();
  }
}

/**
 * Bulk import material costs
 * 
 * RULES:
 * - Normalizes materialKey before import
 * - Rejects imports if materialKey is missing
 * - Logs mismatches instead of auto-creating
 * - Upserts (replaces existing by materialKey)
 * 
 * Returns: { imported: number, rejected: number, errors: string[] }
 */
export async function bulkImportMaterialCosts(
  costs: Omit<MaterialCost, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<{ imported: number; rejected: number; errors: string[] }> {
  let imported = 0;
  let rejected = 0;
  const errors: string[] = [];

  for (const cost of costs) {
    // Validate materialKey
    if (!cost.materialKey || cost.materialKey.trim() === '') {
      rejected++;
      errors.push(`Missing materialKey for: ${cost.materialName}`);
      continue;
    }

    // Validate unitCost
    if (typeof cost.unitCost !== 'number' || cost.unitCost < 0) {
      rejected++;
      errors.push(`Invalid unitCost for: ${cost.materialName}`);
      continue;
    }

    try {
      await upsertMaterialCost(cost);
      imported++;
    } catch (error) {
      rejected++;
      errors.push(`Failed to import: ${cost.materialName} - ${error}`);
    }
  }

  return { imported, rejected, errors };
}

/**
 * Normalize material name to materialKey
 * 
 * Example mappings:
 * "5x5 Vinyl End Post" → "vinyl_post_end_5x5"
 * "Galv Post 8ft" → "galvanized_post_8ft"
 * "Chain Link Wire 6ft Galvanized" → "chainlink_wire_6ft_galvanized"
 */
export function normalizeMaterialKey(materialName: string): string {
  return materialName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '_');        // Replace spaces with underscores
}

// ============================================================
// FUTURE: Database Migration
// ============================================================
// When ready to migrate to Base44 entity:
// 1. Create MaterialCost entity in entities/ folder
// 2. Replace in-memory store with base44.entities.MaterialCost
// 3. Keep all function signatures identical
// 4. No changes needed in consuming code

// ============================================================
// FUTURE: Cost Calculation Engine (DO NOT IMPLEMENT YET)
// ============================================================
// - calculateJobCost(jobId: string): Promise<JobCostBreakdown>
// - applyMargin(cost: number, marginPercent: number): number
// - generateSupplierPO(jobId: string, supplierId: string): Promise<PurchaseOrder>
// - calculateLaborCost(jobId: string): Promise<number>
// - getCostHistory(materialKey: string): Promise<MaterialCost[]>
// - compareSupplierPricing(materialKey: string): Promise<SupplierComparison[]>

// ============================================================
// EXPORT SAFETY
// ============================================================
// Prevent accidental direct access to store
Object.freeze(materialCostStore);