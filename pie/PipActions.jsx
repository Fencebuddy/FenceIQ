import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Ruler, DollarSign, Users } from "lucide-react";
import { PIP_ACTIONS } from "./pipTypes";

export default function PipActions({ actions, onAction }) {
  if (!actions) return null;

  return (
    <Card className="mx-4 mb-4 border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-white shadow-md">
      <CardHeader className="pb-3 bg-gradient-to-r from-indigo-500 to-purple-500">
        <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Quick Actions
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {actions.canGenerateGhostTakeoff && (
            <Button
              variant="outline"
              size="sm"
              className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-emerald-50 hover:border-emerald-400 transition-all"
              onClick={() => onAction(PIP_ACTIONS.GENERATE_GHOST_TAKEOFF)}
            >
              <Zap className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-bold text-slate-700">Ghost Takeoff</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-blue-50 hover:border-blue-400 transition-all"
            onClick={() => onAction(PIP_ACTIONS.START_MEASURE_MODE)}
          >
            <Ruler className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-bold text-slate-700">Measure</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-purple-50 hover:border-purple-400 transition-all"
            onClick={() => onAction(PIP_ACTIONS.OPEN_PRICE_PRESENTATION)}
          >
            <DollarSign className="w-5 h-5 text-purple-600" />
            <span className="text-xs font-bold text-slate-700">Pricing</span>
          </Button>

          {actions.canCreateNeighborTargets && (
            <Button
              variant="outline"
              size="sm"
              className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-amber-50 hover:border-amber-400 transition-all"
              onClick={() => onAction(PIP_ACTIONS.CREATE_NEIGHBOR_TARGETS)}
            >
              <Users className="w-5 h-5 text-amber-600" />
              <span className="text-xs font-bold text-slate-700">Neighbors</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}