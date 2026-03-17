// Property Intelligence Panel - Action Types & Constants

export const PIP_ACTIONS = {
  REFRESH_SIGNALS: "REFRESH_SIGNALS",
  GENERATE_GHOST_TAKEOFF: "GENERATE_GHOST_TAKEOFF",
  START_MEASURE_MODE: "START_MEASURE_MODE",
  OPEN_PRICE_PRESENTATION: "OPEN_PRICE_PRESENTATION",
  CREATE_NEIGHBOR_TARGETS: "CREATE_NEIGHBOR_TARGETS",
  OPEN_EVIDENCE: "OPEN_EVIDENCE"
};

export const PIP_STATUS = {
  READY: "READY",
  PARTIAL: "PARTIAL",
  STALE: "STALE",
  FAILED: "FAILED",
  LOCKED: "LOCKED"
};

export const OPPORTUNITY_LEVELS = {
  VERY_HIGH: { label: "Very High", color: "emerald", icon: "🔥" },
  HIGH: { label: "High", color: "green", icon: "⬆️" },
  MED: { label: "Medium", color: "yellow", icon: "➡️" },
  LOW: { label: "Low", color: "slate", icon: "⬇️" }
};

export const CLOSE_PROBABILITY = {
  HIGH: { label: "High", color: "emerald", pct: "70%+" },
  MED: { label: "Medium", color: "yellow", pct: "40-70%" },
  LOW: { label: "Low", color: "slate", pct: "<40%" }
};

export const CONFIDENCE_LEVELS = {
  HIGH: { label: "High Confidence", color: "emerald", min: 0.8 },
  MED: { label: "Medium Confidence", color: "yellow", min: 0.5 },
  LOW: { label: "Low Confidence", color: "amber", min: 0 }
};