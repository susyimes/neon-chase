import Phaser from "phaser";
import type { JuiceCue } from "@shared/types.ts";
import { GOLD, MAGENTA } from "../../palette.ts";

export class Juice {
  private emit!: Phaser.GameObjects.Particles.ParticleEmitter;
  private streak!: Phaser.GameObjects.Particles.ParticleEmitter;
  private stopHandle = 0;
  private shakeCool = 0;
  private cueUntil = 0;
  cue: JuiceCue = "pulse";

  attach(scene: Phaser.Scene): void {
    this.emit = scene.add.particles(0, 0, "px-soft", {
      speed: { min: 40, max: 220 },
      lifespan: { min: 260, max: 520 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.95, end: 0 },
      blendMode: "ADD",
      emitting: false,
      gravityY: 80,
    });
    this.emit.setDepth(8);
    this.streak = scene.add.particles(0, 0, "px-streak", {
      speed: { min: 10, max: 80 },
      lifespan: 280,
      scaleX: { start: 1.2, end: 0.2 },
      scaleY: { start: 0.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      blendMode: "ADD",
      emitting: false,
      frequency: 18,
      followOffset: { x: -8, y: 4 },
    });
    this.streak.setDepth(7);
  }

  setCue(cue: JuiceCue): void {
    this.cue = cue;
    this.cueUntil = performance.now() + 4200;
  }

  activeCue(): JuiceCue {
    return performance.now() < this.cueUntil ? this.cue : "pulse";
  }

  hitStop(scene: Phaser.Scene, realMs: number, scale = 0.18): void {
    scene.time.timeScale = scale;
    scene.physics.world.timeScale = scale;
    window.clearTimeout(this.stopHandle);
    this.stopHandle = window.setTimeout(() => {
      if (!scene.sys.isActive()) return;
      scene.time.timeScale = 1;
      scene.physics.world.timeScale = 1;
    }, realMs);
  }

  restoreTime(scene: Phaser.Scene): void {
    window.clearTimeout(this.stopHandle);
    scene.time.timeScale = 1;
    scene.physics.world.timeScale = 1;
  }

  shake(scene: Phaser.Scene, duration: number, intensity: number): void {
    const now = performance.now();
    if (now < this.shakeCool) return;
    this.shakeCool = now + duration + 90;
    scene.cameras.main.shake(duration, intensity);
  }

  burst(
    x: number,
    y: number,
    tint: number,
    count = 14,
    speed = 180,
  ): void {
    this.emit.setConfig({
      tint,
      speed: { min: speed * 0.35, max: speed },
    });
    this.emit.explode(count, x, y);
  }

  dashTrail(on: boolean, sprite?: Phaser.GameObjects.Sprite, tint = 0x00f0ff): void {
    if (on && sprite) {
      this.streak.startFollow(sprite, -10, 2);
      this.streak.setConfig({ tint });
      this.streak.start();
    } else {
      this.streak.stop();
      this.streak.stopFollow();
    }
  }

  scorePop(scene: Phaser.Scene, x: number, y: number, text: string, tint = 0x00f0ff): void {
    const label = scene.add
      .text(x, y, text, {
        fontFamily: 'ui-monospace, "Share Tech Mono", Menlo, monospace',
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setTint(tint)
      .setDepth(9)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: label,
      y: y - 46,
      alpha: 0,
      scale: 1.45,
      duration: 520,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  playCue(scene: Phaser.Scene, cue: JuiceCue, x: number, y: number): void {
    this.setCue(cue);
    const cam = scene.cameras.main;
    switch (cue) {
      case "pulse":
        cam.flash(90, 0, 240, 255, false);
        this.burst(x, y, 0x00f0ff, 10, 120);
        break;
      case "drop":
        cam.flash(120, 255, 43, 214, false);
        this.burst(x, y, MAGENTA, 12, 90);
        break;
      case "rise":
        cam.flash(100, 255, 210, 90, false);
        this.burst(x, y, GOLD, 16, 160);
        break;
      case "sting":
        this.hitStop(scene, 45, 0.2);
        cam.flash(70, 255, 255, 255, false);
        this.shake(scene, 90, 0.006);
        this.burst(x, y, 0xffffff, 18, 240);
        break;
      case "hush":
        cam.fadeIn(280, 5, 5, 16);
        break;
    }
  }
}

export const juice = new Juice();
