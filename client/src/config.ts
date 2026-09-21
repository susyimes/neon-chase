import {
  WALKABLE_PAD_AUTO_RUN,
  WALKABLE_PAD_SECONDS as SHARED_PAD_SECONDS,
  WALKABLE_PAD_TILE_PX,
  WALKABLE_PAD_TILES as SHARED_PAD_TILES,
} from "@shared/pads.ts";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const TILE = 40;

export const AUTO_RUN = 230;
export const STRAFE = 170;
export const JUMP_V = -520;
export const GRAVITY = 1500;
export const DASH_V = 520;
export const DASH_MS = 160;
export const DASH_COOLDOWN_MS = 700;
export const IFRAME_MS = 900;
export const HUNTER_TICK_MS = 400;
/** Hunter sprite, AI ticks, collision, and near-miss urgency. Off for the calm runner. */
export const HUNTERS_ENABLED = false;
/**
 * Spike keep rates vs the previous spawn rules (about 1/3 or less).
 * Surfaces: keep every Nth Jev spike slab (`1 / SPIKE_SURFACE_KEEP`).
 * Extra nubs: at most one tooth, and only every Nth eligible slab.
 * Ambush set-piece: one 3-tile spike instead of two slabs (5+3 tiles).
 */
export const SPIKE_SURFACE_KEEP = 1 / 3;
export const SPIKE_NUB_KEEP = 1 / 3;
/**
 * Minimum walkable pad dwell at typical auto-run.
 *   WALKABLE_PAD_PX    = AUTO_RUN × WALKABLE_PAD_SECONDS
 *   WALKABLE_PAD_TILES = ceil(WALKABLE_PAD_PX / TILE)
 * Keep AUTO_RUN / TILE equal to the twins in `shared/pads.ts`.
 */
export const WALKABLE_PAD_SECONDS = SHARED_PAD_SECONDS;
export const WALKABLE_PAD_PX = AUTO_RUN * WALKABLE_PAD_SECONDS;
export const WALKABLE_PAD_TILES = Math.max(
  SHARED_PAD_TILES,
  Math.ceil(WALKABLE_PAD_PX / TILE),
);
/** `?pads=1` paints tile-count + dwell labels on each built pad (playtest). */
export const DEBUG_PAD_LABELS =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("pads");

if (AUTO_RUN !== WALKABLE_PAD_AUTO_RUN || TILE !== WALKABLE_PAD_TILE_PX) {
  console.warn(
    `[pads] AUTO_RUN/TILE (${AUTO_RUN}/${TILE}) drifted from shared/pads.ts ` +
      `(${WALKABLE_PAD_AUTO_RUN}/${WALKABLE_PAD_TILE_PX}). Client clamp still uses local speed.`,
  );
}
export const JEV_TIMEOUT_MS = 800;
export const BUFFER_SCREENS = 2;
export const TERRAIN_BATCH = 2;
export const MAX_HP = 3;
export const ORB_SCORE = 50;

export const COYOTE_MS = 90;
export const JUMP_BUFFER_MS = 110;
export const DASH_BUFFER_MS = 80;
export const COMBO_WINDOW_MS = 1700;
export const COMBO_BONUS = 12;
export const NEAR_MISS_PX = 76;
export const MUTE_STORAGE_KEY = "neon-chase-mute";

export const API_BASE = "/api";
