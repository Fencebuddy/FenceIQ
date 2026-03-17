/**
 * FenceBuddy Color Scheme & Design System
 * Based on production app design (blue/teal/emerald gradient system)
 */

export const FENCE_BUDDY_COLORS = {
  // Primary Blue (headers, primary actions)
  primary: {
    light: '#60a5fa',
    DEFAULT: '#3b82f6',
    dark: '#2563eb',
    darker: '#1d4ed8',
  },
  
  // Teal Accent (secondary actions, highlights)
  teal: {
    light: '#5eead4',
    DEFAULT: '#14b8a6',
    dark: '#0d9488',
  },
  
  // Emerald/Green (success, "Best" tier, positive metrics)
  emerald: {
    light: '#34d399',
    DEFAULT: '#10b981',
    dark: '#059669',
    darker: '#047857',
  },
  
  // Purple ("Better" tier, mid-level options)
  purple: {
    light: '#c084fc',
    DEFAULT: '#a855f7',
    dark: '#9333ea',
  },
  
  // Warning/Amber (alerts, incomplete states)
  amber: {
    DEFAULT: '#f59e0b',
    dark: '#d97706',
  },
  
  // Danger/Red (errors, delete actions)
  red: {
    DEFAULT: '#ef4444',
    dark: '#dc2626',
  },
  
  // Neutral Slate (backgrounds, text)
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    500: '#64748b',
    700: '#334155',
    900: '#0f172a',
  }
};

// Good/Better/Best Tier Colors
export const TIER_DESIGN = {
  GOOD: {
    name: 'Good',
    badge: 'GOOD',
    bgGradient: 'from-blue-50 to-blue-100',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-900',
    badgeBg: 'bg-blue-500',
    cardGradient: 'from-blue-400 to-blue-600',
    priceColor: 'text-blue-700',
    hoverShadow: 'hover:shadow-blue-200',
  },
  BETTER: {
    name: 'Better',
    badge: 'BETTER',
    bgGradient: 'from-purple-50 to-purple-100',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-900',
    badgeBg: 'bg-purple-500',
    cardGradient: 'from-purple-400 to-purple-600',
    priceColor: 'text-purple-700',
    hoverShadow: 'hover:shadow-purple-200',
    popular: true, // Show "Most Popular" badge
  },
  BEST: {
    name: 'Best',
    badge: 'BEST',
    bgGradient: 'from-emerald-50 to-emerald-100',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-900',
    badgeBg: 'bg-emerald-500',
    cardGradient: 'from-emerald-400 to-emerald-600',
    priceColor: 'text-emerald-700',
    hoverShadow: 'hover:shadow-emerald-200',
  }
};

// Dashboard KPI Colors
export const KPI_COLORS = {
  appointments: '#3b82f6',    // Blue
  demos: '#8b5cf6',          // Purple
  sold: '#10b981',           // Green
  revenue: '#10b981',        // Green
  margin: '#f59e0b',         // Amber
  closeRate: '#6366f1',      // Indigo
  upsell: '#059669',         // Dark emerald
  integrity: '#10b981',      // Green
};

// Button Variants
export const BUTTON_STYLES = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  outline: 'border border-slate-300 bg-white hover:bg-slate-50',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
};

// Card Styles
export const CARD_STYLES = {
  default: 'bg-white border-slate-200 shadow-md',
  primary: 'bg-white border-blue-200 shadow-md',
  success: 'bg-emerald-50 border-emerald-200',
  warning: 'bg-amber-50 border-amber-200',
  error: 'bg-red-50 border-red-200',
};

// Gradient Backgrounds
export const GRADIENTS = {
  header: 'bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500',
  pageBackground: 'bg-gradient-to-br from-slate-50 to-slate-100',
  priceCard: 'bg-gradient-to-br from-white to-slate-50',
  successCard: 'bg-gradient-to-br from-emerald-600 to-emerald-700',
  blueCard: 'bg-gradient-to-br from-blue-600 to-blue-700',
  tierHeader: 'bg-gradient-to-r from-blue-400 via-teal-400 to-green-400',
};

export default FENCE_BUDDY_COLORS;