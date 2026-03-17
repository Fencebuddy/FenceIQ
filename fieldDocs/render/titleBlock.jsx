/**
 * Title block renderer for field documents
 */
import { STYLES, PAPER } from './styles';

export function renderTitleBlock(pdf, job) {
  const pageWidth = PAPER.width_mm;
  const startY = 10;
  const boxHeight = 25;

  // Title background
  pdf.setFillColor(22, 71, 42); // Dark green
  pdf.rect(PAPER.margin_left, startY, pageWidth - PAPER.margin_left - PAPER.margin_right, boxHeight, 'F');

  // Title text
  pdf.setTextColor(255, 255, 255);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(16);
  pdf.text('FIELD INSTALL MAP', pageWidth / 2, startY + 10, { align: 'center' });

  // Job number
  pdf.setFontSize(8);
  pdf.text(`Job: ${job.jobNumber}`, PAPER.margin_left + 2, startY + 18);
  pdf.text(`Customer: ${job.customerName}`, pageWidth / 2, startY + 18, { align: 'center' });
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - PAPER.margin_right - 2, startY + 18, { align: 'right' });

  return startY + boxHeight + 3;
}