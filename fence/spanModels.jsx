/**
 * Universal Fence System Span Models
 * Defines how each fence system calculates and displays spans
 */

export const FENCE_SYSTEM_MODELS = {
  Wood: {
    systemType: "postmaster_wood",
    spanKind: "bay",
    maxSpanLengthFt: 7.5,
    anchors: {
      endPosts: true,
      cornerPosts: true,
      linePosts: true,
      gatePosts: true
    },
    gateGapBehavior: "gap",
    railsPerSpan: 3,
    screwsPerRail: 4,
    labels: {
      spanLabel: "Bay",
      spanPlural: "Bays",
      anchorLabel: "Post",
      anchorPlural: "Posts"
    },
    colors: {
      span: "#10b981",
      anchor: "#059669",
      label: "#047857"
    }
  },
  
  Vinyl: {
    systemType: "vinyl_panel",
    spanKind: "panel",
    panelLengthFt: 8,
    anchors: {
      endPosts: true,
      cornerPosts: true,
      linePosts: true,
      gatePosts: true
    },
    gateGapBehavior: "gap",
    screwsPerRail: 0, // Vinyl uses no screws
    labels: {
      spanLabel: "Panel",
      spanPlural: "Panels",
      anchorLabel: "Post",
      anchorPlural: "Posts"
    },
    colors: {
      span: "#8b5cf6",
      anchor: "#7c3aed",
      label: "#6d28d9"
    }
  },
  
  Aluminum: {
    systemType: "aluminum_panel",
    spanKind: "panel",
    panelLengthFt: 6,
    anchors: {
      endPosts: true,
      cornerPosts: true,
      linePosts: true,
      gatePosts: true
    },
    gateGapBehavior: "gap",
    screwsPerRail: 0,
    labels: {
      spanLabel: "Section",
      spanPlural: "Sections",
      anchorLabel: "Post",
      anchorPlural: "Posts"
    },
    colors: {
      span: "#3b82f6",
      anchor: "#2563eb",
      label: "#1d4ed8"
    }
  },
  
  "Chain Link": {
    systemType: "chainlink",
    spanKind: "fabricSpan",
    maxSpanLengthFt: 10, // Line post every 10 feet
    anchors: {
      terminalPosts: true, // End, corner, gate posts
      linePosts: true
    },
    gateGapBehavior: "gap",
    topRailPerSpan: 1,
    tensionWirePerSpan: 1,
    tiesPerSpan: 15,
    bandsPerTerminal: 3, // Height-dependent
    tensionBarsPerTerminal: 1,
    labels: {
      spanLabel: "Span",
      spanPlural: "Spans",
      anchorLabel: "Post",
      anchorPlural: "Posts",
      terminalLabel: "Terminal"
    },
    colors: {
      span: "#f59e0b",
      anchor: "#d97706",
      label: "#b45309"
    }
  }
};

export function getSystemModel(materialType) {
  return FENCE_SYSTEM_MODELS[materialType] || FENCE_SYSTEM_MODELS.Wood;
}