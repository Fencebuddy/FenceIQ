/**
 * DELETE DIAGNOSTICS PANEL
 * Proves why delete_entities returns deleted_count: 0
 * Tests filters, field names, and soft delete support
 */

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, Copy, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cleanupJobData } from './SoftDeleteCleanup';

export default function DeleteDiagnosticsPanel({ jobId, gates, materials, currentMaterialType, isOpen, setIsOpen, onCleanupComplete }) {
  const [report, setReport] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const diagnostics = {
      timestamp: new Date().toISOString(),
      jobId,
      tests: []
    };

    try {
      // TEST 1: Gate field name consistency
      const gateTest = {
        entity: 'Gate',
        testType: 'FIELD_NAME_MATCH',
        filter: { jobId },
        results: {}
      };

      try {
        const gatesFound = await base44.entities.Gate.filter({ jobId });
        gateTest.results.matchCount = gatesFound.length;
        gateTest.results.sampleIds = gatesFound.slice(0, 3).map(g => g.id);
        gateTest.results.status = 'SUCCESS';
      } catch (error) {
        gateTest.results.status = 'ERROR';
        gateTest.results.error = error.message;
      }

      diagnostics.tests.push(gateTest);

      // TEST 2: Orphaned gates by runId validation
      const orphanTest = {
        entity: 'Gate',
        testType: 'ORPHAN_DETECTION',
        results: {}
      };

      const allGates = gates || [];
      const runsById = new Map();
      try {
        const runs = await base44.entities.Run.filter({ jobId });
        runs.forEach(r => runsById.set(r.id, r));
      } catch (error) {
        orphanTest.results.error = error.message;
      }

      const orphanedGates = allGates.filter(g => !g.runId || !runsById.has(g.runId));
      orphanTest.results.totalGates = allGates.length;
      orphanTest.results.orphanedCount = orphanedGates.length;
      orphanTest.results.orphanedIds = orphanedGates.map(g => ({
        id: g.id,
        runId: g.runId,
        reason: !g.runId ? 'MISSING_RUNID' : 'INVALID_RUNID'
      }));

      diagnostics.tests.push(orphanTest);

      // TEST 3: Material contamination detection
      const materialTest = {
        entity: 'MaterialLine',
        testType: 'CONTAMINATION_DETECTION',
        results: {}
      };

      const forbiddenTerms = {
        'Chain Link': ['vinyl panel', 'donut', '5x5 vinyl', 'vinyl post cap'],
        'Vinyl': ['chain link fabric', 'tension band', 'brace band', 'terminal post'],
        'Wood': ['vinyl panel', 'chain link fabric', 'aluminum panel', 'donut'],
        'Aluminum': ['vinyl panel', 'chain link fabric', 'donut', 'wood post']
      };

      const allMaterials = materials || [];
      const contaminated = [];

      // Get job material type
      try {
        const job = await base44.entities.Job.filter({ id: jobId }).then(jobs => jobs[0]);
        const jobMaterial = job?.materialType;
        const forbidden = forbiddenTerms[jobMaterial] || [];

        allMaterials.forEach(mat => {
          const itemName = (mat.lineItemName || '').toLowerCase();
          for (const term of forbidden) {
            if (itemName.includes(term.toLowerCase())) {
              contaminated.push({
                id: mat.id,
                name: mat.lineItemName,
                forbiddenTerm: term
              });
              break;
            }
          }
        });

        materialTest.results.totalMaterials = allMaterials.length;
        materialTest.results.contaminatedCount = contaminated.length;
        materialTest.results.contaminated = contaminated;
        materialTest.results.jobMaterialType = jobMaterial;
      } catch (error) {
        materialTest.results.error = error.message;
      }

      diagnostics.tests.push(materialTest);

      // TEST 4: Soft delete field detection
      const softDeleteTest = {
        testType: 'SOFT_DELETE_DETECTION',
        results: {}
      };

      if (allGates.length > 0) {
        const sampleGate = allGates[0];
        const softDeleteFields = ['deleted', 'isDeleted', 'deletedAt', 'is_deleted', 'archivedAt'];
        softDeleteTest.results.gateFields = Object.keys(sampleGate);
        softDeleteTest.results.hasSoftDelete = softDeleteFields.some(f => f in sampleGate);
        softDeleteTest.results.detectedFields = softDeleteFields.filter(f => f in sampleGate);
      }

      if (allMaterials.length > 0) {
        const sampleMaterial = allMaterials[0];
        const softDeleteFields = ['deleted', 'isDeleted', 'deletedAt', 'is_deleted', 'archivedAt'];
        softDeleteTest.results.materialFields = Object.keys(sampleMaterial);
        softDeleteTest.results.hasSoftDeleteMaterial = softDeleteFields.some(f => f in sampleMaterial);
        softDeleteTest.results.detectedFieldsMaterial = softDeleteFields.filter(f => f in sampleMaterial);
      }

      diagnostics.tests.push(softDeleteTest);

      // Analysis and recommendations
      diagnostics.analysis = {
        likelyRootCause: '',
        recommendations: []
      };

      const orphanCount = orphanTest.results.orphanedCount || 0;
      const contaminatedCount = materialTest.results.contaminatedCount || 0;

      if (orphanCount > 0) {
        diagnostics.analysis.likelyRootCause = 'Orphaned gates with invalid runIds are not being deleted by delete_entities. Possible causes: wrong field name in filter, soft delete interference, or RLS policy blocking deletes.';
        diagnostics.analysis.recommendations.push('Use canonical filtering to exclude orphaned gates from takeoff calculations');
        diagnostics.analysis.recommendations.push('Implement soft delete via UPDATE instead of DELETE if soft delete fields exist');
      }

      if (contaminatedCount > 0) {
        diagnostics.analysis.likelyRootCause += ' Contaminated materials from previous material type switches remain in database.';
        diagnostics.analysis.recommendations.push('Stop persisting MaterialLine entities, use takeoff.lineItems as source of truth');
        diagnostics.analysis.recommendations.push('Implement material scoping filter before any PO generation');
      }

      setReport(diagnostics);
    } catch (error) {
      diagnostics.error = error.message;
      setReport(diagnostics);
    }

    setIsRunning(false);
  };

  const copyReport = () => {
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runCleanup = async () => {
    setIsCleaning(true);
    try {
      const result = await cleanupJobData(jobId, currentMaterialType);
      setCleanupResult(result);
      
      // Trigger parent refresh
      if (onCleanupComplete) {
        onCleanupComplete();
      }
    } catch (error) {
      setCleanupResult({ error: error.message });
    }
    setIsCleaning(false);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-red-500">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-slate-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Delete Diagnostics (deleted_count=0 Debug)
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    runDiagnostics();
                  }}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Run Diagnostics
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    runCleanup();
                  }}
                  disabled={isCleaning}
                >
                  {isCleaning ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Soft Delete Cleanup
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {!report && (
              <div className="text-center py-8 text-slate-500">
                <p>Click "Run Diagnostics" to analyze why delete operations return 0</p>
              </div>
            )}

            {report && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Badge variant="outline">
                    Report generated: {new Date(report.timestamp).toLocaleTimeString()}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={copyReport}>
                    {copied ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? 'Copied!' : 'Copy Report'}
                  </Button>
                </div>

                {report.tests.map((test, idx) => (
                  <Card key={idx} className="bg-slate-50">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">{test.testType}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <pre className="bg-white p-3 rounded border overflow-auto max-h-60">
                        {JSON.stringify(test.results, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                ))}

                {report.analysis && (
                  <Card className="bg-red-50 border-red-500">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm text-red-900">Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <p className="font-semibold text-red-900">Likely Root Cause:</p>
                        <p className="text-red-800">{report.analysis.likelyRootCause}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-red-900">Recommendations:</p>
                        <ul className="list-disc list-inside space-y-1 text-red-800">
                          {report.analysis.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {cleanupResult && (
                  <Card className="bg-green-50 border-green-500">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm text-green-900">Cleanup Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {cleanupResult.error ? (
                        <p className="text-red-800">Error: {cleanupResult.error}</p>
                      ) : (
                        <>
                          <div>
                            <p className="font-semibold text-green-900">Gates:</p>
                            <p className="text-green-800">
                              {cleanupResult.gates.orphaned.length} orphaned gates found, {cleanupResult.gates.updated} marked as EXCLUDED
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-green-900">Materials:</p>
                            <p className="text-green-800">
                              {cleanupResult.materials.contaminated.length} contaminated materials found, {cleanupResult.materials.updated} marked as EXCLUDED
                            </p>
                          </div>
                          <Badge className="bg-green-600 text-white">
                            ✓ Cleanup complete - refresh page to see changes
                          </Badge>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}