import Phaser from "phaser";
import { INK } from "../../palette.ts";

function gfx(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({ x: 0, y: 0 }, false);
}

function radial(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  color: number,
  rings = 6,
): void {
  for (let i = rings; i >= 1; i -= 1) {
    const t = i / rings;
    g.fillStyle(color, 0.08 * t * t);
    g.fillCircle(cx, cy, r * t);
  }
}

export function makeGameTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("runner")) return;

  const runner = gfx(scene);
  radial(runner, 18, 22, 20, 0x00f0ff, 5);
  runner.fillStyle(0x00f0ff, 1);
  runner.fillRoundedRect(6, 4, 24, 34, 8);
  runner.fillStyle(0x7af7ff, 0.9);
  runner.fillRoundedRect(8, 6, 20, 8, 4);
  runner.fillStyle(INK, 1);
  runner.fillRect(10, 14, 6, 4);
  runner.fillRect(20, 14, 6, 4);
  runner.fillStyle(0x00f0ff, 1);
  runner.fillRect(14, 24, 8, 2);
  runner.generateTexture("runner", 36, 42);
  runner.destroy();

  const rGlow = gfx(scene);
  radial(rGlow, 24, 26, 24, 0x00f0ff, 7);
  rGlow.generateTexture("runner-glow", 48, 52);
  rGlow.destroy();

  const hunter = gfx(scene);
  radial(hunter, 18, 18, 18, 0xff2bd6, 4);
  hunter.fillStyle(0xff2bd6, 1);
  hunter.fillTriangle(18, 2, 34, 32, 2, 32);
  hunter.fillStyle(INK, 1);
  hunter.fillTriangle(18, 12, 26, 28, 10, 28);
  hunter.fillStyle(0xff9ae8, 1);
  hunter.fillTriangle(18, 8, 22, 16, 14, 16);
  hunter.generateTexture("hunter", 36, 36);
  hunter.destroy();

  const hGlow = gfx(scene);
  radial(hGlow, 24, 24, 24, 0xff2bd6, 7);
  hGlow.generateTexture("hunter-glow", 48, 48);
  hGlow.destroy();

  const orb = gfx(scene);
  radial(orb, 12, 12, 12, 0x00f0ff, 5);
  orb.fillStyle(0xffffff, 1);
  orb.fillCircle(12, 12, 4);
  orb.fillStyle(0x00f0ff, 0.95);
  orb.fillCircle(12, 12, 7);
  orb.lineStyle(2, 0xb8ffff, 0.9);
  orb.strokeCircle(12, 12, 9);
  orb.generateTexture("orb", 24, 24);
  orb.destroy();

  const spark = gfx(scene);
  spark.fillStyle(0xffffff, 1);
  spark.fillCircle(8, 8, 6);
  spark.generateTexture("px-soft", 16, 16);
  spark.destroy();

  const diamond = gfx(scene);
  diamond.fillStyle(0xffffff, 1);
  diamond.fillTriangle(5, 0, 10, 5, 0, 5);
  diamond.fillTriangle(0, 5, 10, 5, 5, 10);
  diamond.generateTexture("px-spark", 10, 10);
  diamond.destroy();

  const streak = gfx(scene);
  streak.fillStyle(0xffffff, 1);
  streak.fillRoundedRect(0, 1, 14, 4, 2);
  streak.generateTexture("px-streak", 14, 6);
  streak.destroy();

  makeSkyline(scene, "sky-far", 640, 160, 0x0a1020, 0x00f0ff, 0.15, 18, 1);
  makeSkyline(scene, "sky-mid", 640, 200, 0x0c1830, 0x00f0ff, 0.35, 14, 2);
  makeSkyline(scene, "sky-near", 640, 140, 0x101828, 0xff2bd6, 0.12, 10, 3);

  const vig = gfx(scene);
  vig.fillStyle(0x000000, 0);
  vig.fillRect(0, 0, 16, 16);
  vig.fillStyle(0x000000, 0.55);
  vig.fillRect(0, 0, 16, 2);
  vig.fillRect(0, 14, 16, 2);
  vig.fillRect(0, 0, 2, 16);
  vig.fillRect(14, 0, 2, 16);
  vig.generateTexture("vignette-edge", 16, 16);
  vig.destroy();
}

function makeSkyline(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  fill: number,
  window: number,
  windowAlpha: number,
  count: number,
  seed: number,
): void {
  const g = gfx(scene);
  let s = seed * 9973 + 13;
  const rand = (): number => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  let x = 0;
  for (let i = 0; i < count; i += 1) {
    const bw = 28 + Math.floor(rand() * 70);
    const bh = 40 + Math.floor(rand() * (h - 36));
    const bx = x + Math.floor(rand() * 12);
    g.fillStyle(fill, 1);
    g.fillRect(bx, h - bh, bw, bh);
    if (rand() > 0.35) {
      g.fillStyle(window, windowAlpha);
      const cols = Math.max(1, Math.floor(bw / 12));
      const rows = Math.max(1, Math.floor(bh / 16));
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (rand() > 0.45) g.fillRect(bx + 4 + c * 10, h - bh + 6 + r * 14, 4, 6);
        }
      }
    }
    x += bw + 4 + Math.floor(rand() * 18);
    if (x > w - 20) break;
  }
  g.generateTexture(key, w, h);
  g.destroy();
}
