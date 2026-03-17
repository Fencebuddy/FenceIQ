/**
 * Purchase Order Generator
 * Auto-populates PO from job data + materials (no validation blocking)
 */

import { base44 } from '@/api/base44Client';
import { calculateMaterials } from '@/components/materials/materialCalculations';

/**
 * Generate a supplier purchase order
 * @param {string} jobId - Job ID
 * @param {string} supplierId - Supplier ID
 * @param {object} options - PO generation options
 * @returns {object} - Generated PO entity
 */
export async function generatePurchaseOrder(jobId, supplierId, options = {}) {
  const {
    exportFormats = ['PDF', 'CSV'],
    notesToSupplier = '',
    source = 'OFFICE_GENERATED'
  } = options;

  // STEP 1: Load job data
  const job = await base44.entities.Job.filter({ id: jobId }).then(jobs => jobs[0]);
  if (!job) throw new Error('Job not found');

  const runs = await base44.entities.Run.filter({ jobId });
  const gates = await base44.entities.Gate.filter({ jobId });

  // STEP 2: Get materials (authoritative list for this job)
  let materials = await base44.entities.MaterialLine.filter({ jobId });
  
  // If no materials exist in DB, calculate them
  if (!materials || materials.length === 0) {
    let materialRules = [];
    if (job.materialRulesSnapshot && job.materialRulesSnapshot.length > 0) {
      materialRules = job.materialRulesSnapshot;
    } else {
      materialRules = await base44.entities.MaterialRule.list();
    }
    
    const calculatedMaterials = calculateMaterials(job, runs, gates, materialRules);
    materials = calculatedMaterials;
  }
  
  // CRITICAL: Filter materials to only include CURRENT active runs with includeInCalculation !== false
  const eligibleRunLabels = new Set();
  runs.forEach(run => {
    if (run.includeInCalculation !== false) {
      eligibleRunLabels.add(run.runLabel);
      // Also add gate variant
      eligibleRunLabels.add(`${run.runLabel} - Gates`);
    }
  });
  
  // Also include "Overall" materials (corners, ends, etc.)
  eligibleRunLabels.add('Overall');
  
  // Filter materials - ONLY include those from currently active eligible runs OR without runLabel (calculated materials)
  materials = materials.filter(m => {
    const runLabel = m.runLabel;
    // Include materials without runLabel (these are from calculated materials, not per-run items)
    if (!runLabel) return true;
    
    return eligibleRunLabels.has(runLabel);
  });
  
  // BLOCKER: Only fail if materials list is completely empty
  if (!materials || materials.length === 0) {
    throw new Error('No materials found for this job. Cannot generate PO with empty materials list.');
  }

  // STEP 3: Load supplier and SKU mappings
  const supplier = await base44.entities.Supplier.filter({ id: supplierId }).then(suppliers => suppliers[0]);
  if (!supplier) throw new Error('Supplier not found');

  const skuMaps = await base44.entities.SupplierSkuMap.filter({ 
    supplierId, 
    isActive: true 
  });

  // STEP 4: Aggregate materials by name (same as TOTAL MATERIALS section)
  const materialsByName = {};
  materials.forEach(m => {
    if (m.lineItemName?.startsWith('__SECTION__')) return;
    
    const qty = m.manualOverrideQty ?? m.calculatedQty ?? m.quantity ?? 0;
    
    if (!materialsByName[m.lineItemName]) {
      materialsByName[m.lineItemName] = {
        lineItemName: m.lineItemName,
        totalQty: 0,
        unit: m.unit,
        calculationDetails: []
      };
    }
    
    materialsByName[m.lineItemName].totalQty += qty;
    if (m.calculationDetails) {
      materialsByName[m.lineItemName].calculationDetails.push(m.calculationDetails);
    }
  });
  
  // Convert to array and combine calculation details
  const aggregatedMaterials = Object.values(materialsByName).map(m => ({
    ...m,
    calculationDetails: m.calculationDetails.join('; ')
  }));

  // STEP 5: Build line items with SKU mapping
  const lineItems = [];
  let unmappedCount = 0;

  aggregatedMaterials.forEach(material => {
    const quantity = material.totalQty;

    // Find SKU mapping
    const skuMap = skuMaps.find(m => m.internalItemName === material.lineItemName);

    let quantityPackAdjusted = quantity;
    let roundingRule = 'NONE';
    let packQty = 1;

    if (skuMap) {
      packQty = skuMap.packQty || 1;
      roundingRule = skuMap.roundingRule || 'CEIL_TO_PACK';

      // Apply packaging rounding
      if (roundingRule === 'CEIL_TO_PACK' && packQty > 1) {
        quantityPackAdjusted = Math.ceil(quantity / packQty) * packQty;
      } else if (roundingRule === 'ROUND_TO_PACK' && packQty > 1) {
        quantityPackAdjusted = Math.max(packQty, Math.round(quantity / packQty) * packQty);
      }
    } else {
      unmappedCount++;
    }

    lineItems.push({
      internalItemName: material.lineItemName,
      supplierSku: skuMap?.supplierSku || null,
      description: skuMap?.supplierDescription || material.lineItemName,
      quantityRequested: quantity,
      quantityPackAdjusted,
      unit: skuMap?.unit || material.unit || 'EA',
      packQty,
      roundingRule,
      calculationDetails: material.calculationDetails || material.notes || '',
      notes: '',
      isMapped: !!skuMap,
      needsAttention: !skuMap || !skuMap.supplierSku || !skuMap.unit
    });
  });

  // STEP 5: Generate PO number
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Find existing POs for this job today to get sequence
  const existingPOs = await base44.entities.PurchaseOrder.filter({ jobId });
  const todayPOs = existingPOs.filter(po => po.poNumber?.includes(dateStr));
  const seq = todayPOs.length + 1;
  
  const poNumber = `PO-${job.jobNumber}-${dateStr}-${seq}`;

  // STEP 6: Get current user
  const user = await base44.auth.me();

  // STEP 7: Generate and upload PDF/CSV files
  let pdfUrl = null;
  let csvUrl = null;

  if (exportFormats.includes('PDF')) {
    const { generatePurchaseOrderPDF } = await import('./PurchaseOrderPdfGenerator');
    const pdf = generatePurchaseOrderPDF({ 
      poNumber, 
      ruleVersion: job.ruleVersion || 'unknown',
      unmappedCount,
      notesToSupplier,
      shipToName: job.customerName,
      shipToAddress1: job.addressLine1,
      shipToCity: job.city,
      shipToState: job.state,
      shipToZip: job.zip,
      lineItems,
      createdBy: user.email,
      status: 'Draft',
      created_date: new Date().toISOString()
    }, job, supplier);
    
    const pdfBlob = pdf.output('blob');
    const pdfFile = new File([pdfBlob], `${poNumber}_${supplier.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, { type: 'application/pdf' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });
    pdfUrl = file_url;
  }

  if (exportFormats.includes('CSV')) {
    const { generatePurchaseOrderCSV } = await import('./PurchaseOrderCsvGenerator');
    const csv = generatePurchaseOrderCSV({ 
      poNumber,
      shipToAddress1: job.addressLine1,
      shipToCity: job.city,
      shipToState: job.state,
      shipToZip: job.zip,
      lineItems 
    }, job, supplier);
    
    const csvBlob = new Blob([csv], { type: 'text/csv' });
    const csvFile = new File([csvBlob], `${poNumber}_${supplier.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`, { type: 'text/csv' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file: csvFile });
    csvUrl = file_url;
  }

  // STEP 8: Create PO entity with ALL job data auto-populated
  const purchaseOrder = await base44.entities.PurchaseOrder.create({
    jobId,
    supplierId,
    poNumber,
    status: unmappedCount > 0 ? 'Draft' : 'Draft', // Always draft on creation
    createdBy: user.email,
    ruleVersion: job.ruleVersion || 'unknown',
    source,
    exportFormats,
    unmappedCount,
    notesToSupplier: notesToSupplier || job.jobNotes || '',
    // Ship-to: Job site address (full copy)
    shipToName: job.customerName || '',
    shipToAddress1: job.addressLine1 || '',
    shipToAddress2: job.addressLine2 || '',
    shipToCity: job.city || '',
    shipToState: job.state || '',
    shipToZip: job.zip || '',
    // Bill-to: Default to ship-to (can be edited later)
    billToName: job.customerName || '',
    billToAddress1: job.addressLine1 || '',
    billToAddress2: job.addressLine2 || '',
    billToCity: job.city || '',
    billToState: job.state || '',
    billToZip: job.zip || '',
    lineItems,
    pdfUrl,
    csvUrl
  });

  return purchaseOrder;
}

/**
 * Apply packaging rounding to a quantity
 */
export function applyPackagingRounding(quantity, packQty, roundingRule) {
  if (roundingRule === 'NONE' || packQty <= 1) {
    return quantity;
  }

  if (roundingRule === 'CEIL_TO_PACK') {
    return Math.ceil(quantity / packQty) * packQty;
  }

  if (roundingRule === 'ROUND_TO_PACK') {
    return Math.max(packQty, Math.round(quantity / packQty) * packQty);
  }

  return quantity;
}