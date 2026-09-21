/**
 * Walkable landing-pad length.
 *
 * Typical travel speed is the client's auto-run (`AUTO_RUN` = 230 px/s in
 * `client/src/config.ts`). Tile size is `TILE` = 40 px. Those numeric twins
 * are repeated here so the Jev proxy can author the same floor without
 * importing the Phaser client.
 *
 * Formula:
 *   WALKABLE_PAD_PX    = AUTO_RUN × WALKABLE_PAD_SECONDS
 *                      = 230 px/s × 1.0 s
 *                      = 230 px
 *   WALKABLE_PAD_TILES = ceil(WALKABLE_PAD_PX / TILE)
 *                      = ceil(230 / 40)
 *                      = 6 tiles
 *   built width        = max(authoredTiles, WALKABLE_PAD_TILES) × TILE
 *                      = 240 px ≈ 1.04 s at auto-run
 *
 * Jev width choices are all at or above this floor (6 / 8 / 10 tiles ≈
 * 1.04 s / 1.39 s / 1.74 s). Gaps stay 0–2 tiles. Spike slabs are hazards,
 * not landing pads, and are not stretched.
 */
export const WALKABLE_PAD_SECONDS = 1;
export const WALKABLE_PAD_AUTO_RUN = 230;
export const WALKABLE_PAD_TILE_PX = 40;
export const WALKABLE_PAD_PX = WALKABLE_PAD_AUTO_RUN * WALKABLE_PAD_SECONDS;
export const WALKABLE_PAD_TILES = Math.ceil(WALKABLE_PAD_PX / WALKABLE_PAD_TILE_PX);

/** Jev `width` choices. Shortest value is the 1-second floor. */
export const WALKABLE_WIDTHS = [WALKABLE_PAD_TILES, 8, 10] as const;
export type WalkableWidth = (typeof WALKABLE_WIDTHS)[number];

/** Older Jev answers (2 / 3 / 5 stub tiles) map onto the new 1s+ scale. */
export const LEGACY_WIDTH_TO_WALKABLE: Record<number, WalkableWidth> = {
  2: 6,
  3: 8,
  5: 10,
};

export function isWalkableSurface(surface: string): boolean {
  return surface === "solid" || surface === "ledge";
}

/** Pixel width for a walkable pad. Spikes keep their authored tile count. */
export function walkableWidthPx(
  authoredTiles: number,
  surface: string,
  tilePx = WALKABLE_PAD_TILE_PX,
): number {
  const authored = Math.max(1, authoredTiles) * tilePx;
  if (!isWalkableSurface(surface)) return authored;
  return Math.max(authored, WALKABLE_PAD_PX, WALKABLE_PAD_TILES * tilePx);
}

export function walkableDwellSeconds(widthPx: number, speedPx = WALKABLE_PAD_AUTO_RUN): number {
  return widthPx / speedPx;
}
