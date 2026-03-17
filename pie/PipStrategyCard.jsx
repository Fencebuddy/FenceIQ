import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";

export default function PipStrategyCard({ recommendation }) {
  if (!recommendation) return null;

  const tierColors = {
    BEST: "emerald",
    BETTER: "blue",
    GOOD: "slate"
  };

  const tierColor = tierColors[recommendation.tier] || "slate";

  const discountColors = {
    AVOID: "red",
    LIGHT: "yellow",
    OK: "emerald"
  };

  const discountColor = discountColors[recommendation.discountGuidance] || "slate";
  const discountLabels = {
    AVOID: "Avoid discounting",
    LIGHT: "Light discount OK",
    OK: "Flexible on price"
  };

  return (
    <Card className="mx-4 mb-4 border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white shadow-md">
      <CardHeader className="pb-3 bg-gradient-to-r from-purple-500 to-indigo-500">
        <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Strategy Recommendation
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Primary Recommendation */}
        <div>
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Lead With
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-black text-slate-900 capitalize">
              {recommendation.primarySystem} {recommendation.primaryStyle}
            </span>
            <Badge className={`bg-${tierColor}-100 text-${tierColor}-700 border-${tierColor}-300 font-bold`}>
              {recommendation.tier}
            </Badge>
          </div>
        </div>

        {/* Talk Track Angles */}
        {recommendation.talkTrackAngles?.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Talk Tracks
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendation.talkTrackAngles.map((angle, i) => (
                <Badge key={i} variant="outline" className="capitalize bg-blue-50 text-blue-700 border-blue-300">
                  {angle.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Discount Guidance */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
          <AlertTriangle className={`w-4 h-4 text-${discountColor}-600 flex-shrink-0`} />
          <span className={`text-sm font-bold text-${discountColor}-700`}>
            {discountLabels[recommendation.discountGuidance] || recommendation.discountGuidance}
          </span>
        </div>

        {/* Upsells */}
        {recommendation.upsells?.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Upsell Opportunities
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendation.upsells.map((upsell, i) => (
                <Badge key={i} className="capitalize bg-emerald-100 text-emerald-700 border-emerald-300 font-semibold">
                  {upsell.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}