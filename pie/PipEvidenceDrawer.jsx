import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Database, Satellite, FileText, Clock, Shield } from "lucide-react";

export default function PipEvidenceDrawer({ isOpen, onClose, evidence, selectedSignal, confidence, freshness }) {
  if (!evidence) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Intelligence Sources
          </SheetTitle>
          <SheetDescription>
            Data sources and model details for this property analysis
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Selected Signal Detail */}
          {selectedSignal && (
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-sm font-bold text-blue-900 mb-2">Selected Signal</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">{selectedSignal.label}</span>
                  <span className="text-sm font-bold text-slate-900">{selectedSignal.value}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Confidence</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                    {(selectedSignal.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Overall Confidence */}
          <div className="space-y-2">
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Overall Confidence
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 font-semibold">
                {confidence}
              </Badge>
            </div>
          </div>

          {/* Freshness */}
          {freshness && (
            <div className="space-y-2">
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Data Freshness
              </div>
              <div className="space-y-1">
                <Badge className="bg-blue-100 text-blue-700 border-blue-300">
                  {freshness.label}
                </Badge>
                {freshness.updatedAt && (
                  <p className="text-xs text-slate-600">
                    Updated: {new Date(freshness.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Data Sources */}
          <div className="space-y-3">
            <div className="text-sm font-bold text-slate-900">Data Sources</div>

            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <Database className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-700 mb-1">Parcel Data</div>
                  <div className="text-xs text-slate-600 font-mono break-all">
                    {evidence.parcelSource || "N/A"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <Satellite className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-700 mb-1">Satellite Imagery</div>
                  <div className="text-xs text-slate-600 font-mono break-all">
                    {evidence.imagerySource || "N/A"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <FileText className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-700 mb-1">Assessor Records</div>
                  <div className="text-xs text-slate-600 font-mono break-all">
                    {evidence.assessorSource || "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Model Versions */}
          <div className="space-y-2 pb-6">
            <div className="text-sm font-bold text-slate-900">Model Versions</div>
            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Rules:</span>
                <span className="font-mono">{evidence.modelVersion || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span>Explainability:</span>
                <span className="font-mono">{evidence.explainabilityVersion || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}