// Visibility Triangle Validator

import { samplePolylinePoints } from '../parcel/parcelService';

/**
 * Check if point is inside triangle
 */
function pointInTriangle(point, triangle) {
  const [px, py] = point;
  const [p0, p1, p2] = triangle;
  
  const area = 0.5 * (-p1[1] * p2[0] + p0[1] * (-p1[0] + p2[0]) + p0[0] * (p1[1] - p2[1]) + p1[0] * p2[1]);
  const s = 1 / (2 * area) * (p0[1] * p2[0] - p0[0] * p2[1] + (p2[1] - p0[1]) * px + (p0[0] - p2[0]) * py);
  const t = 1 / (2 * area) * (p0[0] * p1[1] - p0[1] * p1[0] + (p0[1] - p1[1]) * px + (p1[0] - p0[0]) * py);
  
  return s >= 0 && t >= 0 && (1 - s - t) >= 0;
}

/**
 * Check if polyline intersects triangle
 */
export function polylineIntersectsTriangle(runPolyline, trianglePolygon) {
  if (!runPolyline || runPolyline.length < 2 || !trianglePolygon || trianglePolygon.length < 3) {
    return false;
  }

  // Sample points along run
  const samples = samplePolylinePoints(runPolyline, 2); // Every 2 ft
  
  // Extract triangle points (first 3)
  const triangle = trianglePolygon.slice(0, 3);
  
  // Check if any sample is inside triangle
  return samples.some(point => pointInTriangle(point, triangle));
}

/**
 * Parse height to inches
 */
function parseHeightToInches(heightValue) {
  if (!heightValue) return null;
  
  // If numeric, assume feet
  if (typeof heightValue === 'number') {
    return heightValue * 12;
  }
  
  // Parse string like "6'" or "6 ft"
  const match = String(heightValue).match(/(\d+)/);
  if (match) {
    return parseInt(match[1]) * 12;
  }
  
  return null;
}

/**
 * Get max height from job and rules
 */
export function getVisionTriangleMaxHeight(job, mergedRules) {
  // Check rules first
  if (mergedRules?.visibility_triangle?.max_height_inches) {
    return mergedRules.visibility_triangle.max_height_inches;
  }
  
  // Fallback to job setting
  return job.vision_triangle_max_height_inches || 24;
}

/**
 * Validate run against visibility triangle
 */
export function validateRunAgainstVisionTriangle(runPolyline, job, run, mergedRules) {
  // Triangle not enabled
  if (!job.vision_triangle_enabled || !job.vision_triangle_polygon) {
    return {
      status: 'NO_TRIANGLE',
      messages: []
    };
  }

  // Check intersection
  const intersects = polylineIntersectsTriangle(runPolyline, job.vision_triangle_polygon);
  
  if (!intersects) {
    return {
      status: 'OK',
      messages: []
    };
  }

  // Run intersects triangle - check height
  const maxHeightInches = getVisionTriangleMaxHeight(job, mergedRules);
  
  // Get run height
  const runHeightInches = run.proposed_height_ft 
    ? run.proposed_height_ft * 12 
    : parseHeightToInches(run.fenceHeight);
  
  if (runHeightInches === null) {
    return {
      status: 'WARN_IN_TRIANGLE',
      messages: ['Run crosses visibility triangle. Set run height to confirm compliance.']
    };
  }

  if (runHeightInches > maxHeightInches) {
    return {
      status: 'WARN_IN_TRIANGLE',
      messages: [
        `Run crosses visibility triangle and exceeds allowed height (${maxHeightInches}" max).`,
        'Verify clear vision area requirements with local jurisdiction.'
      ]
    };
  }

  return {
    status: 'OK',
    messages: []
  };
}

/**
 * Validate all runs against vision triangle
 */
export function validateAllRunsAgainstVisionTriangle(runs, runPolylines, job, mergedRules) {
  return runs.map((run, idx) => {
    const polyline = runPolylines[idx] || [[0, 0], [run.lengthLF, 0]]; // Placeholder
    const result = validateRunAgainstVisionTriangle(polyline, job, run, mergedRules);
    
    return {
      ...run,
      vision_triangle_status: result.status,
      vision_triangle_messages: result.messages
    };
  });
}