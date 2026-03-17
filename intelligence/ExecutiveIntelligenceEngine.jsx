/**
 * EXECUTIVE INTELLIGENCE ENGINE (EIE)
 * Transforms raw metrics into executive decision signals
 * 
 * RULES:
 * - NO placeholders
 * - NO fabricated numbers
 * - If data missing → INSUFFICIENT_DATA state
 * - Flight brief max 3 bullets
 * - Alerts only when thresholds crossed
 */

import { getExecutiveMetrics } from './metrics/getExecutiveMetrics';
import { getCachedState, setCachedState } from './cache/executiveStateCache';
import { base44 } from '@/api/base44Client';

export async function getExecutiveState({ companyId, range }) {
  // Check cache first
  const cached = getCachedState(companyId, range);
  if (cached) {
    console.log('[EIE] Cache hit');
    return cached;
  }
  
  // Fetch metrics
  const metricsResult = await getExecutiveMetrics({ companyId, range });
  const { current, previous, daysElapsed, daysInPeriod } = metricsResult;
  
  // Validate required metrics
  const requiredFields = ['revenue', 'net_profit', 'net_margin', 'price_integrity', 'override_rate', 'forecast_confidence'];
  const missingFields = requiredFields.filter(field => current[field] === undefined || current[field] === null);
  
  if (missingFields.length > 0) {
    const insufficientState = {
      company_state: "INSUFFICIENT_DATA",
      flight_brief: [
        "Insufficient data to calculate executive state",
        "Connect pricing and job cost signals",
        "Enable JobCostSnapshot generation for sold jobs"
      ],
      alerts: [],
      confidence_score: 0,
      confidence_label: "UNSTABLE",
      trajectory: "LEVEL",
      net_profit: 0,
      net_margin: 0,
      revenue: 0,
      gross_margin: 0,
      close_rate: 0,
      upsell_avg: 0,
      price_integrity: 0,
      override_rate: 0,
      jobs_sold: 0,
      forecast_confidence: 0,
      projected_revenue: 0,
      projected_net_profit: 0,
      profit_per_day: 0,
      glide_path_status: "BELOW"
    };
    
    setCachedState(companyId, range, insufficientState);
    return insufficientState;
  }
  
  // Fetch goals if available
  let goals = {};
  try {
    const goalSettings = await base44.entities.DashboardGoalSettings.list();
    if (goalSettings.length > 0) {
      const monthlyGoal = goalSettings[0];
      goals.revenue = monthlyGoal.monthly_revenue_goal;
      goals.net_profit = monthlyGoal.monthly_net_profit_goal;
    }
  } catch (err) {
    console.warn('[EIE] No goals configured');
  }
  
  // Compute projections
  const profit_per_day = daysElapsed > 0 ? current.net_profit / daysElapsed : 0;
  const revenue_per_day = daysElapsed > 0 ? current.revenue / daysElapsed : 0;
  
  const projected_revenue = range === "MTD" ? revenue_per_day * daysInPeriod : current.revenue;
  const projected_net_profit = range === "MTD" ? profit_per_day * daysInPeriod : current.net_profit;
  
  // Glide path status
  let glide_path_status = "ON_TRACK";
  if (goals.revenue) {
    if (projected_revenue >= goals.revenue) {
      glide_path_status = "CLIMBING";
    } else if (projected_revenue >= goals.revenue * 0.95) {
      glide_path_status = "ON_TRACK";
    } else {
      glide_path_status = "BELOW";
    }
  } else {
    // No goals - use trend vs current pace
    if (previous.revenue && current.revenue > previous.revenue * 1.05) {
      glide_path_status = "CLIMBING";
    } else if (previous.revenue && current.revenue < previous.revenue * 0.90) {
      glide_path_status = "BELOW";
    }
  }
  
  // Determine company state
  const company_state = determineCompanyState(current, previous);
  
  // Calculate confidence score
  const confidence_score = calculateConfidenceScore(current);
  const confidence_label = mapConfidenceLabel(confidence_score);
  
  // Determine trajectory
  const trajectory = determineTrajectory(current, previous);
  
  // Generate flight brief
  const flight_brief = generateFlightBrief({
    current,
    projected_net_profit,
    projected_revenue,
    goals,
    company_state,
    trajectory,
    glide_path_status
  });
  
  // Generate alerts
  const alerts = generateAlerts(current, previous, projected_revenue, goals);
  
  // Generate executive intel
  const intel = generateExecutiveIntel({
    current,
    previous,
    trajectory,
    glide_path_status,
    company_state
  });

  const state = {
    company_state,
    flight_brief,
    alerts,
    confidence_score,
    confidence_label,
    trajectory,
    intel,
    net_profit: current.net_profit,
    net_margin: current.net_margin,
    revenue: current.revenue,
    gross_margin: current.gross_margin || 0,
    close_rate: current.close_rate || 0,
    upsell_avg: current.upsell_avg || 0,
    price_integrity: current.price_integrity,
    override_rate: current.override_rate,
    jobs_sold: current.jobs_sold,
    forecast_confidence: current.forecast_confidence,
    projected_revenue,
    projected_net_profit,
    profit_per_day,
    glide_path_status,
    ...(goals.revenue && { goal_revenue: goals.revenue }),
    ...(goals.net_profit && { goal_net_profit: goals.net_profit })
  };
  
  // Cache result
  setCachedState(companyId, range, state);
  
  return state;
}

