import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.ts";
import { makeGameTextures } from "./fx/textures.ts";
import { Backdrop } from "./world/Backdrop.ts";
import { PlayScene } from "./scenes/PlayScene.ts";

class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x050510);
    makeGameTextures(this);
    const bg = new Backdrop(this);
    bg.setMotif("neon_alley");
    bg.scroll(40);
  }
}

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#050510",
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PlayScene],
  });
}
