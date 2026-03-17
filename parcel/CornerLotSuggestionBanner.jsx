import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info, X } from "lucide-react";

export default function CornerLotSuggestionBanner({ 
  confidence, 
  reason,
  onEnable, 
  onNotCornerLot, 
  onDismiss 
}) {
  const confidenceColors = {
    HIGH: 'bg-green-100 text-green-800',
    MEDIUM: 'bg-amber-100 text-amber-800',
    LOW: 'bg-blue-100 text-blue-800'
  };

  return (
    <Alert className="border-blue-500 bg-blue-50">
      <Info className="w-4 h-4 text-blue-600" />
      <AlertDescription>
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <strong className="text-blue-900">Corner Lot Detected</strong>
              <Badge className={confidenceColors[confidence] || 'bg-slate-100'}>
                Confidence: {confidence}
              </Badge>
            </div>
            <p className="text-sm text-blue-800 mb-2">
              {reason}. Enable Corner Lot rules?
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button 
                size="sm" 
                onClick={onEnable}
                className="bg-blue-600 hover:bg-blue-700 h-7 text-xs"
              >
                Enable Corner Lot Rules
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onNotCornerLot}
                className="h-7 text-xs"
              >
                Not a corner lot
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={onDismiss}
                className="h-7 text-xs"
              >
                Dismiss
              </Button>
            </div>
          </div>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={onDismiss}
            className="h-6 w-6"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}