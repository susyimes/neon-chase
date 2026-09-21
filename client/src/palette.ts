import type { MotifKind } from "@shared/types.ts";

export interface MotifPalette {
  id: MotifKind;
  skyTop: number;
  skyBot: number;
  far: number;
  mid: number;
  near: number;
  window: number;
  fog: number;
  plat: number;
  platEdge: number;
  spike: number;
  orb: number;
  accent: number;
}

export const MOTIF_PALETTES: Record<MotifKind, MotifPalette> = {
  neon_alley: {
    id: "neon_alley",
    skyTop: 0x050510,
    skyBot: 0x140818,
    far: 0x0a1020,
    mid: 0x0c1830,
    near: 0x101828,
    window: 0x00f0ff,
    fog: 0xff2bd6,
    plat: 0x2a5d8c,
    platEdge: 0x00f0ff,
    spike: 0xff2bd6,
    orb: 0x00f0ff,
    accent: 0xff2bd6,
  },
  rooftop: {
    id: "rooftop",
    skyTop: 0x040818,
    skyBot: 0x0a1838,
    far: 0x081428,
    mid: 0x0c2040,
    near: 0x122848,
    window: 0x7ad7ff,
    fog: 0x4f8cff,
    plat: 0x1a3858,
    platEdge: 0x7ad7ff,
    spike: 0xff5aa8,
    orb: 0xb8f4ff,
    accent: 0x7ad7ff,
  },
  underpass: {
    id: "underpass",
    skyTop: 0x08060c,
    skyBot: 0x1a0e18,
    far: 0x120814,
    mid: 0x1a101c,
    near: 0x22141e,
    window: 0xffaa44,
    fog: 0x9b4cff,
    plat: 0x3a2438,
    platEdge: 0xffaa44,
    spike: 0xff2bd6,
    orb: 0xffd27a,
    accent: 0x9b4cff,
  },
};

export const CYAN = 0x00f0ff;
export const MAGENTA = 0xff2bd6;
export const GOLD = 0xffcc55;
export const INK = 0x050510;
