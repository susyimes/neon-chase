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
 *
 * Cadence clock rules (playtest PARTIAL fixes):
 * - `lastPitLipX <= 0` means **no lethal pit yet**. Do not treat world origin
 *   as a pit — that delayed the first hole until ~1200px / 32m.
 * - Only **2-tile** holes tick the spacing clock. 1-tile hops must not reset
 *   it, or mid/late never densify.
 * - After the 2s runway, the first lethal pit is the next pad lip.
 */
export const PIT_SAFE_RUNWAY_SECONDS = 2;
export const PIT_SAFE_RUNWAY_PX = WALKABLE_PAD_AUTO_RUN * PIT_SAFE_RUNWAY_SECONDS;

/** Early band: sparse hops, still some risk. Ends around 12s of travel. */
export const PIT_EARLY_UNTIL_PX = WALKABLE_PAD_AUTO_RUN * 12;
/** Mid band: denser 2-tile pits. After this is late. */
export const PIT_MID_UNTIL_PX = WALKABLE_PAD_AUTO_RUN * 28;

export const PIT_INJECT_TILES = 2;

export type PitBand = "runway" | "early" | "mid" | "late";
export type SpacingBand = Exclude<PitBand, "runway">;

/** Minimum travel since the last **lethal** pit lip before another pit is allowed. */
export const PIT_MIN_SPACING_PX = {
  early: WALKABLE_PAD_AUTO_RUN * 3.2,
  mid: WALKABLE_PAD_AUTO_RUN * 1.8,
  late: WALKABLE_PAD_AUTO_RUN * 1.2,
} as const;

/** If the last lethal pit is farther than this, inject a 2-tile hole even when authored 0. */
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

/** 2-tile holes are the only death pits; 1-tile is a coyote-walkable hop. */
export function isLethalPit(gap: number): boolean {
  return gap >= PIT_INJECT_TILES;
}

/**
 * Resolve an authored Jev/fallback gap against the cadence clock.
 * `lipX` is the world X of the pad's trailing edge (where the hole would start).
 * `lastPitLipX` is the trailing edge of the previous **lethal** hole (≤0 = none yet).
 */
export function shapeGap(authored: number, lipX: number, lastPitLipX: number): GapChoice {
  const band = pitBandAt(lipX);
  if (band === "runway") return 0;

  const authoredGap: GapChoice = authored === 1 || authored === 2 ? authored : 0;

  // First readable death pit: first pad lip past the 2s runway.
  if (lastPitLipX <= 0) return PIT_INJECT_TILES;

  const since = lipX - lastPitLipX;
  const min = PIT_MIN_SPACING_PX[band];
  const target = PIT_TARGET_SPACING_PX[band];

  if (since < min) return 0;
  if (authoredGap === 2) return 2;
  // Keep early 1-tile hops; late upgrades them so they are not coyote-walkable.
  if (authoredGap === 1) return band === "late" ? 2 : 1;
  if (since >= target) return 2;
  return 0;
}

export type WalkedPad = {
  index: number;
  startX: number;
  lipX: number;
  gap: GapChoice;
  band: PitBand;
};

/**
 * Uncapped walk of 6-tile solids through `shapeGap`. Used by tests / debug dumps.
 * Game fallbacks should author gap 0 and let `TerrainWorld` keep the clock.
 */
export function walkPacedStreet(padCount: number, fromX = 0, lastPitLipX = 0): WalkedPad[] {
  const n = Math.max(1, Math.floor(padCount));
  const padPx = WALKABLE_PAD_TILES * WALKABLE_PAD_TILE_PX;
  let cursor = Math.max(0, fromX);
  let lastPit = lastPitLipX;
  const out: WalkedPad[] = [];
  for (let i = 0; i < n; i += 1) {
    const lipX = cursor + padPx;
    const gap = shapeGap(0, lipX, lastPit);
    if (isLethalPit(gap)) lastPit = lipX;
    out.push({
      index: i,
      startX: cursor,
      lipX,
      gap,
      band: pitBandAt(lipX),
    });
    cursor = lipX + gap * WALKABLE_PAD_TILE_PX;
  }
  return out;
}

