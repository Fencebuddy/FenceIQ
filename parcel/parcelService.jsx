// Parcel Service - handles geocoding and parcel boundary fetching

/**
 * Geocode address using US Census Geocoder
 */
export async function geocodeAddress(addressFull) {
  const url = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';
  const params = new URLSearchParams({
    address: addressFull,
    benchmark: 'Public_AR_Current',
    vintage: 'Current_Current',
    format: 'json'
  });

  try {
    const response = await fetch(`${url}?${params}`);
    const data = await response.json();

    if (data.result?.addressMatches && data.result.addressMatches.length > 0) {
      const match = data.result.addressMatches[0];
      const coords = match.coordinates;
      const county = match.geographies?.['2020 Census Blocks']?.[0]?.COUNTY;

      return {
        success: true,
        lat: coords.y,
        lng: coords.x,
        county: county || null,
        matchedAddress: match.matchedAddress
      };
    }

    return {
      success: false,
      error: 'No address match found'
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Query ArcGIS parcel service for parcel at point
 */
export async function queryParcelAtPoint(serviceConfig, lat, lng) {
  const { base_url, layer_id, service_type } = serviceConfig;
  const url = `${base_url}/${layer_id}/query`;

  const params = new URLSearchParams({
    f: 'json',
    geometryType: 'esriGeometryPoint',
    geometry: `${lng},${lat}`,
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326'
  });

  try {
    const response = await fetch(`${url}?${params}`);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      // Use first feature (or smallest if multiple)
      const feature = data.features.length === 1 
        ? data.features[0]
        : data.features.reduce((smallest, f) => {
            // Simple area approximation
            const area = calculatePolygonArea(f.geometry);
            const smallestArea = calculatePolygonArea(smallest.geometry);
            return area < smallestArea ? f : smallest;
          });

      // Convert Esri geometry to GeoJSON
      const geojson = esriToGeoJSON(feature.geometry);
      
      // Calculate bbox
      const bbox = calculateBBox(geojson);

      // Extract parcel ID
      const parcelId = feature.attributes.ParcelNumber || 
                       feature.attributes.PARCELNUM || 
                       feature.attributes.APN ||
                       feature.attributes.PIN ||
                       null;

      return {
        success: true,
        geojson,
        bbox,
        parcelId,
        multipleFound: data.features.length > 1
      };
    }

    return {
      success: false,
      error: 'No parcel found at this location'
    };
  } catch (error) {
    console.error('Parcel query error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Convert Esri polygon geometry to GeoJSON
 */
function esriToGeoJSON(esriGeometry) {
  if (!esriGeometry || !esriGeometry.rings) {
    return null;
  }

  // Esri rings are [[[x,y], [x,y], ...]]
  // GeoJSON needs [[[lng, lat], [lng, lat], ...]]
  const coordinates = esriGeometry.rings.map(ring =>
    ring.map(coord => [coord[0], coord[1]])
  );

  return {
    type: 'Polygon',
    coordinates
  };
}

/**
 * Calculate bounding box from GeoJSON polygon
 */
function calculateBBox(geojson) {
  if (!geojson || !geojson.coordinates) return null;

  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;

  geojson.coordinates.forEach(ring => {
    ring.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
  });

  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Simple polygon area calculation (for choosing smallest parcel)
 */
function calculatePolygonArea(esriGeometry) {
  if (!esriGeometry || !esriGeometry.rings || esriGeometry.rings.length === 0) {
    return 0;
  }

  const ring = esriGeometry.rings[0];
  let area = 0;
  
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  
  return Math.abs(area / 2);
}

/**
 * Check if point is inside polygon (for run validation)
 */
export function pointInPolygon(point, polygon) {
  if (!polygon || !polygon.coordinates || !polygon.coordinates[0]) {
    return false;
  }

  const [x, y] = point;
  const ring = polygon.coordinates[0];
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate percentage of line outside parcel
 */
export function calculateLineOutsideParcel(line, parcelGeojson, sampleIntervalPx = 10) {
  if (!parcelGeojson || !line.start || !line.end) {
    return 0;
  }

  const samples = [];
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const numSamples = Math.max(3, Math.floor(length / sampleIntervalPx));

  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    samples.push([
      line.start.x + dx * t,
      line.start.y + dy * t
    ]);
  }

  const outsideCount = samples.filter(point => !pointInPolygon(point, parcelGeojson)).length;
  
  return (outsideCount / samples.length) * 100;
}

/**
 * Normalize GeoJSON polygon (handle Polygon or MultiPolygon)
 */
export function normalizeGeoJSONPolygon(parcelGeojson) {
  if (!parcelGeojson || !parcelGeojson.coordinates) {
    return [];
  }

  if (parcelGeojson.type === 'Polygon') {
    return [parcelGeojson.coordinates];
  } else if (parcelGeojson.type === 'MultiPolygon') {
    return parcelGeojson.coordinates;
  }

  return [];
}

/**
 * Sample points along a polyline
 */
export function samplePolylinePoints(polyline, spacingFt = 3) {
  if (!polyline || polyline.length < 2) {
    return [];
  }

  const samples = [];
  samples.push(polyline[0]); // Start point

  for (let i = 0; i < polyline.length - 1; i++) {
    const start = polyline[i];
    const end = polyline[i + 1];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    const numSegmentSamples = Math.max(1, Math.floor(segmentLength / spacingFt));

    for (let j = 1; j <= numSegmentSamples; j++) {
      const t = j / numSegmentSamples;
      samples.push([
        start[0] + dx * t,
        start[1] + dy * t
      ]);
    }
  }

  return samples;
}

/**
 * Distance from point to line segment
 */
export function distancePointToSegment(point, segA, segB) {
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

/**
 * Find minimum distance from point to any segment in polygon boundary
 */
export function minDistanceToParcelBoundary(point, parcelGeojson) {
  const polygons = normalizeGeoJSONPolygon(parcelGeojson);
  if (polygons.length === 0) return Infinity;

  let minDist = Infinity;

  polygons.forEach(polygon => {
    const outerRing = polygon[0];
    for (let i = 0; i < outerRing.length - 1; i++) {
      const dist = distancePointToSegment(point, outerRing[i], outerRing[i + 1]);
      minDist = Math.min(minDist, dist);
    }
  });

  return minDist;
}

/**
 * Validate run polyline against parcel boundary
 */
export function validateRunAgainstParcel(runPolyline, parcelGeojson, parcelFetchStatus) {
  // No parcel available
  if (!parcelGeojson || parcelFetchStatus !== 'OK') {
    return {
      outsidePercent: null,
      status: 'NO_PARCEL',
      messages: ['Property lines not loaded. Validation skipped.']
    };
  }

  // Sample the run polyline
  const samples = samplePolylinePoints(runPolyline, 3);
  if (samples.length === 0) {
    return {
      outsidePercent: 0,
      status: 'OK',
      messages: []
    };
  }

  // Check each sample point
  const polygons = normalizeGeoJSONPolygon(parcelGeojson);
  let outsideCount = 0;
  let minDistToBoundary = Infinity;

  samples.forEach(point => {
    let inside = false;
    
    // Check if point is inside any polygon
    polygons.forEach(polygon => {
      const outerRing = polygon[0];
      if (pointInPolygon(point, { coordinates: [outerRing] })) {
        inside = true;
      }
    });

    if (!inside) {
      outsideCount++;
    } else {
      // Track min distance to boundary for near-edge detection
      const dist = minDistanceToParcelBoundary(point, parcelGeojson);
      minDistToBoundary = Math.min(minDistToBoundary, dist);
    }
  });

  const outsidePercent = Math.round((outsideCount / samples.length) * 100);

  // Determine status
  if (outsidePercent === 0) {
    // Check if near edge (within ~2 ft threshold)
    const nearEdgeThreshold = 0.0001; // Adjust based on coordinate scale
    if (minDistToBoundary < nearEdgeThreshold) {
      return {
        outsidePercent: 0,
        status: 'WARN_NEAR_EDGE',
        messages: ['Run is within ~2 ft of the property line. Verify boundary/ROW.']
      };
    }
    return {
      outsidePercent: 0,
      status: 'OK',
      messages: []
    };
  } else if (outsidePercent <= 10) {
    return {
      outsidePercent,
      status: 'WARN_NEAR_EDGE',
      messages: ['Run is very close to or slightly outside the property line. Verify boundary/ROW.']
    };
  } else {
    // Enhanced messaging for corner lots
    const isCornerLot = false; // Pass this from job context if available
    const message = isCornerLot
      ? 'Run extends outside the property line. On corner lots, street-side setbacks/height limits often apply.'
      : 'Run extends outside the property line. Verify boundary/ROW before install.';
    
    return {
      outsidePercent,
      status: 'WARN_OUTSIDE_PARCEL',
      messages: [message]
    };
  }
}