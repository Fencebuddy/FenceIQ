import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Loader2, CheckCircle } from "lucide-react";

/**
 * MATERIAL SWITCHER COMPONENT
 * Allows direct material switching at job level
 * Shows saved state indicators for each material
 */
export default function MaterialSwitcher({ 
  currentMaterial, 
  materialStates, 
  onSwitch, 
  isSwitching 
}) {
  const materials = ['Vinyl', 'Chain Link', 'Wood', 'Aluminum'];
  
  const hasSavedState = (material) => {
    return materialStates?.[material]?.mapState?.fenceLines?.length > 0;
  };
  
  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-emerald-600" />
          <h3 className="font-semibold text-sm text-emerald-900">Switch Material Type</h3>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {materials.map(material => (
            <Button
              key={material}
              onClick={() => onSwitch(material)}
              disabled={isSwitching || material === currentMaterial}
              variant={material === currentMaterial ? "default" : "outline"}
              className={`relative flex flex-col items-center gap-1 h-auto py-2 ${
                material === currentMaterial 
                  ? "bg-emerald-600 hover:bg-emerald-700" 
                  : "hover:bg-emerald-50"
              }`}
            >
              {isSwitching && material !== currentMaterial ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : material === currentMaterial ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Package className="w-4 h-4" />
              )}
              
              <span className="text-xs font-medium">{material}</span>
              
              {hasSavedState(material) && material !== currentMaterial && (
                <Badge variant="outline" className="absolute -top-1 -right-1 h-4 px-1 text-[8px] bg-blue-500 text-white border-blue-600">
                  Saved
                </Badge>
              )}
            </Button>
          ))}
        </div>
        
        <p className="text-xs text-emerald-700 mt-2">
          {hasSavedState(currentMaterial) 
            ? "✓ Current material has saved map data • Switch preserves each material's layout" 
            : "Draw fence lines to save state for this material"}
        </p>
        
        {isSwitching && (
          <div className="flex items-center gap-2 mt-2 text-xs text-emerald-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            Switching materials and restoring state...
          </div>
        )}
      </CardContent>
    </Card>
  );
}