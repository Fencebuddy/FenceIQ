/**
 * COMPARE HASH ENGINE
 * Deterministic hash of comparison inputs (map + variant runs)
 * Used to detect when variants need recalculation
 */

/**
 * Hash map state and run configs for variant comparison
 * @param {Object} params
 * @param {Array} params.fenceLines - Fence line geometry
 * @param {Array} params.gates - Gate objects
 * @param {Array} params.runs - Base runs (unvariant)
 * @param {Object} params.job - Job object (for defaults)
 * @returns {string} Deterministic hash of comparison inputs
 */
export function hashCompareInputs({ fenceLines, gates, runs, job }) {
  // Collect all comparison inputs into a canonical string
  const parts = [];

  // Hash fence line geometry
  if (fenceLines && fenceLines.length > 0) {
    fenceLines.forEach((line, idx) => {
      if (line.assignedRunId) {
        parts.push(
          `line:${idx}:` +
          `${Math.round(line.start.x * 100)},${Math.round(line.start.y * 100)}-` +
          `${Math.round(line.end.x * 100)},${Math.round(line.end.y * 100)}:` +
          `${line.manualLengthFt}:${line.assignedRunId}`
        );
      }
    });
  }

  // Hash gates
  if (gates && gates.length > 0) {
    gates.forEach((gate, idx) => {
      if (!gate.isOrphan && gate.runId && gate.gateWidth_ft) {
        parts.push(
          `gate:${idx}:` +
          `${gate.id}:${gate.runId}:${gate.gateWidth_ft}:` +
          `${gate.gateCenterDistance_ft || 'auto'}`
        );
      }
    });
  }

  // Hash run configs (for all variants a/b/c)
  if (runs && runs.length > 0) {
    runs.forEach((run, idx) => {
      // Base run config
      parts.push(
        `run:${idx}:${run.id}:` +
        `${run.materialType}:${run.fenceHeight}:${run.style}:` +
        `${run.fenceColor}:${run.slopeMode}:${run.slopeGrade}:${run.lengthLF}`
      );

      // Variant overrides (a, b, c)
      if (run.compareVariants) {
        ['a', 'b', 'c'].forEach((variantKey) => {
          const v = run.compareVariants[variantKey];
          if (v) {
            parts.push(
              `variant:${idx}:${variantKey}:` +
              `${v.materialType || '-'}:${v.fenceHeight || '-'}:${v.style || '-'}:` +
              `${v.fenceColor || '-'}:${v.slopeMode || '-'}:${v.slopeGrade || '-'}`
            );
          }
        });
      }
    });
  }

  // Hash job defaults
  if (job) {
    parts.push(
      `job:${job.materialType}:${job.fenceHeight}:${job.style}:${job.fenceColor}`
    );
  }

  // Create deterministic hash
  const canonical = parts.join('|');
  return simpleHash(canonical);
}

/**
 * Simple deterministic hash function
 * @param {string} str
 * @returns {string} Hex hash
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Compare two hashes
 * @param {string} hash1
 * @param {string} hash2
 * @returns {boolean} True if equal
 */
export function hashesEqual(hash1, hash2) {
  return hash1 === hash2;
}