import { safeDirector } from "@shared/defaults.ts";
import { blankSolidSpecs } from "@shared/pits.ts";
import type {
  DecideRequest,
  DecideResponse,
  TerrainSegmentSpec,
} from "@shared/types.ts";

/**
 * Opening street + local fallback. Specs stay gap-0; `TerrainWorld.shapeGap`
 * is the cadence clock so later batches do not reset `lastPit` to 0.
 */
export function safeSpecs(count: number): TerrainSegmentSpec[] {
  return blankSolidSpecs(count);
}

export function localFallback(req: DecideRequest, warning: string): DecideResponse {
  const n = req.ask.terrainSegments ?? 0;
  const wantHunter = Boolean(req.ask.hunter);
  return {
    ok: false,
    source: "fallback",
    latencyMs: 0,
    warning,
    error: warning,
    terrain: n > 0 ? safeSpecs(n) : [],
    hunterMove: wantHunter ? "chase" : undefined,
    director: safeDirector({
      hunter: wantHunter,
      motif: req.state?.motif,
      lastEvent: req.state?.lastEvent,
    }),
  };
}
