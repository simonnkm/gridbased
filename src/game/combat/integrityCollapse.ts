import type { RaidLayerId } from "../raid/types";

export const INTEGRITY_COLLAPSE_THRESHOLDS: Record<RaidLayerId, number> = {
  outer: 0.75,
  mid: 0.5,
  inner: 0.25
};

export function getIntegrityCollapseBand(integrityRatio: number): RaidLayerId | "core" {
  if (integrityRatio <= INTEGRITY_COLLAPSE_THRESHOLDS.inner) {
    return "core";
  }

  if (integrityRatio <= INTEGRITY_COLLAPSE_THRESHOLDS.mid) {
    return "inner";
  }

  if (integrityRatio <= INTEGRITY_COLLAPSE_THRESHOLDS.outer) {
    return "mid";
  }

  return "outer";
}

