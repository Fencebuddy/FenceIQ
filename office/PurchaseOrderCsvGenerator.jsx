/**
 * Purchase Order CSV Generator
 * Generates supplier-ready CSV export
 */

/**
 * Generate CSV content for a purchase order
 * @param {object} purchaseOrder - PO entity
 * @param {object} job - Job entity
 * @param {object} supplier - Supplier entity
 * @returns {string} - CSV content
 */
export function generatePurchaseOrderCSV(purchaseOrder, job, supplier) {
  const lines = [];
  
  // Header row
  lines.push([
    'SupplierSKU',
    'Description',
    'Quantity',
    'Unit',
    'PackQty',
    'Notes',
    'JobNumber',
    'JobName',
    'ShipToAddress'
  ].join(','));

  // Build ship-to address string
  const shipToAddress = [
    purchaseOrder.shipToAddress1,
    purchaseOrder.shipToCity,
    purchaseOrder.shipToState,
    purchaseOrder.shipToZip
  ].filter(Boolean).join(', ');

  // Data rows
  purchaseOrder.lineItems.forEach(item => {
    const row = [
      item.supplierSku || '', // Blank if unmapped
      `"${item.description.replace(/"/g, '""')}"`, // Escape quotes
      item.quantityPackAdjusted,
      item.unit,
      item.packQty,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
      job.jobNumber,
      `"${job.customerName.replace(/"/g, '""')}"`,
      `"${shipToAddress.replace(/"/g, '""')}"`
    ];
    lines.push(row.join(','));
  });

  return lines.join('\n');
}

/**
 * Generate and download CSV file
 */
export async function downloadPurchaseOrderCSV(purchaseOrder, job, supplier) {
  const csv = generatePurchaseOrderCSV(purchaseOrder, job, supplier);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  
  const filename = `${purchaseOrder.poNumber}_${supplier.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}