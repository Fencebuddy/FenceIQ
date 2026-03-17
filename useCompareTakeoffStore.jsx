/**
 * COMPARE TAKEOFF STORE
 * Manages variant takeoffs (a, b, c) per job
 * Atomic writes + localStorage persistence
 * Pure + deterministic
 */

import { create } from "zustand";

export const useCompareTakeoffStore = create((set, get) => ({
  compareByJobId: {},

  /**
   * Get comparison record for a job
   * @param {string} jobId
   * @returns {Object|null} { a, b, c, inputsHash, timestamp }
   */
  getCompare: (jobId) => get().compareByJobId?.[jobId] || null,

  /**
   * ATOMIC write: always set {a, b, c} together
   * @param {string} jobId
   * @param {Object} record - { a: {...}, b: {...}, c: {...}, inputsHash, ... }
   */
  setCompare: (jobId, record) => {
    const updated = {
      a: record?.a ?? null,
      b: record?.b ?? null,
      c: record?.c ?? null,
      inputsHash: record?.inputsHash ?? null,
      timestamp: new Date().toISOString()
    };

    set((state) => ({
      compareByJobId: {
        ...state.compareByJobId,
        [jobId]: updated
      }
    }));

    // Persist to localStorage in ONE write (prevents overwrites)
    try {
      localStorage.setItem(`takeoff_compare_${jobId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn("[CompareTakeoffStore] Failed to persist to localStorage:", e);
    }
  },

  /**
   * Load from localStorage into memory (fallback on refresh)
   * @param {string} jobId
   * @returns {Object|null} Loaded record or null
   */
  loadCompareFromLocalStorage: (jobId) => {
    try {
      const raw = localStorage.getItem(`takeoff_compare_${jobId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);

      set((state) => ({
        compareByJobId: {
          ...state.compareByJobId,
          [jobId]: parsed
        }
      }));

      return parsed;
    } catch (e) {
      console.warn("[CompareTakeoffStore] Failed to load from localStorage:", e);
      return null;
    }
  },

  /**
   * Clear comparison data for a job
   * @param {string} jobId
   */
  clearCompare: (jobId) => {
    set((state) => {
      const next = { ...state.compareByJobId };
      delete next[jobId];
      return { compareByJobId: next };
    });

    try {
      localStorage.removeItem(`takeoff_compare_${jobId}`);
    } catch (e) {
      console.warn("[CompareTakeoffStore] Failed to clear job:", e);
    }
  }
}));