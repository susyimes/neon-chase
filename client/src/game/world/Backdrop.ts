import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../../config.ts";
import { MOTIF_PALETTES, type MotifPalette } from "../../palette.ts";
import type { MotifKind } from "@shared/types.ts";

export class Backdrop {
  private sky: Phaser.GameObjects.Graphics;
  private far: Phaser.GameObjects.TileSprite;
  private mid: Phaser.GameObjects.TileSprite;
  private near: Phaser.GameObjects.TileSprite;
  private fog: Phaser.GameObjects.Rectangle;
  private haze: Phaser.GameObjects.Rectangle;
  private palette: MotifPalette = MOTIF_PALETTES.neon_alley;

  constructor(scene: Phaser.Scene) {
    this.sky = scene.add.graphics().setScrollFactor(0).setDepth(0);
    this.paintSky();

    for (let i = 0; i < 56; i += 1) {
      const star = scene.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(8, GAME_HEIGHT - 180),
        Phaser.Math.FloatBetween(0.4, 1.3),
        i % 7 === 0 ? 0xff2bd6 : 0x8ad8ff,
        0.28,
      );
      star.setScrollFactor(0);
      star.setDepth(0);
      scene.tweens.add({
        targets: star,
        alpha: { from: 0.1, to: 0.4 },
        duration: 1600 + (i % 7) * 220,
        yoyo: true,
        repeat: -1,
      });
    }

    scene.add
      .rectangle(0, GAME_HEIGHT - 168, GAME_WIDTH, 6, 0x00f0ff, 0.18)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.far = scene.add
      .tileSprite(0, GAME_HEIGHT - 8, GAME_WIDTH, 180, "sky-far")
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(1)
      .setAlpha(0.62);
    this.mid = scene.add
      .tileSprite(0, GAME_HEIGHT + 4, GAME_WIDTH, 220, "sky-mid")
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(1)
      .setAlpha(0.72);
    this.near = scene.add
      .tileSprite(0, GAME_HEIGHT + 16, GAME_WIDTH, 160, "sky-near")
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(2)
      .setAlpha(0.78);

    scene.add
      .rectangle(0, GAME_HEIGHT - 210, GAME_WIDTH, 90, 0x3a6cff, 0.06)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.fog = scene.add
      .rectangle(0, GAME_HEIGHT - 80, GAME_WIDTH, 80, 0xff2bd6, 0.06)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.haze = scene.add
      .rectangle(0, 0, GAME_WIDTH, 64, 0x7ad7ff, 0.035)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.ADD);

    const vig = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(12);
    vig.setStrokeStyle(90, 0x000000, 0.35);
  }

  setMotif(kind: MotifKind): void {
    this.palette = MOTIF_PALETTES[kind];
    this.paintSky();
    this.far.setTint(this.palette.far);
    this.mid.setTint(this.palette.mid);
    this.near.setTint(this.palette.near);
    this.fog.setFillStyle(this.palette.fog, 0.08);
    this.haze.setFillStyle(this.palette.window, 0.04);
  }

  scroll(cameraX: number): void {
    this.far.tilePositionX = cameraX * 0.08;
    this.mid.tilePositionX = cameraX * 0.18;
    this.near.tilePositionX = cameraX * 0.34;
  }

  private paintSky(): void {
    const p = this.palette;
    this.sky.clear();
    this.sky.fillGradientStyle(p.skyTop, p.skyTop, p.skyBot, p.skyBot, 1);
    this.sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}
