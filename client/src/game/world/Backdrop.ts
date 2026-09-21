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

    for (let i = 0; i < 42; i += 1) {
      const star = scene.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(8, GAME_HEIGHT - 160),
        Phaser.Math.FloatBetween(0.5, 1.6),
        i % 4 === 0 ? 0xff2bd6 : 0x00f0ff,
        0.4,
      );
      star.setScrollFactor(0);
      star.setDepth(0);
      scene.tweens.add({
        targets: star,
        alpha: { from: 0.15, to: 0.7 },
        duration: 1400 + (i % 7) * 220,
        yoyo: true,
        repeat: -1,
      });
    }

    this.far = scene.add
      .tileSprite(0, GAME_HEIGHT - 8, GAME_WIDTH, 160, "sky-far")
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(1)
      .setAlpha(0.85);
    this.mid = scene.add
      .tileSprite(0, GAME_HEIGHT + 6, GAME_WIDTH, 200, "sky-mid")
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(1)
      .setAlpha(0.9);
    this.near = scene.add
      .tileSprite(0, GAME_HEIGHT + 18, GAME_WIDTH, 140, "sky-near")
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(2)
      .setAlpha(0.7);

    this.fog = scene.add
      .rectangle(0, GAME_HEIGHT - 110, GAME_WIDTH, 130, 0xff2bd6, 0.07)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.haze = scene.add
      .rectangle(0, 0, GAME_WIDTH, 70, 0x00f0ff, 0.04)
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
