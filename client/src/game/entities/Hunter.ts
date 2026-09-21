import Phaser from "phaser";
import type { HunterMove, HunterTactics, HunterVertical } from "@shared/types.ts";
import { HUNTER_TICK_MS } from "../../config.ts";

export class Hunter {
  move: HunterMove = "chase";
  stance: HunterTactics["stance"] = "pressure";
  aggression = 0.4;
  private fromX: number;
  private fromY: number;
  private toX: number;
  private toY: number;
  private t = 1;
  private pressure = 0;
  private feinting = false;
  private feintT = 1;
  private vertical: HunterVertical = "level";
  private glow: Phaser.GameObjects.Image | null = null;

  constructor(readonly sprite: Phaser.Physics.Arcade.Sprite) {
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(28, 28);
    sprite.setImmovable(true);
    sprite.setScale(1.2);
    sprite.setDepth(6);
    this.fromX = sprite.x;
    this.fromY = sprite.y;
    this.toX = sprite.x;
    this.toY = sprite.y;
  }

  attachGlow(glow: Phaser.GameObjects.Image): void {
    this.glow = glow;
    glow.setDepth(5);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setAlpha(0.55);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  apply(
    move: HunterMove,
    playerX: number,
    playerY: number,
    playerVy: number,
    score = 0,
  ): void {
    this.applyTactics(
      {
        stance: move === "bait" ? "bait" : move === "hold" ? "retreat" : move === "jump" ? "cut_off" : "pressure",
        move,
        feint: false,
        aggression: this.aggression,
        vertical: "level",
      },
      playerX,
      playerY,
      playerVy,
      score,
    );
  }

  applyTactics(
    tactics: HunterTactics,
    playerX: number,
    playerY: number,
    playerVy: number,
    score = 0,
    difficulty = 5,
  ): void {
    this.stance = tactics.stance;
    this.move = tactics.move;
    this.vertical = tactics.vertical;
    this.fromX = this.sprite.x;
    this.fromY = this.sprite.y;
    this.t = 0;
    this.pressure = Phaser.Math.Clamp(score / 1400 + (difficulty - 3) * 0.06, 0, 1);
    const gap = playerX - this.sprite.x;
    this.aggression = Phaser.Math.Clamp(
      tactics.aggression * (0.85 + this.pressure * 0.3) + (1 - gap / 900) * 0.15,
      0.15,
      1,
    );
    this.feinting = tactics.feint;
    this.feintT = tactics.feint ? 0 : 1;
    this.retarget(playerX, playerY, playerVy);
  }

  update(dt: number, playerX: number, playerY: number, playerVy: number): void {
    this.retarget(playerX, playerY, playerVy);

    if (this.feinting && this.feintT < 1) {
      this.feintT = Math.min(1, this.feintT + dt / 0.16);
      const awayX = this.fromX - (this.toX - this.fromX) * 0.35;
      const awayY = this.fromY - (this.toY - this.fromY) * 0.2;
      const e = this.feintT;
      this.sprite.setPosition(
        Phaser.Math.Linear(this.fromX, awayX, e),
        Phaser.Math.Linear(this.fromY, awayY, e),
      );
      if (this.feintT >= 1) {
        this.feinting = false;
        this.fromX = this.sprite.x;
        this.fromY = this.sprite.y;
        this.t = 0;
      }
    } else if (this.move === "chase") {
      this.homeToward(this.toX, this.toY, dt, 340 + this.pressure * 220 + this.aggression * 80);
    } else {
      this.t = Math.min(1, this.t + dt / (HUNTER_TICK_MS / 1000));
      const e = this.t * this.t * (3 - 2 * this.t);
      this.sprite.setPosition(
        Phaser.Math.Linear(this.fromX, this.toX, e),
        Phaser.Math.Linear(this.fromY, this.toY, e),
      );
    }

    this.sprite.setFlipX(playerX < this.sprite.x);
    const pulse = 0.78 + Math.sin(this.sprite.scene.time.now / 160) * 0.18;
    this.sprite.setAlpha(pulse);
    if (this.glow) {
      this.glow.setPosition(this.sprite.x, this.sprite.y);
      this.glow.setFlipX(this.sprite.flipX);
      this.glow.setAlpha(0.35 + Math.sin(this.sprite.scene.time.now / 140) * 0.2);
    }
  }

  distanceTo(x: number, y: number): number {
    return Math.hypot(this.sprite.x - x, this.sprite.y - y);
  }

  private homeToward(x: number, y: number, dt: number, speed: number): void {
    const dx = x - this.sprite.x;
    const dy = y - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1) {
      this.sprite.setPosition(x, y);
      return;
    }
    const step = Math.min(dist, speed * dt);
    this.sprite.setPosition(this.sprite.x + (dx / dist) * step, this.sprite.y + (dy / dist) * step);
  }

  private retarget(playerX: number, playerY: number, playerVy: number): void {
    const vert = this.verticalOffset(playerY);
    switch (this.stance) {
      case "pressure":
        this.toX = playerX - 10;
        this.toY = vert;
        break;
      case "bait":
        this.toX = playerX + 128;
        this.toY = vert - 8;
        break;
      case "cut_off":
        this.toX = playerX + 56;
        this.toY = this.t < 0.45 ? playerY + Math.min(playerVy, 0) - 118 : vert - 10;
        break;
      case "retreat":
        this.toX = playerX - 230;
        this.toY = vert + 12;
        break;
    }
  }

  private verticalOffset(playerY: number): number {
    if (this.vertical === "above") return playerY - 88;
    if (this.vertical === "below") return playerY + 46;
    return playerY - 2;
  }
}
