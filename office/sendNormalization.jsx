/**
 * Send-to-Office Pre-Send Normalization & Validation
 * Final authority gate: ensures slope data is complete and accurate before delivery
 */

import { SLOPE_CONFIG, slopeExists, classifySlopeGrade } from '../materials/slopeConfig.jsx';
import { generateMathSubRuns } from '../materials/mathSubRunEngine.jsx';

/**
 * Normalize runs for slope accuracy before send
 * Returns: { normalizedRuns, changes, issues }
 */
export function normalizeRunsForSlope(runs) {
  const changes = [];
  const issues = [];
  const normalizedRuns = runs.map(run => {
    const normalized = { ...run };
    let runChanged = false;
    
    // === STEP 1: DERIVE MISSING SLOPE FIELDS FROM ELEVATIONS ===
    if (normalized.startElevation != null && normalized.endElevation != null) {
      const derivedDropFt = Math.abs(normalized.endElevation - normalized.startElevation);
      
      if (normalized.dropFt == null || normalized.dropFt === 0) {
        normalized.dropFt = derivedDropFt;
        runChanged = true;
        changes.push({
          runId: run.id,
          runLabel: run.runLabel,
          field: 'dropFt',
          from: run.dropFt,
          to: derivedDropFt,
          reason: 'Derived from elevations'
        });
      }
      
      if (!normalized.horizontalRunFt) {
        normalized.horizontalRunFt = normalized.lengthLF;
        runChanged = true;
        changes.push({
          runId: run.id,
          runLabel: run.runLabel,
          field: 'horizontalRunFt',
          from: null,
          to: normalized.lengthLF,
          reason: 'Set to lengthLF'
        });
      }
      
      if (normalized.horizontalRunFt > 0) {
        const derivedGrade = normalized.dropFt / normalized.horizontalRunFt;
        if (normalized.slopeGrade !== derivedGrade) {
          normalized.slopeGrade = derivedGrade;
          runChanged = true;
          changes.push({
            runId: run.id,
            runLabel: run.runLabel,
            field: 'slopeGrade',
            from: run.slopeGrade,
            to: derivedGrade,
            reason: 'Calculated from dropFt/horizontalRunFt'
          });
        }
      }
    }
    
    // === STEP 2: ENFORCE DXF SLOPE SOURCE PRIORITY ===
    if (normalized.slopeDetectedFrom && normalized.slopeDetectedFrom.includes('DXF')) {
      if (normalized.slopeSource !== 'DXF_AUTO_DETECT') {
        normalized.slopeSource = 'DXF_AUTO_DETECT';
        normalized.slopeModeSelection = 'AutoDetect';
        runChanged = true;
        changes.push({
          runId: run.id,
          runLabel: run.runLabel,
          field: 'slopeSource',
          from: run.slopeSource,
          to: 'DXF_AUTO_DETECT',
          reason: 'DXF slope data present - enforcing auto-detect'
        });
      }
    }
    
    // === STEP 3: GENERATE MATH SUBRUNS IF MISSING ===
    const hasSlopeData = slopeExists(normalized, normalized.mathSubRuns);
    if (hasSlopeData && (!normalized.mathSubRuns || normalized.mathSubRuns.length === 0)) {
      // Only generate if we have grade points OR elevations
      if ((normalized.gradePoints && normalized.gradePoints.length >= 2) ||
          (normalized.startElevation != null && normalized.endElevation != null)) {
        normalized.mathSubRuns = generateMathSubRuns(normalized);
        runChanged = true;
        changes.push({
          runId: run.id,
          runLabel: run.runLabel,
          field: 'mathSubRuns',
          from: null,
          to: `${normalized.mathSubRuns.length} subruns`,
          reason: 'Generated from slope data'
        });
      }
    }
    
    // === STEP 4: ENFORCE VINYL RACK MODE ===
    if (normalized.materialType === 'Vinyl') {
      const vinylHasSlope = slopeExists(normalized, normalized.mathSubRuns);
      
      if (vinylHasSlope && normalized.slopeMode !== 'Rack') {
        normalized.slopeMode = 'Rack';
        runChanged = true;
        changes.push({
          runId: run.id,
          runLabel: run.runLabel,
          field: 'slopeMode',
          from: run.slopeMode,
          to: 'Rack',
          reason: 'Vinyl on slope - enforcing Rack mode (FenceBuddy standard)'
        });
      } else if (!vinylHasSlope && normalized.slopeMode === 'Rack') {
        normalized.slopeMode = 'None';
        runChanged = true;
        changes.push({
          runId: run.id,
          runLabel: run.runLabel,
          field: 'slopeMode',
          from: run.slopeMode,
          to: 'None',
          reason: 'Vinyl flat - removing Rack mode'
        });
      }
    }
    
    return runChanged ? { ...normalized, _wasNormalized: true } : run;
  });
  
  // === STEP 5: VALIDATION (BLOCKERS) ===
  normalizedRuns.forEach((run, idx) => {
    // BLOCKER: DXF slope present but source not set correctly
    if (run.slopeDetectedFrom && run.slopeDetectedFrom.includes('DXF') && 
        run.slopeSource !== 'DXF_AUTO_DETECT') {
      issues.push({
        code: 'SLOPE_NOT_DXF_AUTO_DETECT',
        severity: 'BLOCKER',
        message: 'DXF contains slope data; slope must be auto-detected for accuracy.',
        suggestedFix: 'Set slopeSource to DXF_AUTO_DETECT',
        location: `Run ${idx + 1}: ${run.runLabel}`,
        autoFixable: true,
        runId: run.id
      });
    }
    
    // BLOCKER: Elevations present but derived fields missing
    if ((run.startElevation != null && run.endElevation != null) &&
        (run.dropFt == null || run.horizontalRunFt == null || run.slopeGrade == null)) {
      issues.push({
        code: 'MISSING_DERIVED_SLOPE_FIELDS',
        severity: 'BLOCKER',
        message: 'Elevations exist but dropFt/horizontalRunFt/slopeGrade not calculated.',
        suggestedFix: 'Normalize slope fields',
        location: `Run ${idx + 1}: ${run.runLabel}`,
        autoFixable: true,
        runId: run.id
      });
    }
    
    // BLOCKER: Slope exists but mathSubRuns missing
    const hasSlopeData = slopeExists(run, run.mathSubRuns);
    if (hasSlopeData && (!run.mathSubRuns || run.mathSubRuns.length === 0)) {
      if ((run.gradePoints && run.gradePoints.length >= 2) ||
          (run.startElevation != null && run.endElevation != null)) {
        issues.push({
          code: 'MISSING_MATH_SUBRUNS',
          severity: 'BLOCKER',
          message: 'Slope data exists but mathSubRuns not generated.',
          suggestedFix: 'Generate mathSubRuns from slope data',
          location: `Run ${idx + 1}: ${run.runLabel}`,
          autoFixable: true,
          runId: run.id
        });
      }
    }
    
    // BLOCKER: Vinyl on slope without Rack mode
    if (run.materialType === 'Vinyl') {
      const vinylHasSlope = slopeExists(run, run.mathSubRuns);
      if (vinylHasSlope && run.slopeMode !== 'Rack') {
        issues.push({
          code: 'VINYL_SLOPE_REQUIRES_RACK',
          severity: 'BLOCKER',
          message: 'Vinyl on slope must use Rack mode (FenceBuddy Standard).',
          suggestedFix: 'Set slopeMode to Rack',
          location: `Run ${idx + 1}: ${run.runLabel}`,
          autoFixable: true,
          runId: run.id
        });
      }
    }
  });
  
  return {
    normalizedRuns,
    changes,
    issues,
    hasChanges: changes.length > 0,
    hasBlockers: issues.some(i => i.severity === 'BLOCKER')
  };
}

