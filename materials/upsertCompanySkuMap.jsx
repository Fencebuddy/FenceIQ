/**
 * Upsert CompanySkuMap with UCK -> MaterialCatalog mapping
 */

import { base44 } from '@/api/base44Client';
import { parseUckAttributes } from './parseUckAttributes';

export async function upsertCompanySkuMap({
  companyId,
  uck,
  materialCatalogId,
  materialCatalogName,
  materialType,
  fenceSystem = null
}) {
  const attributes = parseUckAttributes(uck);
  
  // Check if mapping already exists
  const existing = await base44.entities.CompanySkuMap.filter({ 
    companyId, 
    uck 
  });
  
  const data = {
    companyId,
    uck,
    uckVersion: 1,
    materialCatalogId,
    materialCatalogName,
    materialType: materialType || 'general',
    fenceSystem: fenceSystem || materialType + '_residential',
    attributes,
    status: 'mapped',
    lastSeenAt: new Date().toISOString()
  };
  
  if (existing.length > 0) {
    // Update existing mapping
    return base44.entities.CompanySkuMap.update(existing[0].id, data);
  } else {
    // Create new mapping
    return base44.entities.CompanySkuMap.create(data);
  }
}