function determineCompanyState(current, previous) {
  const nm = current.net_margin || 0;
  const fc = current.forecast_confidence || 0;
  const ovr = current.override_rate || 0;
  const cr = current.close_rate || 0;
  const pi = current.price_integrity || 0;
  
  // DOMINANT
  if (nm >= 0.25 && fc >= 90 && ovr < 0.05) {
    return "DOMINANT";
  }
  
  // STRONG
  if (nm >= 0.20 && cr >= 0.60) {
    return "STRONG";
  }
  
  // STABLE
  if (nm >= 0.15) {
    return "STABLE";
  }
  
  // CAUTION
  const marginTrendingDown = previous.net_margin && nm < previous.net_margin * 0.95;
  const overrideTrendingUp = previous.override_rate && ovr > previous.override_rate * 1.10;
  if (marginTrendingDown || overrideTrendingUp) {
    return "CAUTION";
  }
  
  // AT_RISK
  if (nm < 0.10 || pi < 0.85) {
    return "AT_RISK";
  }
  
  return "STABLE";
}

function calculateConfidenceScore(metrics) {
  // Weighted components
  const margins = normalizeMetric(metrics.net_margin || 0, 0, 0.35) * 30;
  const forecast = (metrics.forecast_confidence || 0) * 0.25;
  const revenue = normalizeMetric(metrics.revenue || 0, 0, 100000) * 20;
  const closeRate = (metrics.close_rate || 0) * 100 * 0.15;
  const pricingIntegrity = (metrics.price_integrity || 0) * 100 * 0.10;
  
  const rawScore = margins + forecast + revenue + closeRate + pricingIntegrity;
  
  // GUARDRAIL: Clamp to 0-100 range (no divide-by-zero explosions)
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

function normalizeMetric(value, min, max) {
  if (max === min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function mapConfidenceLabel(score) {
  if (score >= 90) return "MAXIMUM";
  if (score >= 75) return "HIGH";
  if (score >= 60) return "GUARDED";
  return "UNSTABLE";
}

function determineTrajectory(current, previous) {
  if (!previous.net_profit || !previous.revenue) return "LEVEL";
  
  const profitGrowth = (current.net_profit - previous.net_profit) / previous.net_profit;
  const revenueGrowth = (current.revenue - previous.revenue) / previous.revenue;
  
  const bothRising = profitGrowth > 0.05 && revenueGrowth > 0.05;
  const bothFalling = profitGrowth < -0.05 && revenueGrowth < -0.05;
  const mixedDirection = Math.abs(profitGrowth - revenueGrowth) > 0.15;
  
  if (bothRising) return "ASCENDING";
  if (bothFalling) return "DECLINING";
  if (mixedDirection) return "VOLATILE";
  return "LEVEL";
}

function generateFlightBrief(params) {
  const brief = [];
  const { current, projected_net_profit, projected_revenue, goals, company_state, trajectory, glide_path_status } = params;
  
  // Priority 1: Profit trend
  if (goals.net_profit && projected_net_profit > goals.net_profit) {
    brief.push("Profit trending above plan");
  } else if (trajectory === "ASCENDING") {
    brief.push("Profit trajectory ascending");
  } else if (company_state === "AT_RISK") {
    brief.push("Profit margins compressed");
  } else if (current.net_margin >= 0.20) {
    brief.push("Margins protected");
  }
  
  // Priority 2: Revenue engine
  if (glide_path_status === "CLIMBING") {
    brief.push("Revenue engine accelerating");
  } else if (trajectory === "DECLINING") {
    brief.push("Revenue velocity declining");
  } else if (current.close_rate >= 0.65) {
    brief.push("Close rate stable");
  }
  
  // Priority 3: Confidence/discipline
  if (current.forecast_confidence >= 85) {
    brief.push("High confidence in period outcome");
  } else if (current.override_rate > 0.08) {
    brief.push("Pricing discipline softening");
  } else if (company_state === "DOMINANT" || company_state === "STRONG") {
    brief.push("Operations nominal");
  }
  
  // Return max 3
  return brief.slice(0, 3);
}

function generateAlerts(current, previous, projected_revenue, goals) {
  const alerts = [];
  
  // Margin Compression
  const marginDelta = previous.net_margin ? (current.net_margin - previous.net_margin) : 0;
  if (marginDelta < -0.03 || current.net_margin < 0.15) {
    alerts.push({
      id: "MARGIN_COMPRESSION",
      severity: current.net_margin < 0.10 ? "RISK" : "WATCH",
      title: "Margin Compression",
      message: `Net margin at ${(current.net_margin * 100).toFixed(1)}% (${marginDelta < 0 ? 'down' : 'stable'} vs prior period)`,
      recommended_action: "Review material costs and pricing strategy"
    });
  }
  
  // Override Surge
  if (current.override_rate > 0.08) {
    alerts.push({
      id: "OVERRIDE_SURGE",
      severity: current.override_rate > 0.12 ? "RISK" : "WATCH",
      title: "Override Surge",
      message: `${(current.override_rate * 100).toFixed(1)}% of pricing decisions overridden`,
      recommended_action: "Audit pricing discipline and approval workflows"
    });
  }
  
  // Revenue Stall
  if (goals.revenue && projected_revenue < goals.revenue * 0.85) {
    alerts.push({
      id: "REVENUE_STALL",
      severity: "RISK",
      title: "Revenue Stall",
      message: `Projected revenue ${((projected_revenue / goals.revenue - 1) * 100).toFixed(0)}% below target`,
      recommended_action: "Accelerate pipeline conversion and lead generation"
    });
  }
  
  // Forecast Collapse
  if (current.forecast_confidence < 60) {
    alerts.push({
      id: "FORECAST_COLLAPSE",
      severity: "WATCH",
      title: "Forecast Uncertainty",
      message: `Confidence at ${current.forecast_confidence.toFixed(0)}% (incomplete pricing data)`,
      recommended_action: "Complete pricing snapshots for all sold jobs"
    });
  }
  
  return alerts;
  }

  function generateExecutiveIntel({ current, previous, trajectory, glide_path_status, company_state }) {
  // A) WHY SUMMARY - single sentence explaining primary driver
  const why_summary = generateWhySummary({ current, previous, trajectory, glide_path_status });

  // B) RISK LEVEL + REASON
  const { risk_level, risk_reason } = computeRisk({ current, trajectory });

  // C) NEXT BEST ACTION
  const next_best_action = determineNextAction({ 
    risk_level, 
    glide_path_status, 
    current, 
    trajectory,
    company_state 
  });

  return {
    why_summary,
    risk_level,
    risk_reason,
    next_best_action
  };
  }

  function generateWhySummary({ current, previous, trajectory, glide_path_status }) {
  // Pick top 1-2 drivers, no numbers unless critical

  if (glide_path_status === "CLIMBING") {
    return "Revenue engine accelerating ahead of plan";
  }

  if (trajectory === "DECLINING") {
    return "Revenue velocity declining versus prior period";
  }

  const marginDelta = previous.net_margin ? (current.net_margin - previous.net_margin) : 0;
  if (marginDelta < -0.03) {
    return "Margin compression detected versus prior period";
  }

  if (current.override_rate > 0.10) {
    return "Pricing discipline softening with elevated override activity";
  }

  if (current.net_margin >= 0.25 && current.forecast_confidence >= 85) {
    return "Margins protected with high forecast confidence";
  }

  if (current.close_rate >= 0.65 && current.net_margin >= 0.20) {
    return "Close rate stable with margins protected";
  }

  if (glide_path_status === "ON_TRACK") {
    return "Revenue tracking to plan with nominal operations";
  }

  return "Operations nominal with stable margins";
  }

  function computeRisk({ current, trajectory }) {
  // Evaluate multiple risk factors
  const risks = [];

  // Price integrity
  if (current.price_integrity < 0.85) {
    risks.push({ level: "HIGH", reason: "Price integrity below threshold" });
  }

  // Net margin
  if (current.net_margin < 0.10) {
    risks.push({ level: "HIGH", reason: "Net margin compressed" });
  } else if (current.net_margin < 0.15) {
    risks.push({ level: "MED", reason: "Net margin trending low" });
  }

  // Override rate
  if (current.override_rate > 0.12) {
    risks.push({ level: "HIGH", reason: "Override rate elevated" });
  } else if (current.override_rate > 0.08) {
    risks.push({ level: "MED", reason: "Override rate trending up" });
  }

  // Forecast confidence
  if (current.forecast_confidence < 50) {
    risks.push({ level: "HIGH", reason: "Forecast confidence low" });
  } else if (current.forecast_confidence < 60) {
    risks.push({ level: "MED", reason: "Forecast uncertainty" });
  }

  // Trajectory
  if (trajectory === "DECLINING") {
    risks.push({ level: "MED", reason: "Revenue declining" });
  }

  // Return highest risk
  const highRisk = risks.find(r => r.level === "HIGH");
  if (highRisk) return highRisk;

  const medRisk = risks.find(r => r.level === "MED");
  if (medRisk) return medRisk;

  return { risk_level: "LOW", risk_reason: "All signals nominal" };
  }

  function determineNextAction({ risk_level, glide_path_status, current, trajectory, company_state }) {
  // Only suggest action if risk is MED/HIGH or below glide path
  if (risk_level === "LOW" && glide_path_status !== "BELOW") {
    return null; // Silence builds trust
  }

  // Priority 1: Margin compression
  if (current.net_margin < 0.15) {
    return {
      title: "Review material costs and pricing",
      why: "Margin compression detected"
    };
  }

  // Priority 2: Override surge
  if (current.override_rate > 0.08) {
    return {
      title: "Audit pricing discipline",
      why: "Override rate elevated"
    };
  }

  // Priority 3: Revenue stall
  if (glide_path_status === "BELOW") {
    return {
      title: "Accelerate pipeline conversion",
      why: "Revenue trending below plan"
    };
  }

  // Priority 4: Forecast uncertainty
  if (current.forecast_confidence < 60) {
    return {
      title: "Complete pricing snapshots",
      why: "Incomplete pricing data"
    };
  }

  // Priority 5: Price integrity
  if (current.price_integrity < 0.85) {
    return {
      title: "Review pricing strategy",
      why: "Price integrity below threshold"
    };
  }

  // Default for MED risk with no specific action
  if (risk_level === "MED") {
    return {
      title: "Monitor margin trends",
      why: "Elevated risk signals detected"
    };
  }

  return null;
  }