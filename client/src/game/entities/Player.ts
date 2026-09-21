import Phaser from "phaser";
import {
  AUTO_RUN,
  DASH_COOLDOWN_MS,
  DASH_MS,
  DASH_V,
  IFRAME_MS,
  JUMP_V,
  MAX_HP,
  STRAFE,
} from "../../config.ts";

export interface ControlState {
  left: boolean;
  right: boolean;
  jump: boolean;
  dash: boolean;
}

export class Player {
  hp = MAX_HP;
  maxX = 80;
  private invulnUntil = 0;
  private dashUntil = 0;
  private dashReadyAt = 0;
  facing = 1;

  constructor(readonly sprite: Phaser.Physics.Arcade.Sprite) {
    sprite.setSize(20, 30);
    sprite.setOffset(4, 4);
    sprite.setMaxVelocity(640, 900);
    sprite.setDepth(5);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get vx(): number {
    return this.sprite.body?.velocity.x ?? 0;
  }

  get vy(): number {
    return this.sprite.body?.velocity.y ?? 0;
  }

  get dashReady(): boolean {
    return this.sprite.scene.time.now >= this.dashReadyAt;
  }

  get invulnerable(): boolean {
    return this.sprite.scene.time.now < this.invulnUntil;
  }

  spawn(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.sprite.setVelocity(AUTO_RUN, 0);
    this.maxX = x;
    this.invulnUntil = this.sprite.scene.time.now + 1400;
  }

  update(now: number, controls: ControlState): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    const dashing = now < this.dashUntil;

    if (controls.left) this.facing = -1;
    if (controls.right) this.facing = 1;

    if (controls.dash && now >= this.dashReadyAt) {
      this.dashUntil = now + DASH_MS;
      this.dashReadyAt = now + DASH_COOLDOWN_MS;
      this.invulnUntil = Math.max(this.invulnUntil, now + DASH_MS);
      this.sprite.setVelocityX(this.facing * DASH_V);
    }

    if (!dashing) {
      const input = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
      const target = AUTO_RUN + input * STRAFE;
      const next = Phaser.Math.Linear(body.velocity.x, target, 0.18);
      this.sprite.setVelocityX(next);
    }

    if (controls.jump && grounded) {
      this.sprite.setVelocityY(JUMP_V);
    }

    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setAlpha(this.invulnerable && Math.floor(now / 70) % 2 === 0 ? 0.35 : 1);
    this.maxX = Math.max(this.maxX, this.sprite.x);
  }

  hurt(now: number, knock = -180): boolean {
    if (this.invulnerable) return false;
    this.hp -= 1;
    this.invulnUntil = now + IFRAME_MS;
    this.sprite.setVelocity(knock, -220);
    return true;
  }
}
