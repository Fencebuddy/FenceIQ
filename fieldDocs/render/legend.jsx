/**
 * Legend renderer for field documents
 */
import { STYLES, PAPER } from './styles';

export function renderLegend(pdf, yPos) {
  const boxWidth = 50;
  const boxHeight = 35;
  const legendX = PAPER.width_mm - PAPER.margin_right - boxWidth;

  // Legend background
  pdf.setFillColor(245, 245, 245);
  pdf.rect(legendX, yPos, boxWidth, boxHeight, 'F');
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.5);
  pdf.rect(legendX, yPos, boxWidth, boxHeight);

  // Title
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  pdf.text('LEGEND', legendX + 2, yPos + 4);

  // Items
  let itemY = yPos + 10;
  const items = [
    { color: STYLES.colors.fence, label: 'Fence' },
    { color: STYLES.colors.post, label: 'Post' },
    { color: STYLES.colors.structure, label: 'Structure' },
    { color: STYLES.colors.tree, label: 'Tree' }
  ];

  items.forEach(item => {
    pdf.setFillColor(...hexToRgb(item.color));
    pdf.rect(legendX + 2, itemY - 1.5, 2.5, 2.5, 'F');
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(6);
    pdf.setTextColor(0, 0, 0);
    pdf.text(item.label, legendX + 5.5, itemY);
    itemY += 5;
  });

  return yPos + boxHeight + 2;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ];
  }
  return [0, 0, 0];
}