import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertTriangle, Play } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * ARCHITECTURE DIAGNOSTICS
 * Full system check against the "correct architecture"
 */
export default function ArchitectureDiagnostics({ 
  job, 
  runs, 
  gates, 
  takeoff, 
  materials, 
  fenceLines,
  rendererConfig,
  spanOverlay 
}) {
  const [expanded, setExpanded] = useState({});

  // Run all diagnostic checks
  const diagnostics = useMemo(() => {
    return runFullDiagnostics(job, runs, gates, takeoff, materials, fenceLines, rendererConfig, spanOverlay);
  }, [job, runs, gates, takeoff, materials, fenceLines, rendererConfig, spanOverlay]);

  const toggleSection = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getSectionIcon = (checks) => {
    const allPass = checks.every(c => c.status === 'PASS');
    const anyFail = checks.some(c => c.status === 'FAIL');
    
    if (allPass) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (anyFail) return <XCircle className="w-4 h-4 text-red-600" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
  };

  const getStatusColor = (status) => {
    if (status === 'PASS') return 'text-green-600';
    if (status === 'FAIL') return 'text-red-600';
    return 'text-yellow-600';
  };

  return (
    <Card className="border-blue-300 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between text-blue-900">
          📊 Architecture Diagnostics
          <Badge className={
            diagnostics.summary.failCount > 0 ? 'bg-red-600' : 
            diagnostics.summary.warnCount > 0 ? 'bg-yellow-600' : 
            'bg-green-600'
          }>
            {diagnostics.summary.passCount}✓ {diagnostics.summary.failCount}✗ {diagnostics.summary.warnCount}⚠
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        
        {/* Summary */}
        <div className="bg-white rounded p-3 text-xs space-y-1">
          <div className="font-semibold">System Health: {diagnostics.summary.health}</div>
          <div className="text-slate-600">{diagnostics.summary.message}</div>
        </div>

        {/* Core Architecture */}
        <Collapsible open={expanded.core} onOpenChange={() => toggleSection('core')}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between text-xs">
              <span className="flex items-center gap-2">
                {getSectionIcon(diagnostics.coreArchitecture)}
                Core Architecture ({diagnostics.coreArchitecture.filter(c => c.status === 'PASS').length}/{diagnostics.coreArchitecture.length})
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-white rounded p-3 mt-2 space-y-2 text-xs">
              {diagnostics.coreArchitecture.map((check, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  {check.status === 'PASS' && <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />}
                  {check.status === 'FAIL' && <XCircle className="w-3 h-3 text-red-600 mt-0.5 flex-shrink-0" />}
                  {check.status === 'WARN' && <AlertTriangle className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <div className={`font-medium ${getStatusColor(check.status)}`}>{check.name}</div>
                    <div className="text-slate-600">{check.message}</div>
                    {check.details && <div className="text-slate-500 text-[10px] mt-1">{check.details}</div>}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Material Engines */}
        <Collapsible open={expanded.engines} onOpenChange={() => toggleSection('engines')}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between text-xs">
              <span className="flex items-center gap-2">
                {getSectionIcon(diagnostics.materialEngines)}
                Material Engines ({diagnostics.materialEngines.filter(c => c.status === 'PASS').length}/{diagnostics.materialEngines.length})
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-white rounded p-3 mt-2 space-y-2 text-xs">
              {diagnostics.materialEngines.map((check, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  {check.status === 'PASS' && <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />}
                  {check.status === 'FAIL' && <XCircle className="w-3 h-3 text-red-600 mt-0.5 flex-shrink-0" />}
                  {check.status === 'WARN' && <AlertTriangle className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <div className={`font-medium ${getStatusColor(check.status)}`}>{check.name}</div>
                    <div className="text-slate-600">{check.message}</div>
                    {check.details && <div className="text-slate-500 text-[10px] mt-1">{check.details}</div>}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Map Behavior */}
        <Collapsible open={expanded.map} onOpenChange={() => toggleSection('map')}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between text-xs">
              <span className="flex items-center gap-2">
                {getSectionIcon(diagnostics.mapBehavior)}
                Map Behavior ({diagnostics.mapBehavior.filter(c => c.status === 'PASS').length}/{diagnostics.mapBehavior.length})
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-white rounded p-3 mt-2 space-y-2 text-xs">
              {diagnostics.mapBehavior.map((check, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  {check.status === 'PASS' && <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />}
                  {check.status === 'FAIL' && <XCircle className="w-3 h-3 text-red-600 mt-0.5 flex-shrink-0" />}
                  {check.status === 'WARN' && <AlertTriangle className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <div className={`font-medium ${getStatusColor(check.status)}`}>{check.name}</div>
                    <div className="text-slate-600">{check.message}</div>
                    {check.details && <div className="text-slate-500 text-[10px] mt-1">{check.details}</div>}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Switching Logic */}
        <Collapsible open={expanded.switching} onOpenChange={() => toggleSection('switching')}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between text-xs">
              <span className="flex items-center gap-2">
                {getSectionIcon(diagnostics.switchingLogic)}
                Switching Logic ({diagnostics.switchingLogic.filter(c => c.status === 'PASS').length}/{diagnostics.switchingLogic.length})
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-white rounded p-3 mt-2 space-y-2 text-xs">
              {diagnostics.switchingLogic.map((check, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  {check.status === 'PASS' && <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />}
                  {check.status === 'FAIL' && <XCircle className="w-3 h-3 text-red-600 mt-0.5 flex-shrink-0" />}
                  {check.status === 'WARN' && <AlertTriangle className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <div className={`font-medium ${getStatusColor(check.status)}`}>{check.name}</div>
                    <div className="text-slate-600">{check.message}</div>
                    {check.details && <div className="text-slate-500 text-[10px] mt-1">{check.details}</div>}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Gate Coverage */}
        <Collapsible open={expanded.gates} onOpenChange={() => toggleSection('gates')}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between text-xs">
              <span className="flex items-center gap-2">
                {getSectionIcon(diagnostics.gateCoverage)}
                Gate Coverage ({diagnostics.gateCoverage.filter(c => c.status === 'PASS').length}/{diagnostics.gateCoverage.length})
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-white rounded p-3 mt-2 space-y-2 text-xs">
              {diagnostics.gateCoverage.map((check, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  {check.status === 'PASS' && <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />}
                  {check.status === 'FAIL' && <XCircle className="w-3 h-3 text-red-600 mt-0.5 flex-shrink-0" />}
                  {check.status === 'WARN' && <AlertTriangle className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <div className={`font-medium ${getStatusColor(check.status)}`}>{check.name}</div>
                    <div className="text-slate-600">{check.message}</div>
                    {check.details && <div className="text-slate-500 text-[10px] mt-1">{check.details}</div>}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

      </CardContent>
    </Card>
  );
}

/**
 * RUN FULL DIAGNOSTICS
 */
function runFullDiagnostics(job, runs, gates, takeoff, materials, fenceLines, rendererConfig, spanOverlay) {
  const checks = {
    coreArchitecture: [],
    materialEngines: [],
    mapBehavior: [],
    switchingLogic: [],
    gateCoverage: []
  };

  // ============================================
  // CORE ARCHITECTURE CHECKS
  // ============================================
  
  // Check 1: Router-based takeoff exists
  if (takeoff) {
    checks.coreArchitecture.push({
      name: "✓ Router-based takeoff",
      status: 'PASS',
      message: "Takeoff object exists and is being used"
    });
  } else {
    checks.coreArchitecture.push({
      name: "✗ Router-based takeoff",
      status: 'FAIL',
      message: "No takeoff object found - materials may be computed in multiple places"
    });
  }

  // Check 2: Single source of truth
  const materialsMismatch = takeoff && materials && materials.length > 0 && 
    materials.some(m => m.source === 'calculated' && !takeoff.lineItems?.some(t => t.materialDescription === m.lineItemName));
  
  if (!materialsMismatch) {
    checks.coreArchitecture.push({
      name: "✓ Single source of truth",
      status: 'PASS',
      message: "Materials list matches takeoff.lineItems"
    });
  } else {
    checks.coreArchitecture.push({
      name: "⚠ Single source of truth",
      status: 'WARN',
      message: "Some materials in DB don't match takeoff - possible stale data"
    });
  }

  // Check 3: Mismatch guard
  if (takeoff && job && takeoff.materialType === job.materialType) {
    checks.coreArchitecture.push({
      name: "✓ Mismatch guard",
      status: 'PASS',
      message: `Takeoff material (${takeoff.materialType}) matches job material (${job.materialType})`
    });
  } else if (takeoff && job) {
    checks.coreArchitecture.push({
      name: "✗ Mismatch guard",
      status: 'FAIL',
      message: `CRITICAL: Takeoff material (${takeoff.materialType}) ≠ job material (${job.materialType})`,
      details: "This will show wrong materials! Takeoff must be recomputed."
    });
  }

  // Check 4: Data model consistency
  const allRunsMatchJob = runs.every(r => r.materialType === job.materialType);
  if (allRunsMatchJob) {
    checks.coreArchitecture.push({
      name: "✓ Data model consistency",
      status: 'PASS',
      message: "All runs match job material type (unified mode)"
    });
  } else {
    checks.coreArchitecture.push({
      name: "⚠ Data model consistency",
      status: 'WARN',
      message: "Mixed materials detected - some runs differ from job material",
      details: `Job: ${job.materialType}, Run materials: ${[...new Set(runs.map(r => r.materialType))].join(', ')}`
    });
  }

  // Check 5: Geometry linkage
  const fenceLinesLinked = fenceLines && fenceLines.every(line => line.assignedRunId || fenceLines.length === 0);
  if (fenceLinesLinked || !fenceLines || fenceLines.length === 0) {
    checks.coreArchitecture.push({
      name: "✓ Geometry linkage",
      status: 'PASS',
      message: "All fence lines are linked to runs (or no lines drawn)"
    });
  } else {
    const unlinkedCount = fenceLines.filter(l => !l.assignedRunId).length;
    checks.coreArchitecture.push({
      name: "⚠ Geometry linkage",
      status: 'WARN',
      message: `${unlinkedCount} fence lines not assigned to runs`,
      details: "Unassigned lines may not be included in takeoff"
    });
  }

  // ============================================
  // MATERIAL ENGINE CHECKS
  // ============================================
  
  if (!takeoff) {
    checks.materialEngines.push({
      name: "Material engines",
      status: 'FAIL',
      message: "Cannot check - no takeoff object"
    });
  } else {
    const lineItems = takeoff.lineItems || [];
    const itemNames = lineItems.map(i => i.materialDescription?.toLowerCase() || '');

    // VINYL checks
    if (takeoff.materialType === 'Vinyl') {
      const hasVinylPosts = itemNames.some(n => n.includes('vinyl') && n.includes('post'));
      const hasVinylPanels = itemNames.some(n => n.includes('vinyl') && n.includes('panel'));
      const hasForeignItems = itemNames.some(n => n.includes('tension band') || n.includes('fabric') || n.includes('picket'));
      
      if (hasVinylPosts && hasVinylPanels && !hasForeignItems) {
        checks.materialEngines.push({
          name: "✓ Vinyl engine",
          status: 'PASS',
          message: "Vinyl posts + panels present, no foreign items"
        });
      } else {
        checks.materialEngines.push({
          name: "✗ Vinyl engine",
          status: 'FAIL',
          message: `Missing: ${!hasVinylPosts ? 'posts ' : ''}${!hasVinylPanels ? 'panels ' : ''}${hasForeignItems ? '| Has foreign items' : ''}`
        });
      }

      // Post counts
      if (takeoff.postCounts) {
        const { endPosts, cornerPosts, gatePosts, linePosts, totalVinylPosts } = takeoff.postCounts;
        const sum = (endPosts || 0) + (cornerPosts || 0) + (gatePosts || 0) + (linePosts || 0);
        if (sum === totalVinylPosts) {
          checks.materialEngines.push({
            name: "✓ Vinyl post math",
            status: 'PASS',
            message: `Post counts add up: ${totalVinylPosts} total`
          });
        } else {
          checks.materialEngines.push({
            name: "✗ Vinyl post math",
            status: 'FAIL',
            message: `Post counts don't add up: ${sum} ≠ ${totalVinylPosts}`
          });
        }
      }
    }

    // CHAIN LINK checks
    if (takeoff.materialType === 'Chain Link') {
      const hasFabric = itemNames.some(n => n.includes('fabric'));
      const hasTopRail = itemNames.some(n => n.includes('top rail'));
      const hasTensionWire = itemNames.some(n => n.includes('tension wire'));
      const hasTensionBands = itemNames.some(n => n.includes('tension band'));
      const hasLoopCaps = itemNames.some(n => n.includes('loop cap'));
      const hasForeignItems = itemNames.some(n => n.includes('vinyl panel') || n.includes('picket'));

      const requiredCount = [hasFabric, hasTopRail, hasTensionWire, hasTensionBands, hasLoopCaps].filter(Boolean).length;
      
      if (requiredCount >= 4 && !hasForeignItems) {
        checks.materialEngines.push({
          name: "✓ Chain Link engine",
          status: 'PASS',
          message: `${requiredCount}/5 required items present, no foreign items`
        });
      } else {
        checks.materialEngines.push({
          name: "✗ Chain Link engine",
          status: 'FAIL',
          message: `Missing required items (${requiredCount}/5) or has foreign items`
        });
      }

      // Corner post double hardware check
      if (takeoff.postCounts && takeoff.postCounts.terminalSides) {
        const terminalPosts = takeoff.postCounts.terminalPosts || 0;
        const terminalSides = takeoff.postCounts.terminalSides || 0;
        if (terminalSides >= terminalPosts) {
          checks.materialEngines.push({
            name: "✓ Chain Link corner logic",
            status: 'PASS',
            message: `Terminal sides (${terminalSides}) ≥ posts (${terminalPosts}) - corners get double hardware`
          });
        } else {
          checks.materialEngines.push({
            name: "✗ Chain Link corner logic",
            status: 'FAIL',
            message: `Terminal sides (${terminalSides}) < posts (${terminalPosts}) - corner hardware missing!`
          });
        }
      }
    }

    // WOOD checks
    if (takeoff.materialType === 'Wood') {
      const hasPosts = itemNames.some(n => n.includes('post'));
      const hasRails = itemNames.some(n => n.includes('rail'));
      const hasConcrete = itemNames.some(n => n.includes('concrete'));
      const hasForeignItems = itemNames.some(n => n.includes('vinyl panel') || n.includes('aluminum panel'));

      if (hasPosts && hasRails && !hasForeignItems) {
        checks.materialEngines.push({
          name: "✓ Wood engine",
          status: 'PASS',
          message: "Posts + rails present, no foreign items"
        });
      } else {
        checks.materialEngines.push({
          name: "✗ Wood engine",
          status: 'FAIL',
          message: `Missing: ${!hasPosts ? 'posts ' : ''}${!hasRails ? 'rails ' : ''}${hasForeignItems ? '| Has foreign items' : ''}`
        });
      }

      // Concrete logic: only gate posts
      const gateCount = gates ? gates.length : 0;
      if (gateCount > 0 && !hasConcrete) {
        checks.materialEngines.push({
          name: "✗ Wood concrete logic",
          status: 'FAIL',
          message: `${gateCount} gates but no concrete - gate posts need concrete!`
        });
      } else if (gateCount === 0 && hasConcrete) {
        checks.materialEngines.push({
          name: "⚠ Wood concrete logic",
          status: 'WARN',
          message: "Concrete present but no gates - should be 0"
        });
      } else {
        checks.materialEngines.push({
          name: "✓ Wood concrete logic",
          status: 'PASS',
          message: gateCount > 0 ? `Concrete present for ${gateCount} gates` : "No gates, no concrete"
        });
      }
    }

    // ALUMINUM checks
    if (takeoff.materialType === 'Aluminum') {
      const hasAluminumPosts = itemNames.some(n => n.includes('aluminum') && n.includes('post'));
      const hasAluminumPanels = itemNames.some(n => n.includes('aluminum') && n.includes('panel'));
      const hasConcrete = itemNames.some(n => n.includes('concrete'));
      const hasForeignItems = itemNames.some(n => n.includes('vinyl panel') || n.includes('picket'));

      if (hasAluminumPosts && hasAluminumPanels && hasConcrete && !hasForeignItems) {
        checks.materialEngines.push({
          name: "✓ Aluminum engine",
          status: 'PASS',
          message: "Posts + panels + concrete present, no foreign items"
        });
      } else {
        checks.materialEngines.push({
          name: "✗ Aluminum engine",
          status: 'FAIL',
          message: `Missing: ${!hasAluminumPosts ? 'posts ' : ''}${!hasAluminumPanels ? 'panels ' : ''}${!hasConcrete ? 'concrete ' : ''}${hasForeignItems ? '| Has foreign items' : ''}`
        });
      }

      // Concrete for all posts
      if (takeoff.postCounts && takeoff.postCounts.totalPosts) {
        const concreteItem = lineItems.find(i => i.materialDescription?.toLowerCase().includes('concrete'));
        if (concreteItem && concreteItem.quantityCalculated > 0) {
          checks.materialEngines.push({
            name: "✓ Aluminum concrete logic",
            status: 'PASS',
            message: `Concrete for all ${takeoff.postCounts.totalPosts} posts`
          });
        } else {
          checks.materialEngines.push({
            name: "✗ Aluminum concrete logic",
            status: 'FAIL',
            message: "Missing concrete - all aluminum posts need concrete!"
          });
        }
      }
    }
  }

  // ============================================
  // MAP BEHAVIOR CHECKS
  // ============================================
  
  if (!rendererConfig) {
    checks.mapBehavior.push({
      name: "Renderer config",
      status: 'FAIL',
      message: "No renderer config found"
    });
  } else {
    // Check spacing matches material
    const expectedSpacing = {
      'Vinyl': 8,
      'Chain Link': 10,
      'Wood': 7.5,
      'Aluminum': 6
    };

    const expected = expectedSpacing[job.materialType];
    if (rendererConfig.spacing === expected) {
      checks.mapBehavior.push({
        name: "✓ Post spacing",
        status: 'PASS',
        message: `Spacing is ${rendererConfig.spacing}' for ${job.materialType} (correct)`
      });
    } else {
      checks.mapBehavior.push({
        name: "✗ Post spacing",
        status: 'FAIL',
        message: `Spacing is ${rendererConfig.spacing}' but should be ${expected}' for ${job.materialType}`,
        details: "Map overlay is showing wrong spacing!"
      });
    }

    // Check overlay for Chain Link
    if (job.materialType === 'Chain Link' && !spanOverlay) {
      checks.mapBehavior.push({
        name: "⚠ Chain Link overlay",
        status: 'WARN',
        message: "Chain Link selected but span overlay is OFF - should auto-enable"
      });
    } else if (job.materialType === 'Chain Link' && spanOverlay) {
      checks.mapBehavior.push({
        name: "✓ Chain Link overlay",
        status: 'PASS',
        message: "Span overlay enabled for Chain Link"
      });
    } else {
      checks.mapBehavior.push({
        name: "✓ Overlay state",
        status: 'PASS',
        message: `Overlay is ${spanOverlay ? 'ON' : 'OFF'} for ${job.materialType}`
      });
    }
  }

  // ============================================
  // SWITCHING LOGIC CHECKS
  // ============================================
  
  // Check if materialStates exists
  if (job.materialStates) {
    checks.switchingLogic.push({
      name: "✓ MaterialStates schema",
      status: 'PASS',
      message: "job.materialStates exists for reversible switching"
    });

    // Check if current material has saved state
    const currentState = job.materialStates[job.materialType];
    if (currentState && currentState.mapState) {
      checks.switchingLogic.push({
        name: "✓ Current material state",
        status: 'PASS',
        message: `${job.materialType} has saved map state`
      });
    } else {
      checks.switchingLogic.push({
        name: "⚠ Current material state",
        status: 'WARN',
        message: `${job.materialType} has no saved state yet - draw fence lines to save`
      });
    }
  } else {
    checks.switchingLogic.push({
      name: "✗ MaterialStates schema",
      status: 'FAIL',
      message: "job.materialStates missing - switching will lose data!"
    });
  }

  // Check if runs updated with job material
  const runsOutOfSync = runs.some(r => r.materialType !== job.materialType);
  if (!runsOutOfSync) {
    checks.switchingLogic.push({
      name: "✓ Runs sync",
      status: 'PASS',
      message: "All runs synced with job material type"
    });
  } else {
    checks.switchingLogic.push({
      name: "⚠ Runs sync",
      status: 'WARN',
      message: "Some runs not synced - material switch may be incomplete",
      details: `Job: ${job.materialType}, Run materials: ${[...new Set(runs.map(r => r.materialType))].join(', ')}`
    });
  }

  // ============================================
  // GATE COVERAGE CHECKS
  // ============================================
  
  if (!gates || gates.length === 0) {
    checks.gateCoverage.push({
      name: "Gate coverage",
      status: 'PASS',
      message: "No gates to check"
    });
  } else {
    const lineItems = takeoff ? takeoff.lineItems || [] : [];
    const itemNames = lineItems.map(i => i.materialDescription?.toLowerCase() || '');

    // Check gate hardware
    const hasHinges = itemNames.some(n => n.includes('hinge'));
    const hasLatches = itemNames.some(n => n.includes('latch'));
    
    if (hasHinges && hasLatches) {
      checks.gateCoverage.push({
        name: "✓ Gate hardware",
        status: 'PASS',
        message: `Hinges + latches present for ${gates.length} gates`
      });
    } else {
      checks.gateCoverage.push({
        name: "✗ Gate hardware",
        status: 'FAIL',
        message: `Missing: ${!hasHinges ? 'hinges ' : ''}${!hasLatches ? 'latches' : ''}`
      });
    }

    // Check cane bolts for double gates
    const doubleGates = gates.filter(g => g.gateType === 'Double');
    if (doubleGates.length > 0) {
      const hasCaneBolts = itemNames.some(n => n.includes('cane bolt') || n.includes('drop rod'));
      if (hasCaneBolts) {
        checks.gateCoverage.push({
          name: "✓ Double gate hardware",
          status: 'PASS',
          message: `Cane bolts present for ${doubleGates.length} double gates`
        });
      } else {
        checks.gateCoverage.push({
          name: "✗ Double gate hardware",
          status: 'FAIL',
          message: `${doubleGates.length} double gates but no cane bolts!`
        });
      }
    }
  }

  // ============================================
  // SUMMARY
  // ============================================
  
  const allChecks = [
    ...checks.coreArchitecture,
    ...checks.materialEngines,
    ...checks.mapBehavior,
    ...checks.switchingLogic,
    ...checks.gateCoverage
  ];

  const passCount = allChecks.filter(c => c.status === 'PASS').length;
  const failCount = allChecks.filter(c => c.status === 'FAIL').length;
  const warnCount = allChecks.filter(c => c.status === 'WARN').length;

  let health = 'CRITICAL';
  let message = 'Multiple critical failures detected';

  if (failCount === 0 && warnCount === 0) {
    health = 'EXCELLENT';
    message = 'All systems operational';
  } else if (failCount === 0 && warnCount <= 2) {
    health = 'GOOD';
    message = 'Minor warnings present';
  } else if (failCount <= 2) {
    health = 'DEGRADED';
    message = 'Some systems need attention';
  }

  return {
    ...checks,
    summary: {
      health,
      message,
      passCount,
      failCount,
      warnCount
    }
  };
}