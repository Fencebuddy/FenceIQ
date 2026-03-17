/**
 * COMPARE HASH
 * Deterministic hash of comparison inputs (fence lines, runs, gates, pixelsPerFt)
 * Used to detect when variants need recalculation
 * Pure + deterministic, non-crypto for speed
 */

/**
 * Stable stringify: deterministic JSON representation
 * @param {*} obj
 * @returns {string}
 */
function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",")}}`;
}

/**
 * Fast, deterministic non-crypto hash (good for cache keys)
 * @param {string} str
 * @returns {string} Hex hash
 */
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Hash comparison inputs for deduplication
 * @param {Object} params
 * @param {Array} params.fenceLines - Fence lines with geometry
 * @param {Array} params.runs - Runs (includes compareVariants)
 * @param {Array} params.gates - Gate objects
 * @param {number} params.pixelsPerFt - Map scale
 * @returns {string} Deterministic hash
 */
export function hashCompareInputs({ fenceLines, runs, gates, pixelsPerFt }) {
  const compact = {
    pixelsPerFt: pixelsPerFt ?? null,

    fenceLines: (fenceLines || []).map(l => ({
      id: l.lineId ?? l.id ?? null,
      manualLengthFt: l.manualLengthFt ?? null,
      assignedRunId: l.assignedRunId ?? null,
      start: l.start ? { x: l.start.x, y: l.start.y } : null,
      end: l.end ? { x: l.end.x, y: l.end.y } : null
    })),

    // IMPORTANT: include compareVariants so variant edits invalidate cache
    runs: (runs || []).map(r => ({
      id: r.id,

      materialType: r.materialType ?? null,
      fenceHeight: r.fenceHeight ?? null,
      style: r.style ?? null,
      ranchStyleType: r.ranchStyleType ?? null,

      chainLinkCoating: r.chainLinkCoating ?? null,
      chainLinkPrivacyType: r.chainLinkPrivacyType ?? null,
      vinylSlatColor: r.vinylSlatColor ?? null,

      fenceColor: r.fenceColor ?? null,
      railsAndPostColor: r.railsAndPostColor ?? null,
      picketColor: r.picketColor ?? null,

      slopeMode: r.slopeMode ?? null,
      slopeGrade: r.slopeGrade ?? null,
      slopeRangeLabel: r.slopeRangeLabel ?? null,

      compareVariants: r.compareVariants ?? null
    })),

    gates: (gates || []).map(g => ({
      id: g.id,
      runId: g.runId ?? null,
      gateType: g.gateType ?? g.type ?? null,
      gateWidth_ft: g.gateWidth_ft ?? g.width_ft ?? null,
      gateCenterDistance_ft: g.gateCenterDistance_ft ?? g.position_lf ?? null,
      placement: g.placement ?? null,
      isOrphan: !!g.isOrphan
    }))
  };

  return djb2Hash(stableStringify(compact));
}