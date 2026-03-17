/**
 * EXECUTIVE INTELLIGENCE ENGINE TYPES
 * Core types for the decision intelligence layer
 */

export type CompanyState = 
  | "DOMINANT" 
  | "STRONG" 
  | "STABLE" 
  | "CAUTION" 
  | "AT_RISK" 
  | "INSUFFICIENT_DATA";

export type ConfidenceLabel = "MAXIMUM" | "HIGH" | "GUARDED" | "UNSTABLE";

export type Trajectory = "ASCENDING" | "LEVEL" | "VOLATILE" | "DECLINING";

export type GlidePathStatus = "CLIMBING" | "ON_TRACK" | "BELOW";

export type AlertId = 
  | "MARGIN_COMPRESSION" 
  | "OVERRIDE_SURGE" 
  | "REVENUE_STALL" 
  | "FORECAST_COLLAPSE";

export type AlertSeverity = "WATCH" | "RISK";

export interface Alert {
  id: AlertId;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommended_action: string;
}

export interface ExecutiveState {
  company_state: CompanyState;
  flight_brief: string[];  // max 3
  alerts: Alert[];
  confidence_score: number;  // 0-100
  confidence_label: ConfidenceLabel;
  trajectory: Trajectory;

  // Numeric anchors
  net_profit: number;
  net_margin: number;
  revenue: number;
  gross_margin: number;
  close_rate: number;
  upsell_avg: number;
  price_integrity: number;
  override_rate: number;
  jobs_sold: number;
  forecast_confidence: number;

  // Projections
  projected_revenue: number;
  projected_net_profit: number;
  profit_per_day: number;
  glide_path_status: GlidePathStatus;
  
  // Optional goal context
  goal_revenue?: number;
  goal_net_profit?: number;
}

export interface PeriodMetrics {
  revenue: number;
  gross_margin: number;
  net_margin: number;
  net_profit: number;
  close_rate: number;
  upsell_avg: number;
  price_integrity: number;
  override_rate: number;
  jobs_sold: number;
  forecast_confidence: number;
}