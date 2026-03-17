/**
 * SAFE MATH UTILITIES
 * Non-negotiable guardrails for KPI calculations
 * Prevents divide-by-zero explosions and ratio hallucinations
 */

/**
 * Safe divide with null fallback
 */
export function safeDivide(numerator, denominator) {
    if (denominator === null || denominator === undefined || denominator <= 0) {
        return null;
    }
    return numerator / denominator;
}

/**
 * Safe percentage calculation
 */
export function safePct(numerator, denominator) {
    const ratio = safeDivide(numerator, denominator);
    if (ratio === null) return null;
    return ratio * 100;
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Format ratio for display with fallback for insufficient data
 */
export function safeRatioLabel(value, formatter = (v) => `${v.toFixed(1)}%`) {
    if (value === null || value === undefined) {
        return 'INSUFFICIENT_DATA';
    }
    return formatter(value);
}

/**
 * Safe mean calculation
 */
export function safeMean(values) {
    if (!values || values.length === 0) return null;
    const sum = values.reduce((acc, val) => acc + (val || 0), 0);
    return safeDivide(sum, values.length);
}

/**
 * Check if value is valid for calculations
 */
export function isValidMetric(value) {
    return value !== null && value !== undefined && !isNaN(value) && isFinite(value);
}

/**
 * Clamp percentage to reasonable range (0-150%)
 */
export function clampPercentage(pct) {
    if (!isValidMetric(pct)) return null;
    return clamp(pct, 0, 150);
}