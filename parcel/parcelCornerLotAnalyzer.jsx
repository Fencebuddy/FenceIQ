// Corner Lot Detection Analyzer

/**
 * Extract outer ring from parcel GeoJSON
 */
export function extractParcelOuterRing(parcelGeojson) {
  if (!parcelGeojson || !parcelGeojson.coordinates) {
    return null;
  }

  let polygon;
  
  if (parcelGeojson.type === 'Polygon') {
    polygon = parcelGeojson.coordinates;
  } else if (parcelGeojson.type === 'MultiPolygon') {
    // Use largest polygon
    const polygons = parcelGeojson.coordinates;
    polygon = polygons.reduce((largest, current) => {
      const largestArea = calculatePolygonArea(largest[0]);
      const currentArea = calculatePolygonArea(current[0]);
      return currentArea > largestArea ? current : largest;
    });
  } else {
    return null;
  }

  const outerRing = polygon[0];
  
  // Ensure ring is closed
  if (outerRing.length > 0) {
    const first = outerRing[0];
    const last = outerRing[outerRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      outerRing.push([...first]);
    }
  }

  return outerRing;
}

/**
 * Build boundary segments from outer ring
 */
export function buildBoundarySegments(outerRing) {
  if (!outerRing || outerRing.length < 2) {
    return [];
  }

  const segments = [];
  for (let i = 0; i < outerRing.length - 1; i++) {
    segments.push({
      a: outerRing[i],
      b: outerRing[i + 1],
      index: i
    });
  }

  return segments;
}

/**
 * Calculate polygon area (simple shoelace formula)
 */
function calculatePolygonArea(ring) {
  if (!ring || ring.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  
  return Math.abs(area / 2);
}

/**
 * Calculate segment angle (0-360 degrees)
 */
function calculateSegmentAngle(seg) {
  const dx = seg.b[0] - seg.a[0];
  const dy = seg.b[1] - seg.a[1];
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return angle < 0 ? angle + 360 : angle;
}

/**
 * Calculate segment length
 */
function calculateSegmentLength(seg) {
  const dx = seg.b[0] - seg.a[0];
  const dy = seg.b[1] - seg.a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Group segments by direction (angle buckets)
 */
function groupSegmentsByDirection(segments) {
  const bucketSize = 15; // degrees
  const groups = {};

  segments.forEach(seg => {
    const angle = calculateSegmentAngle(seg);
    const bucket = Math.floor(angle / bucketSize) * bucketSize;
    
    if (!groups[bucket]) {
      groups[bucket] = [];
    }
    groups[bucket].push(seg);
  });

  return groups;
}

/**
 * Find dominant direction groups (top 2)
 */
function findDominantDirections(segments) {
  const groups = groupSegmentsByDirection(segments);
  
  // Calculate total length per direction
  const directionLengths = Object.entries(groups).map(([angle, segs]) => ({
    angle: parseFloat(angle),
    segments: segs,
    totalLength: segs.reduce((sum, seg) => sum + calculateSegmentLength(seg), 0)
  }));

  // Sort by total length
  directionLengths.sort((a, b) => b.totalLength - a.totalLength);

  return directionLengths.slice(0, 2);
}

/**
 * Check if two directions are roughly perpendicular
 */
function areDirectionsPerpendicular(angle1, angle2) {
  const diff = Math.abs(angle1 - angle2);
  const normalizedDiff = Math.min(diff, 360 - diff);
  return normalizedDiff >= 75 && normalizedDiff <= 105; // ~90 degrees ± 15
}

/**
 * Evaluate corner lot heuristic
 */
export function evaluateCornerLotHeuristic(job, runs) {
  // Already set manually
  if (job.cornerLot === true) {
    return { suggested: false, confidence: null, reason: 'Already enabled manually' };
  }

  // User dismissed
  if (job.corner_lot_suggestion_dismissed === true) {
    return { suggested: false, confidence: null, reason: 'User dismissed' };
  }

  // No parcel
  if (!job.parcel_geojson || job.parcel_fetch_status !== 'OK') {
    return { suggested: false, confidence: null, reason: 'No parcel loaded' };
  }

  // User manually selected street edges
  if (job.street_edges_count >= 2) {
    return {
      suggested: true,
      confidence: 'HIGH',
      reason: 'User selected two street-facing edges'
    };
  }

  const outerRing = extractParcelOuterRing(job.parcel_geojson);
  if (!outerRing) {
    return { suggested: false, confidence: null, reason: 'Could not extract parcel boundary' };
  }

  const segments = buildBoundarySegments(outerRing);
  if (segments.length < 4) {
    return { suggested: false, confidence: null, reason: 'Parcel too simple' };
  }

  // Find dominant directions
  const dominantDirs = findDominantDirections(segments);
  
  if (dominantDirs.length < 2) {
    return { suggested: false, confidence: 'LOW', reason: 'Single dominant direction' };
  }

  const [dir1, dir2] = dominantDirs;

  // Check if roughly perpendicular (corner lot indicator)
  const isPerpendicular = areDirectionsPerpendicular(dir1.angle, dir2.angle);

  if (!isPerpendicular) {
    return { suggested: false, confidence: 'LOW', reason: 'Directions not perpendicular' };
  }

  // If runs exist, check if two sides are unfenced
  if (runs && runs.length > 0) {
    // Simple heuristic: if runs cover less than 75% of perimeter, two sides may be street-facing
    const totalRunLength = runs.reduce((sum, r) => sum + (r.lengthLF || 0), 0);
    const perimeterLength = segments.reduce((sum, seg) => sum + calculateSegmentLength(seg), 0);
    const coverage = totalRunLength / perimeterLength;

    if (coverage < 0.75) {
      return {
        suggested: true,
        confidence: 'MEDIUM',
        reason: 'Fence runs suggest two street-facing sides'
      };
    }
  }

  // Geometry-only suggestion (conservative)
  return {
    suggested: true,
    confidence: 'LOW',
    reason: 'Two likely frontage edges detected by parcel shape'
  };
}

/**
 * Find nearest boundary segment to a tap point
 */
export function findNearestSegment(tapPoint, segments) {
  if (!segments || segments.length === 0) return null;

  let minDist = Infinity;
  let nearestSeg = null;

  segments.forEach(seg => {
    const dist = distancePointToSegment(tapPoint, seg.a, seg.b);
    if (dist < minDist) {
      minDist = dist;
      nearestSeg = seg;
    }
  });

  return nearestSeg;
}

/**
 * Distance from point to line segment
 */
function distancePointToSegment(point, segA, segB) {
  const [px, py] = point;
  const [ax, ay] = segA;
  const [bx, by] = segB;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay));
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * dx;
  const closestY = ay + t * dy;

  return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
}