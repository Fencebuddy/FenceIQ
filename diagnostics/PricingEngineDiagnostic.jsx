import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, XCircle, Search } from "lucide-react";
import { useTakeoffStore } from "../stores/useTakeoffStore";

export default function PricingEngineDiagnostic({ jobId }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const { getTakeoff } = useTakeoffStore();

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const report = {
        timestamp: new Date().toISOString(),
        issues: [],
        warnings: [],
        info: [],
        data: {}
      };

      // 1. Fetch job
      const jobs = await base44.entities.Job.filter({ id: jobId });
      const job = jobs[0];
      report.data.job = {
        id: job.id,
        jobNumber: job.jobNumber,
        materialType: job.materialType,
        fenceHeight: job.fenceHeight,
        totalLF: job.totalLF,
        selectedScenarioTier: job.selectedScenarioTier,
        active_takeoff_snapshot_id: job.active_takeoff_snapshot_id,
        active_pricing_snapshot_id: job.active_pricing_snapshot_id
      };

      if (!job.active_takeoff_snapshot_id) {
        report.issues.push("No active takeoff snapshot - pricing cannot be calculated");
      }

      // 2. Fetch takeoff - PRIORITY ORDER: Store > LocalStorage > Snapshot
      let takeoffSource = 'NONE';
      let takeoffData = null;
      
      // Try live store first
      const stored = getTakeoff(jobId);
      if (stored && stored.lineItems?.length > 0) {
        takeoffSource = 'LIVE_STORE';
        takeoffData = {
          line_items_count: stored.lineItems.length,
          total_lf: stored.total_lf,
          source: stored.source,
          lastComputedAt: stored.lastComputedAt
        };
        report.info.push(`⚡ Live takeoff from STORE: ${stored.lineItems.length} line items`);
      } else {
        // Try localStorage
        try {
          const localKey = `takeoff_live_${jobId}`;
          const localData = localStorage.getItem(localKey);
          if (localData) {
            const parsed = JSON.parse(localData);
            if (parsed.lineItems?.length > 0) {
              takeoffSource = 'LOCALSTORAGE';
              takeoffData = {
                line_items_count: parsed.lineItems.length,
                total_lf: parsed.total_lf,
                source: parsed.source,
                lastComputedAt: parsed.lastComputedAt
              };
              report.info.push(`💾 Takeoff from LOCALSTORAGE: ${parsed.lineItems.length} line items`);
            }
          }
        } catch (e) {
          console.warn('[Diagnostic] localStorage parse error:', e);
        }
        
        // Fallback to snapshot
        if (!takeoffData && job.active_takeoff_snapshot_id) {
          const takeoffSnap = await base44.entities.TakeoffSnapshot.filter({ id: job.active_takeoff_snapshot_id });
          if (takeoffSnap[0]) {
            takeoffSource = 'SNAPSHOT';
            takeoffData = {
              id: takeoffSnap[0].id,
              total_lf: takeoffSnap[0].total_lf,
              line_items_count: takeoffSnap[0].line_items?.length || 0,
              source: takeoffSnap[0].source,
              status: takeoffSnap[0].status
            };
            report.info.push(`📸 Takeoff from SNAPSHOT: ${takeoffSnap[0].line_items?.length || 0} line items`);
          } else {
            report.issues.push("Takeoff snapshot ID exists but record not found");
          }
        }
      }
      
      if (!takeoffData) {
        report.issues.push("No takeoff data found in store, localStorage, or snapshot");
      }
      
      report.data.takeoff = takeoffData;
      report.data.takeoff_source = takeoffSource;

      // 3. Fetch pricing scenarios
      const scenarios = await base44.entities.JobCostSnapshot.filter({
        jobId,
        takeoff_snapshot_id: job.active_takeoff_snapshot_id
      });

      report.data.scenarios = scenarios.map(s => ({
        tier: s.scenario_tier,
        status: s.status,
        resolver_version: s.resolver_version,
        material_cost: s.material_cost,
        sell_price: s.sell_price,
        materials_count: s.materials_resolved?.length || 0,
        unresolved_count: s.unresolved_items?.length || 0
      }));

      if (scenarios.length === 0) {
        report.issues.push("No pricing scenarios generated");
      } else {
        report.info.push(`Found ${scenarios.length} pricing scenarios`);
        
        // Check for consistent resolver versions
        const versions = [...new Set(scenarios.map(s => s.resolver_version))];
        if (versions.length > 1) {
          report.warnings.push(`Multiple resolver versions detected: ${versions.join(', ')}`);
        }
        
        // Check for incomplete scenarios
        const incomplete = scenarios.filter(s => s.status === 'incomplete');
        if (incomplete.length > 0) {
          report.warnings.push(`${incomplete.length} scenario(s) are incomplete`);
        }
      }

      // 4. Analyze BETTER tier scenario for black vinyl
      const betterScenario = scenarios.find(s => s.scenario_tier === 'BETTER');
      if (betterScenario && job.materialType === 'Chain Link') {
        report.data.better_tier_analysis = {
          coating: betterScenario.scenario_config?.coating,
          materials_sample: betterScenario.materials_resolved?.slice(0, 5).map(m => ({
            canonical_key: m.canonical_key,
            lineItemName: m.lineItemName,
            catalog_name: m.catalogItem?.crm_name
          }))
        };

        if (betterScenario.scenario_config?.coating === 'black_vinyl') {
          report.info.push("BETTER tier correctly configured for black vinyl coating");
        } else {
          report.issues.push(`BETTER tier coating is "${betterScenario.scenario_config?.coating}" (expected "black_vinyl")`);
        }

        // Check if canonical keys contain black_vinyl
        const blackVinylKeys = betterScenario.materials_resolved?.filter(m => 
          m.canonical_key?.includes('black_vinyl')
        ).length || 0;
        
        if (blackVinylKeys > 0) {
          report.info.push(`${blackVinylKeys} items have black_vinyl in canonical key`);
        } else {
          report.warnings.push("No black_vinyl canonical keys found in BETTER tier materials");
        }
      }

      // 5. Fetch catalog
      const catalog = await base44.entities.MaterialCatalog.list('-last_updated', 500);
      report.data.catalog_count = catalog.length;
      report.info.push(`Catalog contains ${catalog.length} items`);

      // Check for black vinyl catalog items
      const blackVinylCatalog = catalog.filter(c => 
        c.crm_name?.toLowerCase().includes('black vinyl') ||
        c.finish === 'black_vinyl'
      );
      report.data.black_vinyl_catalog_count = blackVinylCatalog.length;
      
      if (blackVinylCatalog.length === 0) {
        report.warnings.push("No black vinyl items found in catalog");
      } else {
        report.info.push(`${blackVinylCatalog.length} black vinyl items in catalog`);
      }

      // 6. Fetch catalog link map
      const linkMap = await base44.entities.CatalogLinkMap.list();
      report.data.link_map_count = linkMap.length;
      report.info.push(`${linkMap.length} catalog links defined`);

      setResults(report);
    } catch (error) {
      setResults({
        timestamp: new Date().toISOString(),
        issues: [`Error running diagnostic: ${error.message}`],
        warnings: [],
        info: [],
        data: {}
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Pricing Engine Diagnostic
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runDiagnostic} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Run Diagnostic
            </>
          )}
        </Button>

        {results && (
          <div className="space-y-4">
            {/* Issues */}
            {results.issues.length > 0 && (
              <Alert className="border-red-500 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                  <div className="font-semibold text-red-900 mb-2">Issues Found ({results.issues.length})</div>
                  <ul className="space-y-1 text-sm text-red-800">
                    {results.issues.map((issue, i) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {results.warnings.length > 0 && (
              <Alert className="border-amber-500 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription>
                  <div className="font-semibold text-amber-900 mb-2">Warnings ({results.warnings.length})</div>
                  <ul className="space-y-1 text-sm text-amber-800">
                    {results.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Info */}
            {results.info.length > 0 && (
              <Alert className="border-emerald-500 bg-emerald-50">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <AlertDescription>
                  <div className="font-semibold text-emerald-900 mb-2">Status ({results.info.length})</div>
                  <ul className="space-y-1 text-sm text-emerald-800">
                    {results.info.map((info, i) => (
                      <li key={i}>• {info}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Data Details */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="font-semibold text-sm">Detailed Data</div>
              
              {results.data.job && (
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Job</div>
                  <div className="text-xs space-y-1">
                    <div>Material: {results.data.job.materialType}</div>
                    <div>Height: {results.data.job.fenceHeight}</div>
                    <div>Total LF: {results.data.job.totalLF}</div>
                    <div>Selected Tier: {results.data.job.selectedScenarioTier || 'None'}</div>
                    {results.data.takeoff_source && (
                      <div className="mt-2">
                        <Badge variant={
                          results.data.takeoff_source === 'LIVE_STORE' ? 'default' :
                          results.data.takeoff_source === 'LOCALSTORAGE' ? 'secondary' :
                          'outline'
                        }>
                          {results.data.takeoff_source === 'LIVE_STORE' ? '⚡ Live Store' :
                           results.data.takeoff_source === 'LOCALSTORAGE' ? '💾 Cached' :
                           results.data.takeoff_source === 'SNAPSHOT' ? '📸 Snapshot' : 'None'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {results.data.scenarios && results.data.scenarios.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Scenarios</div>
                  {results.data.scenarios.map((s, i) => (
                    <div key={i} className="text-xs border-l-2 pl-2 mb-2">
                      <div className="font-medium">{s.tier}</div>
                      <div>Status: {s.status}</div>
                      <div>Version: {s.resolver_version || 'N/A'}</div>
                      <div>Materials: {s.materials_count}</div>
                      <div>Unresolved: {s.unresolved_count}</div>
                      <div>Sell Price: ${s.sell_price?.toFixed(2) || '0.00'}</div>
                    </div>
                  ))}
                </div>
              )}

              {results.data.better_tier_analysis && (
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">BETTER Tier Analysis</div>
                  <div className="text-xs space-y-1">
                    <div>Coating: <Badge variant="outline">{results.data.better_tier_analysis.coating}</Badge></div>
                    {results.data.better_tier_analysis.materials_sample && (
                      <div className="mt-2">
                        <div className="font-medium mb-1">Sample Materials:</div>
                        {results.data.better_tier_analysis.materials_sample.map((m, i) => (
                          <div key={i} className="pl-2 border-l">
                            <div className="font-mono text-xs text-slate-600">{m.canonical_key}</div>
                            <div className="text-xs">{m.catalog_name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-500 pt-2 border-t">
                Diagnostic run at: {new Date(results.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}