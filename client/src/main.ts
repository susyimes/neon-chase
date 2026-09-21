import "./style.css";
import { createGame } from "./game/createGame.ts";
import { PlayScene, type HudSnapshot, type RunResult } from "./game/scenes/PlayScene.ts";
import type { ControlState } from "./game/entities/Player.ts";
import { JevService } from "./jev/client.ts";
import { bindUi } from "./ui.ts";

const controls: ControlState = { left: false, right: false, jump: false, dash: false };
const jev = new JevService();
const ui = bindUi(controls);

const hooks = {
  jev,
  controls,
  onHud: (snap: HudSnapshot) => ui.renderHud(snap),
  onGameOver: (result: RunResult) => ui.showGameOver(result),
};

const root = document.getElementById("game-root");
if (!root) throw new Error("#game-root missing");

const game = createGame(root);

function startRun(): void {
  ui.showPlay();
  if (game.scene.isActive(PlayScene.KEY) || game.scene.isPaused(PlayScene.KEY)) {
    game.scene.stop(PlayScene.KEY);
  }
  game.scene.start(PlayScene.KEY, hooks);
}

function toTitle(): void {
  if (game.scene.isActive(PlayScene.KEY) || game.scene.isPaused(PlayScene.KEY)) {
    game.scene.pause(PlayScene.KEY);
  }
  ui.showTitle(lastStatus.text, lastStatus.kind);
}

const lastStatus = { text: "Checking Jev proxy…", kind: "ok" as "ok" | "warn" };

ui.onPlay(startRun);
ui.onRetry(startRun);
ui.onTitle(toTitle);

void jev.health().then((health) => {
  if (!health) {
    lastStatus.text = "Proxy offline — game still runs with local safe terrain.";
    lastStatus.kind = "warn";
  } else if (!health.jevConfigured) {
    lastStatus.text = "No TYPESAFE_API_KEY — playing with safe fallback terrain.";
    lastStatus.kind = "warn";
  } else {
    lastStatus.text = `Jev proxy ready · ${health.model}`;
    lastStatus.kind = "ok";
  }
  if (!document.getElementById("overlay-title")?.hidden) {
    ui.showTitle(lastStatus.text, lastStatus.kind);
  }
});

ui.showTitle(lastStatus.text, lastStatus.kind);
