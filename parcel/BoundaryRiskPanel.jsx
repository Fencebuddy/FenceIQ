import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Info, Settings } from "lucide-react";

const PRESETS = [
  { value: 'STANDARD', label: 'Standard (2ft/1ft)', description: 'Near: 2ft, High Risk: 1ft' },
  { value: 'CONSERVATIVE', label: 'Conservative (3ft/1.5ft)', description: 'Near: 3ft, High Risk: 1.5ft' },
  { value: 'CUSTOM', label: 'Custom', description: 'Set your own thresholds' }
];

export default function BoundaryRiskPanel({ 
  job,
  onPresetChange,
  onThresholdChange,
  onToggleOverlay
}) {
  const preset = job.boundary_risk_preset || 'STANDARD';
  const showOverlay = job.show_boundary_risk_overlay || false;
  const nearFt = job.boundary_near_ft || 2;
  const rowRiskFt = job.boundary_row_risk_ft || 1;

  return (
    <Card>
      <CardHeader className="border-b bg-slate-50 py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Boundary Risk Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <Alert className="border-blue-500 bg-blue-50">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-xs">
            <strong>Disclaimer:</strong> Boundary risk guidance is based on GIS parcel approximations and proximity thresholds. 
            Verify property boundaries and ROW/easements before installation.
          </AlertDescription>
        </Alert>

        {/* Preset Selector */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Risk Threshold Preset</Label>
          <Select value={preset} onValueChange={onPresetChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map(p => (
                <SelectItem key={p.value} value={p.value}>
                  <div>
                    <div className="font-medium">{p.label}</div>
                    <div className="text-xs text-slate-500">{p.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom Thresholds */}
        {preset === 'CUSTOM' && (
          <div className="space-y-3 p-3 bg-slate-50 rounded">
            <div>
              <Label className="text-xs">Near Boundary (ft)</Label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={nearFt}
                onChange={(e) => onThresholdChange('near', parseFloat(e.target.value))}
                className="w-full h-8 px-2 border rounded text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">High ROW Risk (ft)</Label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={rowRiskFt}
                onChange={(e) => onThresholdChange('rowRisk', parseFloat(e.target.value))}
                className="w-full h-8 px-2 border rounded text-sm mt-1"
              />
            </div>
            <p className="text-xs text-slate-500">ROW risk must be ≤ near boundary</p>
          </div>
        )}

        {/* Current Thresholds Display */}
        <div className="p-3 bg-slate-50 rounded space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">Near Boundary:</span>
            <Badge variant="outline" className="bg-amber-50 text-amber-700">≤ {nearFt} ft</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">High ROW Risk:</span>
            <Badge variant="outline" className="bg-red-50 text-red-700">≤ {rowRiskFt} ft</Badge>
          </div>
        </div>

        {/* Show Risk Overlay Toggle */}
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
          <Label htmlFor="risk-overlay" className="text-xs font-medium cursor-pointer">
            Show Boundary Risk Zone
          </Label>
          <Switch
            id="risk-overlay"
            checked={showOverlay}
            onCheckedChange={onToggleOverlay}
          />
        </div>
      </CardContent>
    </Card>
  );
}