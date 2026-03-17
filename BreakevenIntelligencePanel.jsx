import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

function fmtUSD(x) {
  if (x == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(x);
}

export default function BreakevenIntelligencePanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["breakeven-intelligence"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getBreakevenIntelligence", {});
      return res.data;
    },
    refetchInterval: 60_000,
    staleTime: 30_000
  });

  const payload = data?.success ? data : null;

  const status = payload?.status;
  const monthlyOverhead = payload?.overhead?.monthlyOverheadUSD ?? null;
  const overheadRecovered = payload?.recovery?.overheadRecoveredUSD ?? null;
  const gap = monthlyOverhead != null && overheadRecovered != null ? (monthlyOverhead - overheadRecovered) : null;
  const coveragePct = payload?.recovery?.coveragePct ?? 0;
  const pct = Math.round(coveragePct * 100);

  const requiredMonthlyRevenue = payload?.breakeven?.requiredMonthlyRevenueUSD ?? null;
  const effectiveOverheadRate = payload?.breakeven?.effectiveOverheadRate ?? null;

  const banner =
    status === "DANGEROUS" ? "Your overhead coverage is dangerous. Either increase revenue or reduce fixed expenses." :
    status === "NEAR" ? "Close — keep pushing revenue to cover overhead this month." :
    status === "COVERED" ? "Overhead covered for this month. Everything above this is true profit leverage." :
    "Complete overhead setup to unlock breakeven intelligence.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Breakeven Intelligence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <div>Loading breakeven intelligence…</div>}

        {!isLoading && (error || (data && data.success === false)) && (
          <Alert>
            <AlertDescription>
              {data?.message || error?.message || "Unable to load breakeven intelligence."}
            </AlertDescription>
          </Alert>
        )}

        {payload && (
          <>
            <Alert>
              <AlertDescription>{banner}</AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-sm opacity-70">Monthly Overhead</div>
                <div className="text-xl font-semibold">{fmtUSD(monthlyOverhead)}</div>
              </div>
              <div>
                <div className="text-sm opacity-70">Overhead Recovered MTD</div>
                <div className="text-xl font-semibold">{fmtUSD(overheadRecovered)}</div>
              </div>
              <div>
                <div className="text-sm opacity-70">Gap / Surplus MTD</div>
                <div className={`text-xl font-semibold ${gap != null && gap <= 0 ? "text-green-600" : "text-red-600"}`}>
                  {gap == null ? "—" : fmtUSD(gap)}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Coverage Progress</span>
                <span>{pct}%</span>
              </div>
              <Progress value={pct} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-sm opacity-70">Breakeven Revenue Needed (Monthly)</div>
                <div className="text-xl font-semibold">{fmtUSD(requiredMonthlyRevenue)}</div>
              </div>
              <div>
                <div className="text-sm opacity-70">Effective Overhead Rate</div>
                <div className="text-xl font-semibold">
                  {effectiveOverheadRate == null ? "—" : `${(effectiveOverheadRate * 100).toFixed(2)}%`}
                </div>
              </div>
            </div>

            <div className="text-xs opacity-60">
              Source: revenue-recognition rollup (no job rescans). Updated: {payload.updatedAt}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}