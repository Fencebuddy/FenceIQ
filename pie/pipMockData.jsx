// Mock PIP data for development (remove when backend ready)

export const getMockPipData = (jobId) => ({
  status: "READY",
  jobId,
  property: {
    address: "123 Main St, Grand Rapids, MI 49503",
    lat: 42.9634,
    lng: -85.6681,
    parcelId: "41-14-01-123-456"
  },
  freshness: {
    label: "FRESH",
    updatedAt: new Date().toISOString()
  },
  confidence: "HIGH",
  scores: {
    opportunityLevel: "VERY_HIGH",
    opportunityScore: 9.1,
    closeProbability: "HIGH",
    priceSensitivity: "LOW"
  },
  ticket: { low: 9800, high: 13600, currency: "USD" },
  recommendation: {
    primarySystem: "vinyl",
    primaryStyle: "privacy",
    tier: "BEST",
    talkTrackAngles: ["safety", "longevity", "curb_appeal"],
    discountGuidance: "AVOID",
    upsells: ["decorative_top", "gate_upgrade", "pet_pickets"]
  },
  reasons: [
    { type: "BACKYARD_DEPTH", label: "Deep backyard (~72 ft)", impact: "UP" },
    { type: "NO_EXISTING_FENCE", label: "No existing fence detected", impact: "UP" },
    { type: "POOL", label: "Pool detected (0.86)", impact: "UP" },
    { type: "VALUE_BAND", label: "High-value property", impact: "UP" },
    { type: "RECENT_SALE", label: "Purchased within 24 months", impact: "UP" }
  ],
  signals: [
    { key: "parcel", label: "Parcel", value: "OK", confidence: 0.95 },
    { key: "pool", label: "Pool", value: "YES", confidence: 0.86 },
    { key: "existingFence", label: "Existing Fence", value: "LIKELY_NONE", confidence: 0.74 },
    { key: "fenceDensity", label: "Fence Density", value: "MED", confidence: 0.62 },
    { key: "dog", label: "Dog Likelihood", value: "HIGH", confidence: 0.60 },
    { key: "saleRecency", label: "Sale Recency", value: "RECENT_0_24M", confidence: 0.90 },
    { key: "valueBand", label: "Value Band", value: "400_650", confidence: 0.70 }
  ],
  alerts: [
    { severity: "WARN", message: "Boundary uncertainty: west edge missing in county parcel feed." }
  ],
  evidence: {
    parcelSource: "county_gis_kent_mi",
    imagerySource: "mapbox_satellite_2025_11",
    assessorSource: "county_assessor",
    modelVersion: "pie_rules_v0.1",
    explainabilityVersion: "pip_v1"
  },
  actions: {
    canGenerateGhostTakeoff: true,
    canCreateNeighborTargets: true
  },
  overrides: {
    enabled: false,
    fields: []
  }
});