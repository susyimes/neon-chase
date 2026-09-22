import { WALKABLE_PAD_AUTO_RUN, WALKABLE_PAD_TILE_PX, WALKABLE_PAD_TILES } from "./pads.ts";
import type { GapChoice, TerrainSegmentSpec } from "./types.ts";

/**
 * Pit / gap cadence vs run distance (world X).
 *
 * Fallback streets used to be gap=0 forever, and Jev is biased toward 0, so
 * players never fell without `__neonChase.die`. This module is the single
 * source of truth for when a hole is allowed, injected, or suppressed.
 *
 * Walkable pad length stays in `pads.ts` (still ~1s). Spike keep-rates stay
 * in `client/src/config.ts`. Gap sizes stay in `types.GAPS` (0–2 tiles).
 *
 * Injected pits are 2 tiles (80px). A 1-tile hole is coyote-walkable with
 * the current body width, so it is only a tiny hop — not a lethal pit.
 */
export const PIT_SAFE_RUNWAY_SECONDS = 2;
export const PIT_SAFE_RUNWAY_PX = WALKABLE_PAD_AUTO_RUN * PIT_SAFE_RUNWAY_SECONDS;

/** Early band: sparse hops, still some risk. Ends around 12s of travel. */
export const PIT_EARLY_UNTIL_PX = WALKABLE_PAD_AUTO_RUN * 12;
/** Mid band: denser 2-tile pits. After this is late. */
export const PIT_MID_UNTIL_PX = WALKABLE_PAD_AUTO_RUN * 28;

export type PitBand = "runway" | "early" | "mid" | "late";

/** Minimum travel since the last pit lip before another pit is allowed. */
export const PIT_MIN_SPACING_PX = {
  early: WALKABLE_PAD_AUTO_RUN * 3.2,
  mid: WALKABLE_PAD_AUTO_RUN * 1.8,
  late: WALKABLE_PAD_AUTO_RUN * 1.2,
} as const;

/** If the last pit is farther than this, inject a 2-tile hole even when authored 0. */
export const PIT_TARGET_SPACING_PX = {
  early: WALKABLE_PAD_AUTO_RUN * 5.0,
  mid: WALKABLE_PAD_AUTO_RUN * 3.2,
  late: WALKABLE_PAD_AUTO_RUN * 2.0,
} as const;

export function pitBandAt(x: number): PitBand {
  if (x < PIT_SAFE_RUNWAY_PX) return "runway";
  if (x < PIT_EARLY_UNTIL_PX) return "early";
  if (x < PIT_MID_UNTIL_PX) return "mid";
  return "late";
}

/**
 * Resolve an authored Jev/fallback gap against the cadence clock.
 * `lipX` is the world X of the pad's trailing edge (where the hole would start).
 * `lastPitLipX` is the trailing edge of the previous hole (0 = none yet).
 */
export function shapeGap(authored: number, lipX: number, lastPitLipX: number): GapChoice {
  const band = pitBandAt(lipX);
  if (band === "runway") return 0;

  const since = lipX - lastPitLipX;
  const min = PIT_MIN_SPACING_PX[band];
  const target = PIT_TARGET_SPACING_PX[band];
  const authoredGap: GapChoice = authored === 1 || authored === 2 ? authored : 0;

  if (since < min) return 0;
  if (authoredGap > 0) return band === "late" ? 2 : authoredGap;
  if (since >= target) return 2;
  return 0;
}

/** Flat solids with cadence-shaped gaps — local / Jev-timeout streets. */
export function pacedSolidSpecs(count: number, fromX = 0): TerrainSegmentSpec[] {
  const n = Math.max(1, Math.min(16, Math.floor(count)));
  const padPx = WALKABLE_PAD_TILES * WALKABLE_PAD_TILE_PX;
  let cursor = Math.max(0, fromX);
  let lastPit = 0;
  const out: TerrainSegmentSpec[] = [];
  for (let i = 0; i < n; i += 1) {
    const lipX = cursor + padPx;
    const gap = shapeGap(0, lipX, lastPit);
    if (gap > 0) lastPit = lipX;
    out.push({
      surface: "solid",
      width: WALKABLE_PAD_TILES,
      gap,
      height: 5,
    });
    cursor = lipX + gap * WALKABLE_PAD_TILE_PX;
  }
  return out;
}
