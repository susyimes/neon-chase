import { safeDirector } from "@shared/defaults.ts";
import { pacedSolidSpecs } from "@shared/pits.ts";
import type {
  DecideRequest,
  DecideResponse,
  TerrainSegmentSpec,
} from "@shared/types.ts";

/** Opening street + local fallback. Cadence-shaped pits live in `shared/pits.ts`. */
export function safeSpecs(count: number, fromX = 0): TerrainSegmentSpec[] {
  return pacedSolidSpecs(count, fromX);
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
    terrain: n > 0 ? safeSpecs(n, req.state?.player?.x ?? 0) : [],
    hunterMove: wantHunter ? "chase" : undefined,
    director: safeDirector({
      hunter: wantHunter,
      motif: req.state?.motif,
      lastEvent: req.state?.lastEvent,
    }),
  };
}
