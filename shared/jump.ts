import { WALKABLE_PAD_AUTO_RUN, WALKABLE_PAD_TILE_PX } from "./pads.ts";

/**
 * Same-height jump knobs. The Phaser client re-exports these in
 * `client/src/config.ts` so play and assertions cannot drift.
 *
 * Chosen fix for 2-tile (80px) pits (playtest PARTIAL):
 * keep injected pits at 2 tiles (1-tile is coyote-walkable), and give the
 * normal jump enough air time that a takeoff from the last ~80px of the pad
 * — or a coyote jump just past the lip — lands on the far pad. A jump from
 * pad-center still misses, so pits stay a real read, not a free hop.
 *
 *   JUMP_VELOCITY -520 → -580  (air ~0.77s, ~178px at auto-run)
 *   COYOTE          90 → 140ms
 *   JUMP_BUFFER    110 → 130ms
 */
export const JUMP_VELOCITY = -580;
export const JUMP_GRAVITY = 1500;
export const JUMP_COYOTE_MS = 140;
export const JUMP_BUFFER_MS = 130;

/** Phaser `setSize(20, 30)` then sprite scale 1.18. */
export const PLAYER_BODY_WIDTH_PX = 24;

export const PIT_CLEAR_TILES = 2;
export const PIT_CLEAR_WIDTH_PX = PIT_CLEAR_TILES * WALKABLE_PAD_TILE_PX;

/** Arcade integrates gravity then position at ~60fps. */
const SIM_DT = 1 / 60;
const SIM_SLOP_PX = 2;

/** Horizontal travel while airborne on a same-height jump (discrete Arcade). */
export function jumpRangePx(speedPx = WALKABLE_PAD_AUTO_RUN): number {
  let x = 0;
  let y = 0;
  let vy = JUMP_VELOCITY;
  for (let frame = 0; frame < 180; frame += 1) {
    vy += JUMP_GRAVITY * SIM_DT;
    y += vy * SIM_DT;
    x += speedPx * SIM_DT;
    if (frame > 1 && y >= 0) return x;
  }
  return x;
}

export function coyoteTravelPx(
  speedPx = WALKABLE_PAD_AUTO_RUN,
  coyoteMs = JUMP_COYOTE_MS,
): number {
  return speedPx * (coyoteMs / 1000);
}

export interface JumpClearInput {
  /** Body-center distance before the pit lip at takeoff. 0 = center on the lip. */
  behindLipPx: number;
  /** Extra travel past the lip before a coyote jump. */
  coyotePastLipPx?: number;
  pitPx?: number;
  speedPx?: number;
  bodyWidthPx?: number;
}

/**
 * Same-height pit. Clears when the body's left edge overlaps the far pad
 * by at least `SIM_SLOP_PX` (Arcade land).
 */
export function clearsSameHeightPit(input: JumpClearInput): boolean {
  const pit = input.pitPx ?? PIT_CLEAR_WIDTH_PX;
  const speed = input.speedPx ?? WALKABLE_PAD_AUTO_RUN;
  const body = input.bodyWidthPx ?? PLAYER_BODY_WIDTH_PX;
  const past = input.coyotePastLipPx ?? 0;
  const endCenter = -input.behindLipPx + past + jumpRangePx(speed);
  const leftEdge = endCenter - body / 2;
  return leftEdge >= pit - SIM_SLOP_PX;
}

export function jumpClearanceDump(speedPx = WALKABLE_PAD_AUTO_RUN) {
  const range = jumpRangePx(speedPx);
  const coyote = coyoteTravelPx(speedPx);
  const cases = {
    fromEdge: clearsSameHeightPit({ behindLipPx: PLAYER_BODY_WIDTH_PX / 2, speedPx }),
    fromApproachTile: clearsSameHeightPit({ behindLipPx: WALKABLE_PAD_TILE_PX, speedPx }),
    fromTwoTilesBack: clearsSameHeightPit({ behindLipPx: PIT_CLEAR_WIDTH_PX, speedPx }),
    coyoteLate: clearsSameHeightPit({
      behindLipPx: 0,
      coyotePastLipPx: coyote * 0.85,
      speedPx,
    }),
    fromPadCenter: clearsSameHeightPit({ behindLipPx: 120, speedPx }),
  };
  return {
    jumpVelocity: JUMP_VELOCITY,
    gravity: JUMP_GRAVITY,
    coyoteMs: JUMP_COYOTE_MS,
    pitPx: PIT_CLEAR_WIDTH_PX,
    rangePx: Number(range.toFixed(1)),
    coyotePx: Number(coyote.toFixed(1)),
    cases,
  };
}
