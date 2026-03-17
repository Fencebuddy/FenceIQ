import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MapPin, CheckCircle, X } from "lucide-react";

export default function ParcelEdgeSelector({ 
  isActive,
  selectedEdges = [],
  onToggle,
  onEdgeSelect,
  onClear,
  onConfirm 
}) {
  if (!isActive) {
    return (
      <Button 
        size="sm" 
        variant="outline" 
        onClick={onToggle}
        className="w-full"
      >
        <MapPin className="w-3 h-3 mr-2" />
        Select Street-Facing Edges
      </Button>
    );
  }

  return (
    <Card className="border-blue-500">
      <CardHeader className="bg-blue-50 py-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Select Street-Facing Edges</CardTitle>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={onToggle}
            className="h-6 w-6"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <Alert className="border-blue-500 bg-blue-50">
          <AlertDescription className="text-xs">
            Tap on the parcel boundary near a street-facing edge. Select 1-2 edges.
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {selectedEdges.length} edge{selectedEdges.length !== 1 ? 's' : ''} selected
          </Badge>
          {selectedEdges.length >= 2 && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Corner Lot
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={onClear}
            variant="outline"
            disabled={selectedEdges.length === 0}
            className="flex-1"
          >
            Clear
          </Button>
          <Button 
            size="sm" 
            onClick={onConfirm}
            disabled={selectedEdges.length === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            Confirm Selection
          </Button>
        </div>

        {selectedEdges.length > 0 && (
          <div className="text-xs text-slate-600">
            <p className="font-medium mb-1">Selected edges:</p>
            <ul className="list-disc pl-5">
              {selectedEdges.map((edge, idx) => (
                <li key={idx}>Edge {edge.index + 1}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}