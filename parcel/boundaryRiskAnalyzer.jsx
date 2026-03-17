// Boundary Risk Analyzer for ROW/Setback Warnings

import { samplePolylinePoints, distancePointToSegment } from './parcelService';
import { extractParcelOuterRing, buildBoundarySegments } from './parcelCornerLotAnalyzer';

/**
 * Preset configurations
 */
export const BOUNDARY_RISK_PRESETS = {
  STANDARD: {
    boundary_near_ft: 2,
    boundary_row_risk_ft: 1
  },
  CONSERVATIVE: {
    boundary_near_ft: 3,
    boundary_row_risk_ft: 1.5
  },
  CUSTOM: {
    boundary_near_ft: null,
    boundary_row_risk_ft: null
  }
};

/**
 * Get thresholds for a job (with defaults)
 */
export function getBoundaryThresholds(job) {
  const preset = job.boundary_risk_preset || 'STANDARD';
  
  if (preset === 'CUSTOM') {
    return {
      near_ft: job.boundary_near_ft || 2,
      row_risk_ft: job.boundary_row_risk_ft || 1
    };
  }
  
  const config = BOUNDARY_RISK_PRESETS[preset];
  return {
    near_ft: job.boundary_near_ft || config.boundary_near_ft,
    row_risk_ft: job.boundary_row_risk_ft || config.boundary_row_risk_ft
  };
}

/**
 * Compute minimum distance from run to parcel boundary
 */
export function computeRunMinDistanceToParcelBoundary(runPolyline, parcelGeojson) {
  if (!parcelGeojson || !runPolyline || runPolyline.length < 2) {
    return null;
  }

  const outerRing = extractParcelOuterRing(parcelGeojson);
  if (!outerRing) return null;

  const boundarySegments = buildBoundarySegments(outerRing);
  if (boundarySegments.length === 0) return null;

  // Sample run polyline
  const samples = samplePolylinePoints(runPolyline, 3); // Every 3 ft
  if (samples.length === 0) return null;

  let minDistance = Infinity;

  samples.forEach(point => {
    boundarySegments.forEach(seg => {
      const dist = distancePointToSegment(point, seg.a, seg.b);
      minDistance = Math.min(minDistance, dist);
    });
  });

  return minDistance === Infinity ? null : minDistance;
}

/**
 * Classify boundary risk status
 */
export function classifyBoundaryRisk(minDistanceFt, thresholds, job) {
  if (minDistanceFt === null) {
    return {
      status: 'NO_PARCEL',
      messages: ['Property lines not loaded. Boundary risk check skipped.']
    };
  }

  const { near_ft, row_risk_ft } = thresholds;
  let status;
  let messages = [];

  // Base classification
  if (minDistanceFt <= row_risk_ft) {
    status = 'WARN_LIKELY_ROW_RISK';
    messages.push('Run is extremely close to the property line — high ROW/easement risk.');
  } else if (minDistanceFt <= near_ft) {
    status = 'WARN_NEAR_BOUNDARY';
    messages.push('Run is close to the property line — verify boundary/ROW before install.');
  } else {
    status = 'OK';
    messages = [];
  }

  // Escalation rules
  if (job.sidewalkDetected && status === 'WARN_NEAR_BOUNDARY') {
    status = 'WARN_LIKELY_ROW_RISK';
    messages = ['Sidewalk present — boundary proximity often indicates ROW/sidewalk easement risk.'];
  }

  if (job.cornerLot && (status === 'WARN_NEAR_BOUNDARY' || status === 'WARN_LIKELY_ROW_RISK')) {
    messages.push('Corner lot — street-side setbacks/height limits often apply.');
  }

  // Street edge proximity (if selected)
  if (job.street_edges_selected && job.street_edges_count >= 1) {
    if (status === 'WARN_NEAR_BOUNDARY') {
      messages.push('Run near street-facing edge — verify setback requirements.');
    }
  }

  return { status, messages };
}

/**
 * Validate run boundary risk
 */
export function validateRunBoundaryRisk(runPolyline, parcelGeojson, parcelFetchStatus, job) {
  // No parcel available
  if (!parcelGeojson || parcelFetchStatus !== 'OK') {
    return {
      minDistanceFt: null,
      status: 'NO_PARCEL',
      messages: ['Property lines not loaded. Boundary risk check skipped.']
    };
  }

  const thresholds = getBoundaryThresholds(job);
  const minDistanceFt = computeRunMinDistanceToParcelBoundary(runPolyline, parcelGeojson);
  const { status, messages } = classifyBoundaryRisk(minDistanceFt, thresholds, job);

  return {
    minDistanceFt,
    status,
    messages
  };
}