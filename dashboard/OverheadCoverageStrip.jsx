import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, TrendingUp, AlertTriangle, CheckCircle, Sparkles } from "lucide-react";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n || 0));

export default function OverheadCoverageStrip({ packet }) {
  if (!packet) {
    return (
      <Card className="border-2 border-amber-200 shadow-lg">
        <CardContent className="pt-6">
          <Alert className="bg-amber-50 border-amber-200">
            <AlertDescription className="text-amber-800 font-medium">
              Configure <Link to={createPageUrl('OverheadIntelligence')} className="underline font-bold">Overhead Intelligence</Link> to activate financial coverage tracking.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { 
    monthlyOverhead, 
    overheadCoveredMTD, 
    coveragePct, 
    remainingOverhead, 
    paceForecast, 
    paceDelta,
    status,
    freedomLineReached,
    freedomDate
  } = packet;

  // Color scheme
  const colorScheme = {
    SAFE: { 
      bg: 'bg-green-50', 
      border: 'border-[#52AE22]', 
      bar: 'bg-[#52AE22]',
      text: 'text-green-700',
      icon: <CheckCircle className="w-6 h-6" />
    },
    WATCH: { 
      bg: 'bg-amber-50', 
      border: 'border-amber-300', 
      bar: 'bg-amber-500',
      text: 'text-amber-700',
      icon: <AlertTriangle className="w-6 h-6" />
    },
    DANGER: { 
      bg: 'bg-red-50', 
      border: 'border-red-300', 
      bar: 'bg-red-500',
      text: 'text-red-700',
      icon: <Shield className="w-6 h-6" />
    }
  };

  const colors = colorScheme[status];
  const progressPct = Math.min(100, coveragePct);

  return (
    <div className="space-y-4">
      {/* Freedom Line Banner */}
      {freedomLineReached && (
        <Card className="border-2 border-[#52AE22] shadow-xl bg-gradient-to-r from-green-50 via-green-100 to-green-50">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center justify-center gap-4">
              <Sparkles className="w-8 h-8 text-[#52AE22] animate-pulse" />
              <div className="text-center">
                <div className="text-2xl font-black text-green-700 mb-1">
                  🎯 OVERHEAD COVERED
                </div>
                <p className="text-sm text-green-600 font-semibold">
                  Your company crossed the Freedom Line on {new Date(freedomDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.
                  <br />
                  All additional gross margin now accelerates net profit.
                </p>
              </div>
              <Sparkles className="w-8 h-8 text-[#52AE22] animate-pulse" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Coverage Card */}
      <Card className={`border-2 ${colors.border} shadow-lg ${colors.bg}`}>
        <CardContent className="pt-8 pb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {colors.icon}
              <div>
                <h3 className="text-xl font-bold text-slate-900">OVERHEAD COVERAGE</h3>
                <p className="text-xs text-slate-600 font-medium uppercase tracking-wide">
                  {status === 'SAFE' ? 'On Track' : status === 'WATCH' ? 'Monitor Closely' : 'Needs Attention'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600 font-semibold">Coverage</div>
              <div className={`text-4xl font-black ${colors.text}`}>
                {coveragePct.toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm font-bold mb-2">
              <span className="text-slate-900">{money(overheadCoveredMTD)} Covered</span>
              <span className="text-slate-600">of {money(monthlyOverhead)} Target</span>
            </div>
            <div className="w-full h-8 bg-slate-200 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`h-full ${colors.bar} transition-all duration-500 flex items-center justify-end pr-3`}
                style={{ width: `${progressPct}%` }}
              >
                {progressPct > 10 && (
                  <span className="text-white font-bold text-sm">{progressPct.toFixed(0)}%</span>
                )}
              </div>
            </div>
          </div>

          {/* Status Messages */}
          <div className="space-y-3">
            {remainingOverhead > 0 && (
              <p className="text-base font-semibold text-slate-700">
                <span className={colors.text}>Remaining:</span> {money(remainingOverhead)} to cover overhead.
              </p>
            )}

            {/* Pace Line */}
            <div className="flex items-start gap-2">
              <TrendingUp className={`w-5 h-5 ${colors.text} mt-0.5`} />
              <p className="text-base font-semibold text-slate-700">
                {paceDelta >= 0 ? (
                  <>
                    At your current pace, you will cover <span className="text-[#52AE22] font-bold">{((paceForecast / monthlyOverhead) * 100).toFixed(0)}%</span> of overhead.
                  </>
                ) : (
                  <>
                    At your current pace, you will <span className="text-red-600 font-bold">MISS</span> overhead by {money(Math.abs(paceDelta))}.
                  </>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}