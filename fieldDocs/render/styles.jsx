/**
 * Print-safe styling constants for field documents
 */

export const STYLES = {
  // Colors
  colors: {
    fence: '#059669',      // Green
    postGate: '#A855F7',   // Purple
    postCorner: '#DC2626', // Red
    postEnd: '#F97316',    // Orange
    postLine: '#3B82F6',   // Blue
    structure: '#E5E7EB',  // Light gray fill
    structureStroke: '#6B7280', // Medium gray stroke
    grid: '#F3F4F6',       // Very light gray
    text: '#1F2937',       // Dark gray
    textLight: '#6B7280',  // Medium gray
  },

  // Line weights (points)
  lineWeights: {
    fenceThin: 0.75,
    fenceNormal: 1.2,
    fenceThick: 1.8,
    postOutline: 0.5,
    structureOutline: 0.75,
    gridLine: 0.25,
    annotationLine: 1.0,
  },

  // Font sizes (points)
  fonts: {
    title: 18,
    subtitle: 14,
    heading: 12,
    label: 10,
    small: 8,
    tiny: 7,
  },

  // Sizes
  post: {
    radiusSmall: 2.5,  // Line post
    radiusNormal: 3.5, // End post
    radiusLarge: 4.5,  // Corner/Gate post
  },

  // Spacing (points)
  spacing: {
    titleBlockHeight: 50,
    legendWidth: 110,
    padding: 20,
    marginSmall: 5,
    marginNormal: 10,
  },
};

export const PAPER = {
  // Letter landscape (11" × 8.5")
  width: 11 * 72,      // 792 points
  height: 8.5 * 72,    // 612 points
  margin: 20,          // Points
};

export const MAP_VIEWPORT = {
  // Calculate from PAPER dimensions
  get x() {
    return PAPER.margin + STYLES.spacing.legendWidth + 10;
  },
  get y() {
    return PAPER.margin + STYLES.spacing.titleBlockHeight + 10;
  },
  get width() {
    return PAPER.width - PAPER.margin * 2 - STYLES.spacing.legendWidth - 20;
  },
  get height() {
    return PAPER.height - PAPER.margin * 2 - STYLES.spacing.titleBlockHeight - 20;
  },
};