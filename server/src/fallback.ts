import { safeDirector } from "../../shared/defaults.ts";
import { blankSolidSpecs } from "../../shared/pits.ts";
import type {
  DecideRequest,
  DecideResponse,
  HunterMove,
  TerrainSegmentSpec,
} from "../../shared/types.ts";

/** Local street when Jev is missing, slow, or errors. Pits follow `shared/pits.ts`. */
export function safeTerrain(count: number): TerrainSegmentSpec[] {
  const n = Math.max(1, Math.min(3, Math.floor(count)));
  return blankSolidSpecs(n);
}

export function safeHunterMove(): HunterMove {
  return "chase";
}

export function fallbackResult(
  req: Pick<DecideRequest, "ask" | "state">,
  started: number,
  warning: string,
): DecideResponse {
  const n = req.ask.terrainSegments ?? 0;
  const wantHunter = Boolean(req.ask.hunter);
  const director = safeDirector({
    hunter: wantHunter,
    motif: req.state?.motif,
    lastEvent: req.state?.lastEvent,
  });
  return {
    ok: false,
    source: "fallback",
    latencyMs: Date.now() - started,
    warning,
    error: warning,
    terrain: n > 0 ? safeTerrain(n) : [],
    hunterMove: wantHunter ? safeHunterMove() : undefined,
    director,
  };
}
