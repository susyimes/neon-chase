import Phaser from "phaser";
import type { HunterMove } from "@shared/types.ts";
import { HUNTER_TICK_MS } from "../../config.ts";

export class Hunter {
  move: HunterMove = "chase";
  aggression = 0.4;
  private fromX: number;
  private fromY: number;
  private toX: number;
  private toY: number;
  private t = 1;
  private pressure = 0;

  constructor(readonly sprite: Phaser.Physics.Arcade.Sprite) {
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(28, 28);
    sprite.setImmovable(true);
    sprite.setDepth(6);
    this.fromX = sprite.x;
    this.fromY = sprite.y;
    this.toX = sprite.x;
    this.toY = sprite.y;
  }

  get x(): number {
    return this.sprite.x;
  }

  apply(
    move: HunterMove,
    playerX: number,
    playerY: number,
    playerVy: number,
    score = 0,
  ): void {
    this.move = move;
    this.fromX = this.sprite.x;
    this.fromY = this.sprite.y;
    this.t = 0;
    this.pressure = Phaser.Math.Clamp(score / 1400, 0, 1);

    const gap = playerX - this.sprite.x;
    this.aggression = Phaser.Math.Clamp(1 - gap / 900 + this.pressure, 0.15, 1);
    this.retarget(playerX, playerY, playerVy);
  }

  update(dt: number, playerX: number, playerY: number, playerVy: number): void {
    this.retarget(playerX, playerY, playerVy);

    if (this.move === "chase") {
      this.homeToward(this.toX, this.toY, dt, 360 + this.pressure * 200);
    } else {
      this.t = Math.min(1, this.t + dt / (HUNTER_TICK_MS / 1000));
      const e = this.t * this.t * (3 - 2 * this.t);
      this.sprite.setPosition(
        Phaser.Math.Linear(this.fromX, this.toX, e),
        Phaser.Math.Linear(this.fromY, this.toY, e),
      );
    }

    this.sprite.setFlipX(playerX < this.sprite.x);
    this.sprite.setAlpha(0.75 + Math.sin(this.sprite.scene.time.now / 180) * 0.2);
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
    switch (this.move) {
      case "chase":
        this.toX = playerX - 8;
        this.toY = playerY - 2;
        break;
      case "jump":
        this.toX = playerX - 10;
        this.toY = this.t < 0.45 ? playerY + Math.min(playerVy, 0) - 120 : playerY - 4;
        break;
      case "bait":
        this.toX = playerX + 120;
        this.toY = playerY - 10;
        break;
      case "hold":
        break;
    }
  }
}