/**
 * Apply normalization fixes and persist to database
 * Also logs auto-fixes to AutoFixLog entity for audit trail
 */
export async function applyNormalizationFixes(base44, jobId, normalizedRuns, changes, triggeredBy = 'send_to_office') {
  const updatePromises = normalizedRuns
    .filter(run => run._wasNormalized)
    .map(run => {
      const { _wasNormalized, ...runData } = run;
      return base44.entities.Run.update(run.id, runData);
    });
  
  await Promise.all(updatePromises);
  
  // === AUTO-FIX AUDIT TRAIL ===
  // Get current user
  let currentUser = null;
  try {
    currentUser = await base44.auth.me();
  } catch (e) {
    // Fallback if auth fails
  }
  
  // Create audit log entries for each changed run
  const runChangesMap = {};
  changes.forEach(change => {
    if (!runChangesMap[change.runId]) {
      runChangesMap[change.runId] = {
        runId: change.runId,
        runLabel: change.runLabel,
        changedFields: []
      };
    }
    runChangesMap[change.runId].changedFields.push({
      field: change.field,
      from: change.from,
      to: change.to,
      reason: change.reason
    });
  });
  
  const auditLogPromises = Object.values(runChangesMap).map(runChange => {
    // Determine fix type from changed fields
    let fixType = 'slope_normalization';
    if (runChange.changedFields.some(f => f.field === 'slopeMode' && f.to === 'Rack')) {
      fixType = 'vinyl_rack_enforce';
    } else if (runChange.changedFields.some(f => f.field === 'mathSubRuns')) {
      fixType = 'mathSubRuns_generation';
    } else if (runChange.changedFields.some(f => f.field === 'slopeSource' && f.to === 'DXF_AUTO_DETECT')) {
      fixType = 'dxf_source_enforce';
    } else if (runChange.changedFields.some(f => ['dropFt', 'slopeGrade', 'horizontalRunFt'].includes(f.field))) {
      fixType = 'derived_fields_calculation';
    }
    
    return base44.entities.AutoFixLog.create({
      jobId,
      runId: runChange.runId,
      runLabel: runChange.runLabel,
      fixAppliedAt: new Date().toISOString(),
      fixType,
      changedFields: runChange.changedFields,
      triggeredBy,
      appliedByUser: currentUser?.email || 'system'
    });
  });
  
  await Promise.all(auditLogPromises);
  
  return {
    updatedCount: updatePromises.length,
    auditLogsCreated: auditLogPromises.length,
    success: true
  };
}