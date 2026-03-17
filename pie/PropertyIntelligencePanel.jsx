import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { PIP_STATUS, PIP_ACTIONS } from "./pipTypes";
import { getMockPipData } from "./pipMockData";
import PipHeader from "./PipHeader";
import PipTopline from "./PipTopline";
import PipStrategyCard from "./PipStrategyCard";
import PipReasons from "./PipReasons";
import PipSignalChips from "./PipSignalChips";
import PipAlerts from "./PipAlerts";
import PipActions from "./PipActions";
import PipEvidenceDrawer from "./PipEvidenceDrawer";

export default function PropertyIntelligencePanel({ jobId, isOpen, onClose, onAction }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState(null);

  // Fetch PIP data (using mock for now)
  const { data: pipData, isLoading, error, refetch } = useQuery({
    queryKey: ["pip", jobId],
    queryFn: async () => {
      // TODO: Replace with real API call when backend ready
      // return await base44.functions.invoke('getPipData', { jobId });
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay
      return getMockPipData(jobId);
    },
    enabled: !!jobId && isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleAction = (actionType) => {
    console.log("[PIP] Action triggered:", actionType);
    onAction?.(actionType);
  };

  const handleChipClick = (signal) => {
    setSelectedSignal(signal);
    setEvidenceOpen(true);
  };

  const handleOpenEvidence = () => {
    setSelectedSignal(null);
    setEvidenceOpen(true);
  };

  if (!isOpen) return null;

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full lg:w-96 bg-white border-l border-slate-200 shadow-xl flex flex-col h-full">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-bold text-slate-900">Property Intel</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || pipData?.status === PIP_STATUS.FAILED) {
    return (
      <div className="w-full lg:w-96 bg-white border-l border-slate-200 shadow-xl flex flex-col h-full">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-bold text-slate-900">Property Intel</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <Card className="border-red-300 bg-red-50">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
              <p className="text-sm font-semibold text-red-900 mb-4">
                Unable to load property intelligence
              </p>
              <Button variant="outline" onClick={() => refetch()} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isPartial = pipData?.status === PIP_STATUS.PARTIAL;
  const isStale = pipData?.status === PIP_STATUS.STALE;

  return (
    <>
      <div className="w-full lg:w-96 bg-white border-l border-slate-200 shadow-xl flex flex-col h-full">
        {/* Panel Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-purple-500 to-indigo-500">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-white" />
            <h2 className="text-lg font-bold text-white">Property Intel</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Stale Banner */}
        {isStale && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-900">Data may be out of date</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction(PIP_ACTIONS.REFRESH_SIGNALS)}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>
        )}

        {/* Partial Banner */}
        {isPartial && (
          <Alert className="m-4 mb-0 border-amber-300 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm font-medium ml-2">
              Some signals are missing or incomplete
            </AlertDescription>
          </Alert>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <PipHeader
            property={pipData.property}
            freshness={pipData.freshness}
            confidence={pipData.confidence}
            onOpenEvidence={handleOpenEvidence}
          />

          <PipTopline scores={pipData.scores} ticket={pipData.ticket} />

          <PipStrategyCard recommendation={pipData.recommendation} />

          <PipReasons reasons={pipData.reasons} />

          <PipSignalChips signals={pipData.signals} onChipClick={handleChipClick} />

          <PipAlerts alerts={pipData.alerts} />

          <PipActions actions={pipData.actions} onAction={handleAction} />
        </div>
      </div>

      {/* Evidence Drawer */}
      <PipEvidenceDrawer
        isOpen={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        evidence={pipData?.evidence}
        selectedSignal={selectedSignal}
        confidence={pipData?.confidence}
        freshness={pipData?.freshness}
      />
    </>
  );
}