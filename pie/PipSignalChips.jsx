import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";

export default function PipSignalChips({ signals, onChipClick }) {
  if (!signals || signals.length === 0) return null;

  const getConfidenceColor = (conf) => {
    if (conf >= 0.8) return "emerald";
    if (conf >= 0.5) return "yellow";
    return "amber";
  };

  return (
    <Card className="mx-4 mb-4 border border-slate-200 shadow-sm">
      <CardHeader className="pb-3 bg-slate-50 border-b border-slate-200">
        <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Radio className="w-4 h-4" />
          Property Signals
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-3 pb-3">
        <div className="flex flex-wrap gap-2">
          {signals.map((signal, i) => {
            const confColor = getConfidenceColor(signal.confidence);
            return (
              <Badge
                key={i}
                variant="outline"
                className="cursor-pointer hover:shadow-md transition-all bg-white border-slate-300 hover:border-blue-400"
                onClick={() => onChipClick?.(signal)}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full bg-${confColor}-500`} />
                  <span className="font-semibold text-slate-700">{signal.label}:</span>
                  <span className="text-slate-900 font-bold">{signal.value}</span>
                </div>
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}