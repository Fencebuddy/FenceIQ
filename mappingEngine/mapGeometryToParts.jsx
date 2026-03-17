import { MappingEngineError } from "./errors";
import { assertNonNeg, assertString } from "./validators";
import { qtyFromLinearFeet, qtyCount, chainlinkToprailQtyFromRuns, chainlinkFabricQtyFromRuns } from "./quantityRules";

/**
 * Map geometry to part requests (schema type + params + qty)
 * NO keys generated here - only schema references
 */
export function mapGeometryToParts({ job, geometry, selections }) {
  if (!geometry) throw new MappingEngineError("geometry required", { geometry });
  if (!selections) throw new MappingEngineError("selections required", { selections });

  const system = assertString(selections.system || job?.system || job?.materialType, "system").toLowerCase();
  const heightIn = selections.heightIn ?? job?.fenceHeightIn ?? job?.fenceHeight ?? null;
  const color = selections.color ?? selections.finish ?? job?.color ?? job?.finishColor ?? null;
  const style = selections.style ?? job?.style ?? null;

  const runs = Array.isArray(geometry.runs) ? geometry.runs : [];
  const gates = Array.isArray(geometry.gates) ? geometry.gates : [];
  const posts = Array.isArray(geometry.posts) ? geometry.posts : [];

  const totalLf = runs.reduce((sum, r) => sum + (Number(r.lengthLf) || 0), 0);
  const effectiveLf = (runs.length > 0 && totalLf <= 0) ? 1 : totalLf;

  const partRequests = [];

  if (system === "chainlink") {
    if (runs.length > 0) {
      const f = chainlinkFabricQtyFromRuns(effectiveLf);
      partRequests.push({
        system: "chainlink",
        type: "fabric",
        params: { heightIn, color },
        ...f
      });

      const tr = chainlinkToprailQtyFromRuns(effectiveLf);
      partRequests.push({
        system: "chainlink",
        type: "toprail",
        params: { color },
        ...tr
      });
    }

    if (posts.length > 0) {
      const counts = posts.reduce((acc, p) => {
        const role = (p.role || "line").toLowerCase();
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {});
      for (const [role, count] of Object.entries(counts)) {
        const schemaType =
          role === "terminal" ? "postTerminal" :
          role === "gate" ? "postGate" :
          "postLine";
        partRequests.push({
          system: "chainlink",
          type: schemaType,
          params: { heightIn, color },
          ...qtyCount(count, "each")
        });
      }
    }
  }

  if (system === "vinyl") {
    if (runs.length > 0) {
      const panels = Math.ceil(effectiveLf / 8);
      partRequests.push({
        system: "vinyl",
        type: "panelPrivacy",
        params: { heightIn, style: style || "savannah", color },
        ...qtyCount(panels, "each")
      });
    }

    for (const g of gates) {
      const swing = (g.swing || "single").toLowerCase();
      const widthIn = g.widthIn || g.width || 48;
      partRequests.push({
        system: "vinyl",
        type: "gate",
        params: { swing, widthIn, heightIn, color },
        ...qtyCount(1, "each")
      });
    }
  }

  if (runs.length > 0 && partRequests.length === 0) {
    throw new MappingEngineError("Invariant violated: runs exist but no partRequests generated", { system, runsCount: runs.length });
  }

  return { partRequests, metrics: { system, runsCount: runs.length, gatesCount: gates.length, postsCount: posts.length, totalLf, effectiveLf } };
}