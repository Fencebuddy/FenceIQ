import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Triangle, Info, MapPin, Trash2 } from "lucide-react";

export default function VisionTriangleTool({ 
  job,
  isActive,
  onToggle,
  onModeChange,
  onMaxHeightChange,
  onClear,
  points = []
}) {
  const hasTriangle = job.vision_triangle_polygon && job.vision_triangle_polygon.length >= 3;
  const maxHeightInches = job.vision_triangle_max_height_inches || 24;

  const getStepText = () => {
    if (points.length === 0) return "Step 1: Click the corner point (origin)";
    if (points.length === 1) return "Step 2: Click leg point 1";
    if (points.length === 2) return "Step 3: Click leg point 2";
    return "Triangle placed";
  };

  if (!isActive && !hasTriangle) {
    return (
      <Button 
        size="sm" 
        variant="outline" 
        onClick={onToggle}
        className="w-full"
      >
        <Triangle className="w-3 h-3 mr-2" />
        Visibility Triangle
      </Button>
    );
  }

  return (
    <Card className={isActive ? "border-purple-500" : ""}>
      <CardHeader className={`py-3 border-b ${isActive ? 'bg-purple-50' : 'bg-slate-50'}`}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Triangle className="w-4 h-4" />
            Visibility Triangle
          </CardTitle>
          <Button 
            size="sm" 
            variant={isActive ? "default" : "outline"}
            onClick={onToggle}
            className="h-7"
          >
            {isActive ? "Cancel" : "Edit"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <Alert className="border-blue-500 bg-blue-50">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-xs">
            <strong>Disclaimer:</strong> Visibility triangle guidance is generalized. 
            Confirm exact clear vision area dimensions and rules with the local jurisdiction.
          </AlertDescription>
        </Alert>

        {/* Mode Selector */}
        <div className="space-y-1">
          <Label className="text-xs">Triangle Type</Label>
          <Select 
            value={job.vision_triangle_mode || 'DRIVEWAY'} 
            onValueChange={onModeChange}
            disabled={isActive && points.length > 0}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRIVEWAY">Driveway to Road</SelectItem>
              <SelectItem value="INTERSECTION">Street Intersection</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Max Height */}
        <div className="space-y-1">
          <Label className="text-xs">Max Height in Triangle (inches)</Label>
          <input
            type="number"
            min="12"
            max="48"
            step="6"
            value={maxHeightInches}
            onChange={(e) => onMaxHeightChange(parseInt(e.target.value))}
            className="w-full h-8 px-2 border rounded text-sm"
            disabled={isActive && points.length > 0}
          />
          <p className="text-xs text-slate-500">Typical: 24" (check local ordinance)</p>
        </div>

        {/* Active Placement Instructions */}
        {isActive && (
          <Alert className="border-purple-500 bg-purple-50">
            <MapPin className="w-4 h-4 text-purple-600" />
            <AlertDescription className="text-xs">
              <strong>{getStepText()}</strong>
              <div className="mt-1">
                Points placed: {points.length}/3
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Triangle Status */}
        {hasTriangle && !isActive && (
          <div className="p-3 bg-green-50 rounded border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <Badge className="bg-green-100 text-green-800">
                <Triangle className="w-3 h-3 mr-1" />
                Triangle Placed
              </Badge>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={onClear}
                className="h-6 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
            <div className="text-xs text-slate-600">
              <div>Mode: {job.vision_triangle_mode}</div>
              <div>Max Height: {maxHeightInches}"</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}