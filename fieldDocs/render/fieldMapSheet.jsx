/**
 * Field Install Map sheet renderer - generates vector-based map page
 */
import jsPDF from 'jspdf';
import { STYLES, PAPER, MAP_VIEWPORT } from './styles';
import { computeMapTransform } from './mapFit';
import { renderTitleBlock } from './titleBlock';
import { renderLegend } from './legend';
import { computeBounds } from './dimensions';

export async function renderFieldInstallMapPage(job, fenceLines, gates, runs) {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter'
  });
  
  console.log('[fieldMapSheet] Rendering with fenceLines:', fenceLines?.length || 0, 'gates:', gates?.length || 0, 'runs:', runs?.length || 0);
  
  // Render title block on initial page
  let yPos = renderTitleBlock(pdf, job);

  // Calculate bounds manually from fenceLines
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  if (fenceLines && fenceLines.length > 0) {
    fenceLines.forEach(line => {
      if (line.start) {
        minX = Math.min(minX, line.start.x);
        maxX = Math.max(maxX, line.start.x);
        minY = Math.min(minY, line.start.y);
        maxY = Math.max(maxY, line.start.y);
      }
      if (line.end) {
        minX = Math.min(minX, line.end.x);
        maxX = Math.max(maxX, line.end.x);
        minY = Math.min(minY, line.end.y);
        maxY = Math.max(maxY, line.end.y);
      }
    });
  }
  
  // Fallback if no valid bounds
  if (!isFinite(minX)) {
    console.warn('[fieldMapSheet] No valid bounds found, using defaults');
    minX = 0; maxX = 1000;
    minY = 0; maxY = 800;
  }
  
  const bounds = { minX, maxX, minY, maxY };
  console.log('[fieldMapSheet] Bounds:', bounds);
  
  // Add padding to bounds
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;
  const padding = Math.max(boundsWidth, boundsHeight) * 0.1;
  bounds.minX -= padding;
  bounds.maxX += padding;
  bounds.minY -= padding;
  bounds.maxY += padding;
  
  // Compute transformation with correct signature
  const viewportWidthMm = MAP_VIEWPORT.width / 2.834; // Convert points to mm
  const viewportHeightMm = MAP_VIEWPORT.height / 2.834;
  const transform = computeMapTransform(bounds, viewportWidthMm, viewportHeightMm);
  console.log('[fieldMapSheet] Transform:', transform);

  // Draw map background (convert points to mm)
  const vpLeftMm = MAP_VIEWPORT.x / 2.834;
  const vpTopMm = MAP_VIEWPORT.y / 2.834;
  const vpWidthMm = MAP_VIEWPORT.width / 2.834;
  const vpHeightMm = MAP_VIEWPORT.height / 2.834;
  
  console.log('[fieldMapSheet] Viewport (mm):', { vpLeftMm, vpTopMm, vpWidthMm, vpHeightMm });
  
  pdf.setFillColor(255, 255, 255);
  pdf.rect(vpLeftMm, vpTopMm, vpWidthMm, vpHeightMm, 'F');
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.5);
  pdf.rect(vpLeftMm, vpTopMm, vpWidthMm, vpHeightMm);

  // Draw fence lines
  pdf.setDrawColor(...hexToRgb(STYLES.colors.fence));
  pdf.setLineWidth(STYLES.lineWeights.fence / 2.834); // Convert to mm

  if (fenceLines && fenceLines.length > 0) {
    fenceLines.forEach((line, idx) => {
      if (!line.start || !line.end) {
        console.warn(`[fieldMapSheet] Line ${idx} missing start/end`);
        return;
      }
      
      const x1 = vpLeftMm + (line.start.x - bounds.minX) * transform.scale;
      const y1 = vpTopMm + (line.start.y - bounds.minY) * transform.scale;
      const x2 = vpLeftMm + (line.end.x - bounds.minX) * transform.scale;
      const y2 = vpTopMm + (line.end.y - bounds.minY) * transform.scale;

      console.log(`[fieldMapSheet] Drawing line ${idx}: (${x1.toFixed(2)}, ${y1.toFixed(2)}) -> (${x2.toFixed(2)}, ${y2.toFixed(2)})`);
      pdf.line(x1, y1, x2, y2);

      // Draw line label
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const run = runs?.find(r => r.id === line.assignedRunId);
      if (run) {
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(STYLES.fonts.small);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${run.runLabel}`, midX + 2, midY - 2);
      }
    });
  }

  // Draw gates
  if (gates && gates.length > 0) {
    gates.forEach(gate => {
      const run = runs?.find(r => r.id === gate.runId);
      if (!run) return;

      const line = fenceLines?.find(l => l.assignedRunId === run.id);
      if (!line || !line.start || !line.end) return;

      pdf.setFillColor(...hexToRgb(STYLES.colors.annotation));
      const centerX = vpLeftMm + (line.start.x + (line.end.x - line.start.x) * 0.5 - bounds.minX) * transform.scale;
      const centerY = vpTopMm + (line.start.y + (line.end.y - line.start.y) * 0.5 - bounds.minY) * transform.scale;

      pdf.circle(centerX, centerY, 3, 'F');

      // Gate label
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(STYLES.fonts.label);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${gate.gateType} ${gate.gateWidth_ft}'`, centerX + 4, centerY);
    });
  }

  // Render legend
  renderLegend(pdf, vpTopMm + vpHeightMm + 5);

  // Add footer
  pdf.setFont(undefined, 'italic');
  pdf.setFontSize(STYLES.fonts.tiny);
  pdf.setTextColor(120, 120, 120);
  pdf.text(`Generated ${new Date().toLocaleDateString()} - Field Install Map`, PAPER.width_mm / 2, PAPER.height_mm - 5, {
    align: 'center'
  });

  return pdf;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
  }
  return [0, 0, 0];
}