import { MappingEngineError } from "./errors";

export function qtyFromLinearFeet(lf, unit = "lf") {
  if (!Number.isFinite(lf) || lf < 0) throw new MappingEngineError("lf must be >= 0", { lf });
  return { qty: lf, unitType: unit };
}

export function qtyCount(count, unit = "each") {
  if (!Number.isFinite(count) || count < 0) throw new MappingEngineError("count must be >= 0", { count });
  return { qty: Math.round(count), unitType: unit };
}

export function chainlinkToprailQtyFromRuns(totalLf) {
  return qtyFromLinearFeet(totalLf, "lf");
}

export function chainlinkFabricQtyFromRuns(totalLf) {
  return qtyFromLinearFeet(totalLf, "lf");
}