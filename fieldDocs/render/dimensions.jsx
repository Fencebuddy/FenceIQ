/**
 * Dimension and label rendering utilities
 */

export function formatGateLabel(gate) {
  return `${gate.gateType} ${gate.gateWidth_ft}'`;
}

export function computeGateOffsetText(gate, runLength) {
  const offset = gate.gateCenterDistance_ft || 0;
  const remaining = runLength - offset;
  return `${offset.toFixed(1)}' from start`;
}

export function formatRunLabel(run) {
  return `${run.runLabel} - ${run.lengthLF}' LF`;
}

export function computeBounds(items) {
  if (!items || items.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  items.forEach(item => {
    if (item.x1 !== undefined) {
      minX = Math.min(minX, item.x1, item.x2 || item.x1);
      maxX = Math.max(maxX, item.x1, item.x2 || item.x1);
    }
    if (item.y1 !== undefined) {
      minY = Math.min(minY, item.y1, item.y2 || item.y1);
      maxY = Math.max(maxY, item.y1, item.y2 || item.y1);
    }
    if (item.x !== undefined) {
      minX = Math.min(minX, item.x);
      maxX = Math.max(maxX, item.x);
    }
    if (item.y !== undefined) {
      minY = Math.min(minY, item.y);
      maxY = Math.max(maxY, item.y);
    }
  });

  return {
    minX: minX === Infinity ? 0 : minX,
    minY: minY === Infinity ? 0 : minY,
    maxX: maxX === -Infinity ? 100 : maxX,
    maxY: maxY === -Infinity ? 100 : maxY
  };
}