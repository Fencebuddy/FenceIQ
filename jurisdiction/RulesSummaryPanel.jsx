import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, CheckCircle } from "lucide-react";

export default function RulesSummaryPanel({ 
  mergedRules, 
  alerts, 
  disclaimer, 
  showPoolBarrier = false,
  showCornerLotAlert = false,
  showSidewalkAlert = false,
  showIntersectionAlert = false,
  unknownJurisdiction = false
}) {
  if (!mergedRules || !mergedRules.rules) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Jurisdiction Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Select a jurisdiction to view rules</p>
        </CardContent>
      </Card>
    );
  }

  const rules = mergedRules.rules;

  // Determine which alerts to show
  const activeAlerts = [];
  if (showCornerLotAlert && alerts.corner_lot) {
    activeAlerts.push({ type: 'warning', message: alerts.corner_lot });
  }
  if (showPoolBarrier && alerts.pool_detected) {
    activeAlerts.push({ type: 'info', message: alerts.pool_detected });
  }
  if (showSidewalkAlert && alerts.sidewalk_detected) {
    activeAlerts.push({ type: 'warning', message: alerts.sidewalk_detected });
  }
  if (showIntersectionAlert && alerts.intersection_detected) {
    activeAlerts.push({ type: 'warning', message: alerts.intersection_detected });
  }
  if (unknownJurisdiction && alerts.unknown_jurisdiction) {
    activeAlerts.push({ type: 'error', message: alerts.unknown_jurisdiction });
  }

  return (
    <Card>
      <CardHeader className="border-b bg-slate-50">
        <CardTitle className="text-sm flex items-center gap-2">
          <Info className="w-4 h-4" />
          Jurisdiction Rules Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <div className="space-y-2">
            {activeAlerts.map((alert, idx) => (
              <Alert 
                key={idx} 
                className={
                  alert.type === 'error' ? 'border-red-500 bg-red-50' :
                  alert.type === 'warning' ? 'border-amber-500 bg-amber-50' :
                  'border-blue-500 bg-blue-50'
                }
              >
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-sm">{alert.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Permits */}
        {rules.permit && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-slate-700">Permits</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-500">Building:</span>
                <Badge className="ml-2" variant={rules.permit.building_required ? 'default' : 'outline'}>
                  {rules.permit.building_required ? 'Required' : 'Not Required'}
                </Badge>
              </div>
              <div>
                <span className="text-slate-500">Zoning:</span>
                <Badge className="ml-2" variant={
                  rules.permit.zoning_required === true ? 'default' :
                  rules.permit.zoning_required === 'CHECK_LOCAL' ? 'secondary' :
                  'outline'
                }>
                  {rules.permit.zoning_required === true ? 'Required' :
                   rules.permit.zoning_required === 'CHECK_LOCAL' ? 'Check Local' :
                   'Not Required'}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Height Limits */}
        {rules.height_limits && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-slate-700">Height Limits</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Front Yard:</span>
                <span className="font-medium">{rules.height_limits.front_yard_ft} ft</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Side Yard:</span>
                <span className="font-medium">{rules.height_limits.side_yard_ft} ft</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rear Yard:</span>
                <span className="font-medium">{rules.height_limits.rear_yard_ft} ft</span>
              </div>
              {rules.height_limits.corner_lot_street_side_ft && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Corner Street-Side:</span>
                  <span className="font-medium">{rules.height_limits.corner_lot_street_side_ft} ft</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visibility Triangle */}
        {rules.visibility_triangle && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-slate-700">Visibility Triangle</h3>
            <p className="text-sm text-slate-600">
              Max height: <span className="font-medium">{rules.visibility_triangle.max_height_inches}"</span>
              {rules.visibility_triangle.applies_to && (
                <span className="text-slate-500 text-xs block mt-1">
                  Applies to: {rules.visibility_triangle.applies_to.join(', ')}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Right of Way */}
        {rules.right_of_way && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-slate-700">Right of Way (ROW)</h3>
            <p className="text-sm text-slate-600">
              {rules.right_of_way.note || 'Fence must be inside property line and outside road ROW/sidewalk ROW'}
            </p>
          </div>
        )}

        {/* Pool Barrier (conditional) */}
        {showPoolBarrier && rules.pool_barrier && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              Pool Barrier Requirements
            </h3>
            <div className="text-sm text-slate-600 space-y-1">
              <p>• Min height: <span className="font-medium">{rules.pool_barrier.min_height_inches}"</span></p>
              {rules.pool_barrier.gate && (
                <>
                  <p>• Self-closing gate: <span className="font-medium">{rules.pool_barrier.gate.self_closing ? 'Required' : 'Not Required'}</span></p>
                  <p>• Self-latching: <span className="font-medium">{rules.pool_barrier.gate.self_latching ? 'Required' : 'Not Required'}</span></p>
                  {rules.pool_barrier.gate.latch_location && (
                    <p>• Latch location: <span className="font-medium">{rules.pool_barrier.gate.latch_location}</span></p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        {disclaimer && (
          <div className="pt-3 border-t">
            <p className="text-xs text-slate-500 italic">{disclaimer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}