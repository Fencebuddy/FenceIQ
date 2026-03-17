import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks, TrendingUp, TrendingDown } from "lucide-react";

export default function PipReasons({ reasons }) {
  if (!reasons || reasons.length === 0) return null;

  return (
    <Card className="mx-4 mb-4 border border-slate-200 shadow-sm">
      <CardHeader className="pb-3 bg-slate-50 border-b border-slate-200">
        <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ListChecks className="w-4 h-4" />
          Why This Matters
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-3 pb-3">
        <div className="space-y-2">
          {reasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="flex-shrink-0 mt-0.5">
                {reason.impact === "UP" ? (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{reason.label}</p>
                {reason.confidence && reason.confidence < 0.7 && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Confidence: {(reason.confidence * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}