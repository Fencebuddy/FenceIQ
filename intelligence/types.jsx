/**
 * EXECUTIVE INTELLIGENCE ENGINE TYPES
 * Core types for the decision intelligence layer
 */

/**
 * @typedef {Object} ExecutiveIntel
 * @property {string} why_summary - Single sentence explaining primary driver of current state
 * @property {"LOW"|"MED"|"HIGH"} risk_level - Risk classification
 * @property {string} risk_reason - Short reason for risk level
 * @property {{title: string, why: string}|null} next_best_action - Recommended action or null
 */

/**
 * @typedef {Object} ExecutiveState
 * @property {string} company_state - DOMINANT|STRONG|STABLE|CAUTION|AT_RISK|INSUFFICIENT_DATA
 * @property {string[]} flight_brief - Max 3 bullets
 * @property {Array} alerts - Risk/watch alerts
 * @property {number} confidence_score - 0-100
 * @property {string} confidence_label - MAXIMUM|HIGH|GUARDED|UNSTABLE
 * @property {string} trajectory - ASCENDING|LEVEL|DECLINING|VOLATILE
 * @property {ExecutiveIntel} intel - Decision intelligence layer
 */

// Types exported as JSDoc for JavaScript