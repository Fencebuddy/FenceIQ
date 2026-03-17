/**
 * Print-safe styling constants for field documents
 */

export const STYLES = {
  // Colors
  colors: {
    fence: '#1a472a',      // Dark green for fences
    post: '#2d5a3d',       // Post green
    post_corner: '#d4a574', // Corner post tan
    post_end: '#b8956a',   // End post tan
    structure: '#4a4a4a',  // Dark gray
    tree: '#558840',       // Tree green
    annotation: '#0066cc', // Blue for annotations
    text_dark: '#000000',
    text_light: '#666666',
    text_label: '#333333',
    background: '#ffffff',
    grid: '#e0e0e0'
  },

  // Line weights (in points/mm)
  lineWeights: {
    fence: 0.5,
    post: 0.3,
    structure: 0.4,
    annotation: 0.3,
    dimension: 0.2,
    border: 0.5
  },

  // Font sizes (in points)
  fonts: {
    title: 24,
    subtitle: 18,
    heading: 14,
    label: 10,
    small: 8,
    tiny: 6
  },

  // Sizes
  sizes: {
    post: 8,        // Post symbol size in points
    tree: 12,       // Tree symbol size
    structure: 10   // Structure symbol size
  },

  // Spacing
  spacing: {
    title: 15,      // Space after title
    section: 10,    // Space between sections
    padding: 10,    // General padding
    margin: 5       // Margin between elements
  }
};

export const PAPER = {
  width_mm: 210,     // A4 width
  height_mm: 297,    // A4 height
  width_pt: 595.276, // Points
  height_pt: 841.890,
  margin_top: 15,
  margin_bottom: 15,
  margin_left: 15,
  margin_right: 15
};

export const MAP_VIEWPORT = {
  left: PAPER.margin_left,
  top: PAPER.margin_top + 50,  // Space for title block
  right: PAPER.width_mm - PAPER.margin_right,
  bottom: PAPER.height_mm - PAPER.margin_bottom - 30, // Space for legend
  get width() {
    return this.right - this.left;
  },
  get height() {
    return this.bottom - this.top;
  }
};