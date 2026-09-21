import Phaser from "phaser";
import {
  AUTO_RUN,
  COYOTE_MS,
  DASH_BUFFER_MS,
  DASH_COOLDOWN_MS,
  DASH_MS,
  DASH_V,
  IFRAME_MS,
  JUMP_BUFFER_MS,
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

export interface PlayerFrame {
  jumped: boolean;
  dashed: boolean;
  landed: boolean;
  landingVy: number;
  dashing: boolean;
}

export class Player {
  hp = MAX_HP;
  maxX = 80;
  facing = 1;
  private invulnUntil = 0;
  private dashUntil = 0;
  private dashReadyAt = 0;
  private coyoteUntil = 0;
  private jumpBufferedUntil = 0;
  private dashBufferedUntil = 0;
  private wasGrounded = true;
  private scaleX = 1;
  private scaleY = 1;

  constructor(readonly sprite: Phaser.Physics.Arcade.Sprite) {
    sprite.setSize(20, 30);
    sprite.setOffset(8, 8);
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

  /** Full new-run reset: HP, score cursor, timers, facing, then a spawn. */
  beginRun(x: number, y: number): void {
    this.hp = MAX_HP;
    this.maxX = x;
    this.facing = 1;
    this.dashUntil = 0;
    this.dashReadyAt = 0;
    this.coyoteUntil = 0;
    this.jumpBufferedUntil = 0;
    this.dashBufferedUntil = 0;
    this.wasGrounded = true;
    this.scaleX = 1;
    this.scaleY = 1;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = true;
    this.spawn(x, y);
  }

  spawn(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.sprite.setVelocity(AUTO_RUN, 0);
    this.maxX = Math.max(this.maxX, x);
    this.invulnUntil = this.sprite.scene.time.now + 1400;
    this.scaleX = 1;
    this.scaleY = 1;
  }

  update(now: number, controls: ControlState): PlayerFrame {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    const dashing = now < this.dashUntil;
    const out: PlayerFrame = {
      jumped: false,
      dashed: false,
      landed: false,
      landingVy: 0,
      dashing,
    };

    if (controls.left) this.facing = -1;
    if (controls.right) this.facing = 1;
    if (controls.jump) this.jumpBufferedUntil = now + JUMP_BUFFER_MS;
    if (controls.dash) this.dashBufferedUntil = now + DASH_BUFFER_MS;

    if (grounded) this.coyoteUntil = now + COYOTE_MS;

    if (!this.wasGrounded && grounded && body.velocity.y > -20) {
      out.landed = true;
      out.landingVy = body.velocity.y;
      this.impulse(1.28, 0.72);
    }

    if (now < this.dashBufferedUntil && now >= this.dashReadyAt) {
      this.dashUntil = now + DASH_MS;
      this.dashReadyAt = now + DASH_COOLDOWN_MS;
      this.invulnUntil = Math.max(this.invulnUntil, now + DASH_MS);
      this.sprite.setVelocityX(this.facing * DASH_V);
      this.dashBufferedUntil = 0;
      this.impulse(1.35, 0.78);
      out.dashed = true;
    }

    if (!dashing && !out.dashed) {
      const input = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
      const target = AUTO_RUN + input * STRAFE;
      const next = Phaser.Math.Linear(body.velocity.x, target, 0.22);
      this.sprite.setVelocityX(next);
    }

    const canJump = now < this.coyoteUntil && now < this.jumpBufferedUntil && !dashing;
    if (canJump) {
      this.sprite.setVelocityY(JUMP_V);
      this.coyoteUntil = 0;
      this.jumpBufferedUntil = 0;
      this.impulse(0.78, 1.28);
      out.jumped = true;
    }

    this.scaleX = Phaser.Math.Linear(this.scaleX, 1, 0.18);
    this.scaleY = Phaser.Math.Linear(this.scaleY, 1, 0.18);
    this.sprite.setScale(this.scaleX * 1.18, this.scaleY * 1.18);
    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setAlpha(this.invulnerable && Math.floor(now / 70) % 2 === 0 ? 0.35 : 1);
    this.maxX = Math.max(this.maxX, this.sprite.x);
    this.wasGrounded = grounded;
    return out;
  }

  hurt(now: number, knock = -180, pierceIframes = false): boolean {
    if (!pierceIframes && this.invulnerable) return false;
    this.hp -= 1;
    this.invulnUntil = now + IFRAME_MS;
    this.sprite.setVelocity(knock, -220);
    this.impulse(1.2, 0.7);
    return true;
  }

  private impulse(x: number, y: number): void {
    this.scaleX = x;
    this.scaleY = y;
  }
}
