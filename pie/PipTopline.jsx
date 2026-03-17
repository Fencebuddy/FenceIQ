import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, Target } from "lucide-react";
import { OPPORTUNITY_LEVELS, CLOSE_PROBABILITY } from "./pipTypes";

const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

export default function PipTopline({ scores, ticket }) {
  const oppConfig = OPPORTUNITY_LEVELS[scores?.opportunityLevel] || OPPORTUNITY_LEVELS.MED;
  const closeConfig = CLOSE_PROBABILITY[scores?.closeProbability] || CLOSE_PROBABILITY.MED;

  return (
    <div className="p-4 grid grid-cols-1 gap-3">
      {/* Opportunity Level */}
      <Card className={`border-2 border-${oppConfig.color}-300 bg-gradient-to-br from-white to-${oppConfig.color}-50 shadow-sm`}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Opportunity
              </div>
              <div className={`text-2xl font-black text-${oppConfig.color}-700 flex items-center gap-2`}>
                <span>{oppConfig.icon}</span>
                {oppConfig.label}
              </div>
            </div>
            <TrendingUp className={`w-8 h-8 text-${oppConfig.color}-400`} />
          </div>
        </CardContent>
      </Card>

      {/* Ticket Range */}
      <Card className="border-2 border-blue-300 bg-gradient-to-br from-white to-blue-50 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Ticket Range
              </div>
              <div className="text-lg font-black text-blue-700">
                {money(ticket?.low)} - {money(ticket?.high)}
              </div>
            </div>
            <DollarSign className="w-8 h-8 text-blue-400" />
          </div>
        </CardContent>
      </Card>

      {/* Close Probability */}
      <Card className={`border-2 border-${closeConfig.color}-300 bg-gradient-to-br from-white to-${closeConfig.color}-50 shadow-sm`}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Close Probability
              </div>
              <div className={`text-2xl font-black text-${closeConfig.color}-700`}>
                {closeConfig.label}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{closeConfig.pct}</div>
            </div>
            <Target className={`w-8 h-8 text-${closeConfig.color}-400`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}