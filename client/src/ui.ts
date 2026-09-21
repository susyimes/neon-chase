import { audio } from "./audio/AudioBus.ts";
import type { ControlState } from "./game/entities/Player.ts";
import type { HudSnapshot, RunResult } from "./game/scenes/PlayScene.ts";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

const EVENT_LABEL: Record<string, string> = {
  none: "",
  ambush_spike_run: "AMBUSH",
  orb_fountain: "ORB WELL",
  narrow_gauntlet: "GAUNTLET",
  calm_breather: "BREATHER",
};

const SOURCE_LABEL = {
  jev: "Jev live",
  fallback: "Local fallback",
  none: "Jev…",
} as const;

export function bindUi(controls: ControlState): {
  showTitle: (status: string, kind?: "ok" | "warn") => void;
  showPlay: () => void;
  showGameOver: (result: RunResult) => void;
  showPause: (on: boolean) => void;
  renderHud: (snap: HudSnapshot) => void;
  flashVeil: (kind?: "cyan" | "magenta") => void;
  onPlay: (fn: () => void) => void;
  onRetry: (fn: () => void) => void;
  onTitle: (fn: () => void) => void;
  onResume: (fn: () => void) => void;
  onPauseTitle: (fn: () => void) => void;
  syncMute: () => void;
} {
  const title = $("overlay-title");
  const gameover = $("overlay-gameover");
  const pause = $("overlay-pause");
  const hud = $("hud");
  const touch = $("touch");
  const status = $("title-status");
  const warning = $("hud-warning");
  const beat = $("hud-beat");
  const combo = $("hud-combo");
  const veil = $("fx-veil");
  const mute = $("btn-mute");

  const setOverlay = (el: HTMLElement, on: boolean): void => {
    el.hidden = !on;
    el.classList.toggle("is-on", on);
  };

  const syncMute = (): void => {
    mute.classList.toggle("is-muted", audio.isMuted);
    mute.setAttribute("aria-pressed", audio.isMuted ? "true" : "false");
    mute.textContent = audio.isMuted ? "MUTE" : "LIVE";
  };

  audio.onChange = () => syncMute();
  mute.addEventListener("click", () => {
    audio.toggleMute();
    audio.click();
  });
  syncMute();

  const flashVeil = (kind: "cyan" | "magenta" = "cyan"): void => {
    veil.classList.remove("flash-cyan", "flash-magenta");
    void veil.offsetWidth;
    veil.classList.add(kind === "magenta" ? "flash-magenta" : "flash-cyan");
  };

  const showTitle = (text: string, kind: "ok" | "warn" = "ok"): void => {
    setOverlay(title, true);
    setOverlay(gameover, false);
    setOverlay(pause, false);
    hud.hidden = true;
    status.textContent = text;
    status.className = `status ${kind}`;
  };

  const showPlay = (): void => {
    flashVeil("cyan");
    setOverlay(title, false);
    setOverlay(gameover, false);
    setOverlay(pause, false);
    hud.hidden = false;
  };

  const showGameOver = (result: RunResult): void => {
    flashVeil("magenta");
    setOverlay(gameover, true);
    setOverlay(pause, false);
    hud.hidden = true;
    $("go-score").textContent = String(result.score);
    $("go-distance").textContent = `${result.distance}m`;
    $("go-calls").textContent = String(result.callCount);
    $("go-combo").textContent = result.combo > 1 ? `x${result.combo}` : "—";
  };

  const showPause = (on: boolean): void => {
    setOverlay(pause, on);
  };

  const renderHud = (snap: HudSnapshot): void => {
    const scoreEl = $("hud-score");
    if (scoreEl.textContent !== String(snap.score)) {
      scoreEl.textContent = String(snap.score);
      scoreEl.classList.remove("pop");
      void scoreEl.offsetWidth;
      scoreEl.classList.add("pop");
    }
    $("hud-hp").textContent = "●".repeat(Math.max(0, snap.hp)).padEnd(snap.maxHp, "○");
    const src = SOURCE_LABEL[snap.source];
    const stance = snap.hunterMove.replace("_", " ");
    $("hud-jev").textContent = `${src} · ${snap.latencyMs || "—"}ms · ${snap.motif.replace("_", " ")} · ${stance} · flow ${snap.difficulty}`;
    if (snap.combo >= 2) {
      combo.hidden = false;
      $("hud-combo-n").textContent = String(snap.combo);
    } else {
      combo.hidden = true;
    }
    const label = EVENT_LABEL[snap.event] ?? "";
    if (label) {
      beat.hidden = false;
      beat.textContent = label;
    } else {
      beat.hidden = true;
    }
    if (snap.warning) {
      warning.hidden = false;
      warning.textContent = snap.warning;
    } else {
      warning.hidden = true;
    }
  };

  const onPlay = (fn: () => void): void => {
    $("btn-play").addEventListener("click", fn);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Enter" && !title.hidden) fn();
    });
  };
  const onRetry = (fn: () => void): void => {
    $("btn-retry").addEventListener("click", fn);
  };
  const onTitle = (fn: () => void): void => {
    $("btn-title").addEventListener("click", fn);
  };
  const onResume = (fn: () => void): void => {
    $("btn-resume").addEventListener("click", fn);
  };
  const onPauseTitle = (fn: () => void): void => {
    $("btn-pause-title").addEventListener("click", fn);
  };

  const setTouch = (key: keyof ControlState, down: boolean): void => {
    controls[key] = down;
  };

  for (const btn of touch.querySelectorAll<HTMLButtonElement>("[data-touch]")) {
    const key = btn.dataset.touch as keyof ControlState;
    const down = (e: Event): void => {
      e.preventDefault();
      setTouch(key, true);
    };
    const up = (e: Event): void => {
      e.preventDefault();
      setTouch(key, false);
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("pointercancel", up);
  }

  if (window.matchMedia("(pointer: coarse)").matches) {
    touch.hidden = false;
  }

  return {
    showTitle,
    showPlay,
    showGameOver,
    showPause,
    renderHud,
    flashVeil,
    onPlay,
    onRetry,
    onTitle,
    onResume,
    onPauseTitle,
    syncMute,
  };
}
