import React from "react";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Shield } from "lucide-react";
import { CONFIDENCE_LEVELS } from "./pipTypes";

export default function PipHeader({ property, freshness, confidence, onOpenEvidence }) {
  const confidenceConfig = CONFIDENCE_LEVELS[confidence] || CONFIDENCE_LEVELS.LOW;
  const freshnessColor = freshness?.label === "FRESH" ? "emerald" : 
                         freshness?.label === "STALE" ? "amber" : "slate";

  return (
    <div className="p-4 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 truncate">
              {property?.address || "Unknown Address"}
            </h3>
          </div>
          {property?.parcelId && (
            <p className="text-xs text-slate-500 font-mono ml-6">
              Parcel: {property.parcelId}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 items-end">
          <Badge
            variant="outline"
            className={`cursor-pointer hover:bg-${confidenceConfig.color}-50 transition-colors bg-${confidenceConfig.color}-50 text-${confidenceConfig.color}-700 border-${confidenceConfig.color}-300`}
            onClick={onOpenEvidence}
          >
            <Shield className="w-3 h-3 mr-1" />
            {confidenceConfig.label}
          </Badge>

          {freshness && (
            <Badge
              variant="outline"
              className={`bg-${freshnessColor}-50 text-${freshnessColor}-700 border-${freshnessColor}-300`}
            >
              <Clock className="w-3 h-3 mr-1" />
              {freshness.label}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}