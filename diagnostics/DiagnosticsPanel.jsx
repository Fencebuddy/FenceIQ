import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, XCircle, Play, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * DIAGNOSTICS PANEL
 * Dev-only panel for debugging material switching
 */
export default function DiagnosticsPanel({ job, runs, gates, takeoff, materials, onRunTests }) {
  const [qaChecklistOpen, setQaChecklistOpen] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Validate takeoff consistency
  const validation = useMemo(() => {
    return validateTakeoff(takeoff, job, runs, gates);
  }, [takeoff, job, runs, gates]);

  // Run automated tests
  const handleRunTests = async () => {
    setIsRunningTests(true);
    const results = await onRunTests();
    setTestResults(results);
    setIsRunningTests(false);
  };

  if (!job) return null;

  return (
    <Card className="border-purple-300 bg-purple-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 text-purple-900">
          🔧 Diagnostics Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* State Summary */}
        <div className="bg-white rounded p-3 space-y-2 text-xs">
          <div className="font-semibold text-purple-900 mb-2">State Summary</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500">Job Material:</span>
              <span className="ml-2 font-medium">{job.materialType}</span>
            </div>
            <div>
              <span className="text-slate-500">Runs Count:</span>
              <span className="ml-2 font-medium">{runs.length}</span>
            </div>
            <div>
              <span className="text-slate-500">Gates Count:</span>
              <span className="ml-2 font-medium">{gates.length}</span>
            </div>
            <div>
              <span className="text-slate-500">Materials Count:</span>
              <span className="ml-2 font-medium">{materials.length}</span>
            </div>
          </div>

          {/* Runs Detail Table */}
          {runs.length > 0 && (
            <div className="mt-3 border-t pt-2">
              <div className="font-semibold text-slate-700 mb-1">Runs Detail</div>
              <div className="space-y-1">
                {runs.map(run => (
                  <div key={run.id} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 truncate w-24">{run.runLabel}</span>
                    <Badge className="bg-slate-100 text-slate-700 text-[10px]">{run.materialType}</Badge>
                    <span className="text-slate-600">{run.lengthLF} LF</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Takeoff Metrics */}
        {takeoff && (
          <div className="bg-white rounded p-3 space-y-2 text-xs">
            <div className="font-semibold text-purple-900 mb-2">Active Takeoff</div>
            <div>
              <span className="text-slate-500">Takeoff Material:</span>
              <Badge className="ml-2 bg-purple-100 text-purple-700 text-[10px]">{takeoff.materialType}</Badge>
            </div>
            
            {/* Material-specific metrics */}
            {takeoff.materialType === 'Vinyl' && takeoff.postCounts && (
              <div className="mt-2 space-y-1">
                <div className="font-medium text-slate-700">Vinyl Metrics:</div>
                <div>End Posts: {takeoff.postCounts.endPosts}</div>
                <div>Corner Posts: {takeoff.postCounts.cornerPosts}</div>
                <div>Gate Posts: {takeoff.postCounts.gatePosts}</div>
                <div>Line Posts: {takeoff.postCounts.linePosts}</div>
                <div className="font-semibold">Total Posts: {takeoff.postCounts.totalVinylPosts}</div>
              </div>
            )}

            {takeoff.materialType === 'Chain Link' && takeoff.postCounts && (
              <div className="mt-2 space-y-1">
                <div className="font-medium text-slate-700">Chain Link Metrics:</div>
                <div>Terminal Posts: {takeoff.postCounts.terminalPosts}</div>
                <div>Line Posts: {takeoff.postCounts.linePosts}</div>
                <div className="font-semibold">Total Posts: {takeoff.postCounts.totalChainLinkPosts}</div>
                <div>Terminal Sides: {takeoff.postCounts.terminalSides}</div>
              </div>
            )}

            {(takeoff.materialType === 'Wood' || takeoff.materialType === 'Aluminum') && takeoff.postCounts && (
              <div className="mt-2 space-y-1">
                <div className="font-medium text-slate-700">{takeoff.materialType} Metrics:</div>
                <div>Terminal Posts: {takeoff.postCounts.terminalPosts}</div>
                <div>Line Posts: {takeoff.postCounts.linePosts}</div>
                <div>Gate Posts: {takeoff.postCounts.gatePosts}</div>
                <div className="font-semibold">Total Posts: {takeoff.postCounts.totalPosts}</div>
              </div>
            )}

            {/* Line Items */}
            <div className="mt-2 border-t pt-2">
              <div className="font-medium text-slate-700 mb-1">Line Items ({takeoff.lineItems?.length || 0})</div>
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {(takeoff.lineItems || []).slice(0, 10).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-slate-600 truncate flex-1">{item.materialDescription}</span>
                    <span className="text-slate-900 font-medium ml-2">{item.quantityCalculated} {item.uom}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Validation Results */}
        {validation && validation.errors.length > 0 && (
          <Alert className="border-red-500 bg-red-50">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-xs text-red-800">
              <div className="font-semibold mb-1">Takeoff Validation Failed:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {validation.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {validation && validation.errors.length === 0 && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-xs text-green-800">
              ✓ Takeoff validation passed
            </AlertDescription>
          </Alert>
        )}

        {/* Automated Tests */}
        <div className="bg-white rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm text-purple-900">Automated Tests</div>
            <Button 
              size="sm" 
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="bg-purple-600 hover:bg-purple-700 h-7"
            >
              {isRunningTests ? (
                <>Running...</>
              ) : (
                <>
                  <Play className="w-3 h-3 mr-1" />
                  Run Tests
                </>
              )}
            </Button>
          </div>

          {testResults && (
            <div className="space-y-1 text-xs">
              {testResults.map((result, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {result.passed ? (
                    <CheckCircle className="w-3 h-3 text-green-600" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-600" />
                  )}
                  <span className={result.passed ? 'text-green-700' : 'text-red-700'}>
                    {result.name}: {result.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QA Checklist */}
        <Collapsible open={qaChecklistOpen} onOpenChange={setQaChecklistOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span className="text-xs font-medium">Manual QA Checklist</span>
              {qaChecklistOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-white rounded p-3 mt-2 text-xs space-y-2">
              <div className="font-semibold text-slate-700">Manual Test Steps:</div>
              <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                <li>Start in Vinyl → verify vinyl audit + materials list</li>
                <li>Switch to Chain Link → verify chain link audit + materials</li>
                <li>Switch back to Vinyl → verify vinyl audit restored</li>
                <li>Switch to Wood → verify gate posts have concrete only</li>
                <li>Switch to Aluminum → verify all posts have concrete</li>
                <li>Save job → reload page → verify material persists</li>
                <li>Check all runs show correct materialType in Details tab</li>
                <li>Verify no cross-material items (vinyl in chain link, etc.)</li>
              </ol>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

/**
 * TAKEOFF VALIDATION LOGIC
 */
function validateTakeoff(takeoff, job, runs, gates) {
  const errors = [];

  if (!takeoff) {
    errors.push("No takeoff computed");
    return { valid: false, errors };
  }

  // Rule 1: Takeoff material must match job material
  if (takeoff.materialType !== job.materialType) {
    errors.push(`MISMATCH: takeoff.materialType (${takeoff.materialType}) ≠ job.materialType (${job.materialType})`);
  }

  const lineItems = takeoff.lineItems || [];
  const itemNames = lineItems.map(i => i.materialDescription?.toLowerCase() || '');

  // Rule 2: No foreign SKUs
  if (takeoff.materialType === 'Chain Link') {
    if (itemNames.some(n => n.includes('vinyl panel') || n.includes('vinyl post'))) {
      errors.push("Chain Link takeoff contains VINYL items");
    }
    if (itemNames.some(n => n.includes('picket') || n.includes('wood'))) {
      errors.push("Chain Link takeoff contains WOOD items");
    }
  }

  if (takeoff.materialType === 'Vinyl') {
    if (itemNames.some(n => n.includes('tension band') || n.includes('rail end') || n.includes('wire roll'))) {
      errors.push("Vinyl takeoff contains CHAIN LINK items");
    }
    if (itemNames.some(n => n.includes('picket') || n.includes('wood'))) {
      errors.push("Vinyl takeoff contains WOOD items");
    }
  }

  if (takeoff.materialType === 'Wood') {
    if (itemNames.some(n => n.includes('vinyl panel') || n.includes('vinyl post'))) {
      errors.push("Wood takeoff contains VINYL items");
    }
    if (itemNames.some(n => n.includes('aluminum panel') || n.includes('aluminum post'))) {
      errors.push("Wood takeoff contains ALUMINUM items");
    }
  }

  if (takeoff.materialType === 'Aluminum') {
    if (itemNames.some(n => n.includes('picket') || n.includes('rail'))) {
      errors.push("Aluminum takeoff contains WOOD items");
    }
    if (itemNames.some(n => n.includes('vinyl panel'))) {
      errors.push("Aluminum takeoff contains VINYL items");
    }
  }

  // Rule 3: Required items check
  if (takeoff.materialType === 'Chain Link') {
    const required = ['fabric', 'top rail', 'tension wire', 'tension band', 'loop cap'];
    required.forEach(req => {
      if (!itemNames.some(n => n.includes(req))) {
        errors.push(`Chain Link missing: ${req}`);
      }
    });
  }

  if (takeoff.materialType === 'Vinyl') {
    const required = ['vinyl post', 'vinyl panel'];
    required.forEach(req => {
      if (!itemNames.some(n => n.includes(req))) {
        errors.push(`Vinyl missing: ${req}`);
      }
    });
  }

  if (takeoff.materialType === 'Wood') {
    const required = ['post', 'rail'];
    required.forEach(req => {
      if (!itemNames.some(n => n.includes(req))) {
        errors.push(`Wood missing: ${req}`);
      }
    });
  }

  if (takeoff.materialType === 'Aluminum') {
    const required = ['aluminum post', 'aluminum panel', 'concrete'];
    required.forEach(req => {
      if (!itemNames.some(n => n.includes(req))) {
        errors.push(`Aluminum missing: ${req}`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}