import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";

export default function YardZoneSelector({ 
  run, 
  isCornerLot,
  complianceStatus,
  maxAllowedFt,
  messages = [],
  onZoneChange,
  onHeightChange
}) {
  const yardZones = [
    { value: 'UNKNOWN', label: 'Not Set' },
    { value: 'FRONT', label: 'Front Yard' },
    { value: 'SIDE', label: 'Side Yard' },
    { value: 'REAR', label: 'Rear Yard' }
  ];

  // Add STREET_SIDE only for corner lots
  if (isCornerLot) {
    yardZones.push({ value: 'STREET_SIDE', label: 'Street Side (Corner)' });
  }

  const heightOptions = [3, 4, 5, 6, 8, 10, 12];

  // Parse existing height
  const currentHeightFt = run.fenceHeight 
    ? parseInt(run.fenceHeight.replace("'", "")) 
    : run.proposed_height_ft;

  const getStatusBadge = () => {
    switch (complianceStatus) {
      case 'OK':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Compliant</Badge>;
      case 'WARN_TOO_TALL':
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" />Exceeds Limit</Badge>;
      case 'NO_RULES':
        return <Badge variant="outline"><Info className="w-3 h-3 mr-1" />No Rules</Badge>;
      case 'UNKNOWN_ZONE':
        return <Badge variant="outline"><AlertTriangle className="w-3 h-3 mr-1" />Set Zone</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-3 p-3 bg-slate-50 rounded border">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">Height Compliance</h4>
        {getStatusBadge()}
      </div>

      {/* Yard Zone Selector */}
      <div className="space-y-1">
        <Label className="text-xs">Yard Zone</Label>
        <Select 
          value={run.yard_zone || 'UNKNOWN'} 
          onValueChange={onZoneChange}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yardZones.map(zone => (
              <SelectItem key={zone.value} value={zone.value}>
                {zone.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Height Selector */}
      <div className="space-y-1">
        <Label className="text-xs">Fence Height (ft)</Label>
        <Select 
          value={currentHeightFt ? String(currentHeightFt) : ''} 
          onValueChange={onHeightChange}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select height" />
          </SelectTrigger>
          <SelectContent>
            {heightOptions.map(h => (
              <SelectItem key={h} value={String(h)}>
                {h} ft
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Max Allowed Display */}
      {maxAllowedFt !== null && (
        <div className="flex items-center justify-between text-xs p-2 bg-blue-50 rounded">
          <span className="text-slate-600">Max Allowed:</span>
          <span className="font-bold text-blue-700">{maxAllowedFt} ft</span>
        </div>
      )}

      {/* Messages */}
      {messages && messages.length > 0 && (
        <Alert className={complianceStatus === 'WARN_TOO_TALL' ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'}>
          <AlertDescription className="text-xs space-y-1">
            {messages.map((msg, idx) => (
              <p key={idx}>{msg}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}