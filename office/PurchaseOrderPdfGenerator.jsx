/**
 * Purchase Order PDF Generator
 * Generates supplier-friendly PDF purchase orders
 */

import jsPDF from 'jspdf';

/**
 * Generate PDF for a purchase order
 * @param {object} purchaseOrder - PO entity
 * @param {object} job - Job entity
 * @param {object} supplier - Supplier entity
 * @returns {jsPDF} - PDF document
 */
export function generatePurchaseOrderPDF(purchaseOrder, job, supplier) {
  const pdf = new jsPDF();
  let yPos = 15;

  // === HEADER ===
  
  // Company info (left)
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'bold');
  pdf.text('Privacy Fence Company of West Michigan', 15, yPos);
  yPos += 5;
  
  pdf.setFontSize(8);
  pdf.setFont(undefined, 'normal');
  pdf.text('123 Main Street', 15, yPos);
  yPos += 4;
  pdf.text('Grand Rapids, MI 49503', 15, yPos);
  yPos += 4;
  pdf.text('Office: (616) 555-1234', 15, yPos);
  yPos += 4;
  pdf.text('office@pfcwestmi.com', 15, yPos);

  // PO Identity (right)
  const rightX = 140;
  let rightY = 15;
  
  pdf.setFillColor(16, 113, 84); // Green
  pdf.rect(rightX - 5, rightY - 5, 60, 35, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.text('PURCHASE ORDER', rightX, rightY);
  rightY += 7;
  
  pdf.setFontSize(9);
  pdf.setFont(undefined, 'normal');
  pdf.text(`PO Number: ${purchaseOrder.poNumber}`, rightX, rightY);
  rightY += 5;
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, rightX, rightY);
  rightY += 5;
  pdf.text(`Rule Version: ${purchaseOrder.ruleVersion}`, rightX, rightY);
  rightY += 5;
  pdf.text(`Created By: ${purchaseOrder.createdBy}`, rightX, rightY);
  rightY += 5;
  pdf.text(`Status: ${purchaseOrder.status}`, rightX, rightY);
  
  pdf.setTextColor(0, 0, 0);
  yPos = 60;

  // === SUPPLIER + SHIP TO ROW ===
  
  pdf.setFillColor(245, 245, 245);
  pdf.rect(15, yPos, 85, 35, 'F');
  pdf.rect(105, yPos, 90, 35, 'F');
  
  // Supplier (left)
  pdf.setFontSize(9);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(16, 113, 84);
  pdf.text('SUPPLIER', 20, yPos + 6);
  pdf.setTextColor(0, 0, 0);
  yPos += 10;
  
  pdf.setFont(undefined, 'bold');
  pdf.text(supplier.name, 20, yPos);
  yPos += 5;
  
  pdf.setFont(undefined, 'normal');
  if (supplier.addressLine1) {
    pdf.text(supplier.addressLine1, 20, yPos);
    yPos += 4;
  }
  if (supplier.city && supplier.state && supplier.zip) {
    pdf.text(`${supplier.city}, ${supplier.state} ${supplier.zip}`, 20, yPos);
    yPos += 4;
  }
  if (supplier.phone) {
    pdf.text(`Phone: ${supplier.phone}`, 20, yPos);
    yPos += 4;
  }
  if (supplier.email) {
    pdf.text(`Email: ${supplier.email}`, 20, yPos);
  }
  
  // Ship To (right)
  let shipY = 66;
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(16, 113, 84);
  pdf.text('SHIP TO', 110, shipY);
  pdf.setTextColor(0, 0, 0);
  shipY += 10;
  
  pdf.setFont(undefined, 'bold');
  pdf.text(purchaseOrder.shipToName, 110, shipY);
  shipY += 5;
  
  pdf.setFont(undefined, 'normal');
  pdf.text(`Job: ${job.jobNumber}`, 110, shipY);
  shipY += 4;
  pdf.text(purchaseOrder.shipToAddress1, 110, shipY);
  shipY += 4;
  pdf.text(`${purchaseOrder.shipToCity}, ${purchaseOrder.shipToState} ${purchaseOrder.shipToZip}`, 110, shipY);
  shipY += 4;
  if (job.customerPhone) {
    pdf.text(`Contact: ${job.customerPhone}`, 110, shipY);
  }
  
  yPos = 105;

  // === LINE ITEMS TABLE ===
  
  pdf.setFillColor(16, 113, 84); // Green header
  pdf.rect(15, yPos, 180, 8, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.setFont(undefined, 'bold');
  pdf.text('#', 18, yPos + 5);
  pdf.text('Supplier SKU', 25, yPos + 5);
  pdf.text('Description', 60, yPos + 5);
  pdf.text('Qty', 140, yPos + 5);
  pdf.text('Unit', 155, yPos + 5);
  pdf.text('Pack', 170, yPos + 5);
  pdf.text('Notes', 183, yPos + 5);
  
  pdf.setTextColor(0, 0, 0);
  yPos += 12;
  
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(8);
  
  let lineNum = 1;
  let totalLineItems = 0;
  let unmappedItems = 0;
  
  purchaseOrder.lineItems.forEach((item, idx) => {
    if (yPos > 270) {
      pdf.addPage();
      yPos = 20;
      
      // Repeat header on new page
      pdf.setFillColor(16, 113, 84);
      pdf.rect(15, yPos, 180, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont(undefined, 'bold');
      pdf.text('#', 18, yPos + 5);
      pdf.text('Supplier SKU', 25, yPos + 5);
      pdf.text('Description', 60, yPos + 5);
      pdf.text('Qty', 140, yPos + 5);
      pdf.text('Unit', 155, yPos + 5);
      pdf.text('Pack', 170, yPos + 5);
      pdf.text('Notes', 183, yPos + 5);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont(undefined, 'normal');
      yPos += 12;
    }
    
    totalLineItems++;
    if (!item.isMapped) unmappedItems++;
    
    // Zebra striping
    if (idx % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(15, yPos - 4, 180, 7, 'F');
    }
    
    // Highlight unmapped items
    if (!item.isMapped) {
      pdf.setFillColor(255, 243, 205); // Light yellow
      pdf.rect(15, yPos - 4, 180, 7, 'F');
    }
    
    pdf.text(String(lineNum), 18, yPos);
    pdf.text(item.supplierSku || 'UNMAPPED', 25, yPos, { maxWidth: 30 });
    pdf.text(item.description, 60, yPos, { maxWidth: 75 });
    pdf.text(String(item.quantityPackAdjusted), 140, yPos);
    pdf.text(item.unit, 155, yPos);
    pdf.text(String(item.packQty), 170, yPos);
    if (item.notes) {
      pdf.text(item.notes, 183, yPos, { maxWidth: 12 });
    }
    
    yPos += 7;
    lineNum++;
  });

  // === SUMMARY (bottom right) ===
  
  yPos += 10;
  const summaryX = 140;
  
  pdf.setFont(undefined, 'bold');
  pdf.text('Total Line Items:', summaryX, yPos);
  pdf.text(String(totalLineItems), 180, yPos);
  yPos += 5;
  
  if (unmappedItems > 0) {
    pdf.setTextColor(200, 100, 0); // Orange warning
    pdf.text('Unmapped Items:', summaryX, yPos);
    pdf.text(String(unmappedItems), 180, yPos);
    yPos += 4;
    pdf.setFontSize(7);
    pdf.setFont(undefined, 'italic');
    pdf.text('⚠ SKU mapping required', summaryX, yPos);
    pdf.setTextColor(0, 0, 0);
  }

  // === NOTES TO SUPPLIER (bottom left) ===
  
  let notesY = yPos - 10;
  pdf.setFontSize(8);
  pdf.setFont(undefined, 'bold');
  pdf.text('NOTES TO SUPPLIER:', 20, notesY);
  notesY += 5;
  
  pdf.setFont(undefined, 'normal');
  if (purchaseOrder.notesToSupplier) {
    pdf.text(purchaseOrder.notesToSupplier, 20, notesY, { maxWidth: 100 });
    notesY += 10;
  }
  
  pdf.setFontSize(7);
  pdf.setFont(undefined, 'italic');
  pdf.setTextColor(100, 100, 100);
  pdf.text('Generated by FenceBuddy from locked material takeoff.', 20, notesY);
  pdf.setTextColor(0, 0, 0);

  // === FOOTER ===
  
  if (yPos > 260) {
    pdf.addPage();
    yPos = 20;
  } else {
    yPos = 280;
  }
  
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(20, yPos, 190, yPos);
  yPos += 5;
  
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text(`Job #: ${job.jobNumber} | PO #: ${purchaseOrder.poNumber} | Page 1 of 1`, 105, yPos, { align: 'center' });

  return pdf;
}

/**
 * Generate and download PDF
 */
export async function downloadPurchaseOrderPDF(purchaseOrder, job, supplier) {
  const pdf = generatePurchaseOrderPDF(purchaseOrder, job, supplier);
  const filename = `${purchaseOrder.poNumber}_${supplier.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  pdf.save(filename);
}