/** Flat solids (gap 0). `TerrainWorld.shapeGap` is the cadence clock. */
export function blankSolidSpecs(count: number): TerrainSegmentSpec[] {
  const n = Math.max(1, Math.min(16, Math.floor(count)));
  return Array.from({ length: n }, () => ({
    surface: "solid" as const,
    width: WALKABLE_PAD_TILES,
    gap: 0 as const,
    height: 5 as const,
  }));
}

/** Flat solids with cadence-shaped gaps — local / Jev-timeout streets. */
export function pacedSolidSpecs(count: number, fromX = 0, lastPitLipX = 0): TerrainSegmentSpec[] {
  const n = Math.max(1, Math.min(16, Math.floor(count)));
  return walkPacedStreet(n, fromX, lastPitLipX).map((pad) => ({
    surface: "solid" as const,
    width: WALKABLE_PAD_TILES,
    gap: pad.gap,
    height: 5 as const,
  }));
}

export type BandSpacing = {
  band: SpacingBand;
  count: number;
  meanPx: number;
  meanSeconds: number;
  lips: number[];
};

export type PitCadenceReport = {
  firstPitLipX: number;
  firstPitDistanceTiles: number;
  firstPitTravelSecondsFromOrigin: number;
  runwayClear: boolean;
  gaps: GapChoice[];
  lethalLips: number[];
  bands: Record<SpacingBand, BandSpacing>;
};

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Continuous street through late. Evidence that early → mid → late densifies. */
export function measureLethalPitCadence(padCount = 72): PitCadenceReport {
  const pads = walkPacedStreet(padCount);
  const lethal = pads.filter((pad) => isLethalPit(pad.gap));
  const first = lethal[0];
  const firstPitLipX = first?.lipX ?? -1;
  const gaps = pads.map((pad) => pad.gap);

  const bandOf = (x: number): SpacingBand | null => {
    const band = pitBandAt(x);
    return band === "runway" ? null : band;
  };

  const lipsByBand: Record<SpacingBand, number[]> = { early: [], mid: [], late: [] };
  for (const pad of lethal) {
    const band = bandOf(pad.lipX);
    if (band) lipsByBand[band].push(pad.lipX);
  }

  const spacingFor = (band: SpacingBand): BandSpacing => {
    const lips = lipsByBand[band];
    const deltas: number[] = [];
    for (let i = 1; i < lips.length; i += 1) deltas.push(lips[i] - lips[i - 1]);
    // Include the handoff from the previous band's last pit when present.
    if (lips.length) {
      const prevBand: SpacingBand | null = band === "late" ? "mid" : band === "mid" ? "early" : null;
      const prevLips = prevBand ? lipsByBand[prevBand] : [];
      const prev = prevLips.at(-1);
      if (prev != null) deltas.unshift(lips[0] - prev);
    }
    const meanPx = mean(deltas);
    return {
      band,
      count: lips.length,
      meanPx: Number(meanPx.toFixed(1)),
      meanSeconds: Number((meanPx / WALKABLE_PAD_AUTO_RUN).toFixed(2)),
      lips,
    };
  };

  return {
    firstPitLipX,
    firstPitDistanceTiles: firstPitLipX < 0 ? -1 : Math.floor(firstPitLipX / WALKABLE_PAD_TILE_PX),
    firstPitTravelSecondsFromOrigin: firstPitLipX < 0 ? -1 : Number((firstPitLipX / WALKABLE_PAD_AUTO_RUN).toFixed(2)),
    runwayClear: pads.filter((pad) => pad.band === "runway").every((pad) => pad.gap === 0),
    gaps,
    lethalLips: lethal.map((pad) => pad.lipX),
    bands: {
      early: spacingFor("early"),
      mid: spacingFor("mid"),
      late: spacingFor("late"),
    },
  };
}
