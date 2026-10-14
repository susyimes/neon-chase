import { en, i18n, t, type Message, type MessageKey } from "./i18n.ts";
import { audio } from "./audio/AudioBus.ts";
import type { ControlState } from "./game/entities/Player.ts";
import type { HudSnapshot, RunResult } from "./game/scenes/PlayScene.ts";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

function quietWarning(raw: string): string {
  return t(/timeout|late/i.test(raw) ? "lateWarning" : "offlineWarning");
}

export function bindUi(controls: ControlState): {
  showTitle: (status: Message, kind?: "ok" | "warn") => void;
  showPlay: () => void;
  showGameOver: (result: RunResult) => void;
  showPause: (on: boolean) => void;
  renderHud: (snap: HudSnapshot) => void;
  flashVeil: (kind?: "cyan" | "magenta") => void;
  overlayOn: (id: "overlay-title" | "overlay-gameover" | "overlay-pause") => boolean;
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
  const language = $<HTMLSelectElement>("language-select");
  let lastStatus: Message = { key: "checking" };
  let lastHud: HudSnapshot | undefined;
  let lastResult: RunResult | undefined;
  const staticText = [...document.querySelectorAll<HTMLElement>("[data-i18n]")];
  const accessibleText = [...document.querySelectorAll<HTMLElement>("[data-i18n-aria]")];
  language.addEventListener("change", () => {
    if (language.value === "en" || language.value === "zh-CN") i18n.setLocale(language.value);
  });
  // Native selection keys must not also trigger menu shortcuts.
  language.addEventListener("keydown", (event) => event.stopPropagation());

  const setOverlay = (el: HTMLElement, on: boolean): void => {
    el.classList.toggle("is-on", on);
    el.setAttribute("aria-hidden", on ? "false" : "true");
  };

  const overlayOn = (id: "overlay-title" | "overlay-gameover" | "overlay-pause"): boolean =>
    Boolean(document.getElementById(id)?.classList.contains("is-on"));

  const syncMute = (): void => {
    mute.classList.toggle("is-muted", audio.isMuted);
    mute.setAttribute("aria-pressed", audio.isMuted ? "true" : "false");
    mute.textContent = t(audio.isMuted ? "audioMuted" : "audioLive");
    mute.title = t(audio.isMuted ? "audioUnmute" : "audioMute");
    mute.setAttribute("aria-label", mute.title);
  };

  audio.onChange = () => syncMute();
  mute.addEventListener("click", () => {
    audio.toggleMute();
    audio.tick();
  });
  syncMute();

  const flashVeil = (kind: "cyan" | "magenta" = "cyan"): void => {
    veil.classList.remove("flash-cyan", "flash-magenta");
    void veil.offsetWidth;
    veil.classList.add(kind === "magenta" ? "flash-magenta" : "flash-cyan");
  };

  const showTitle = (message: Message, kind: "ok" | "warn" = "ok"): void => {
    setOverlay(title, true);
    setOverlay(gameover, false);
    setOverlay(pause, false);
    hud.classList.remove("is-on");
    lastStatus = message;
    status.textContent = t(message.key, message.params);
    status.className = `status ${kind}`;
  };

  const showPlay = (): void => {
    lastHud = undefined;
    flashVeil("cyan");
    setOverlay(title, false);
    setOverlay(gameover, false);
    setOverlay(pause, false);
    $("hud-score").textContent = "0";
    $("hud-hp").textContent = "●●●";
    hud.classList.add("is-on");
  };

  const showGameOver = (result: RunResult): void => {
    lastResult = result;
    flashVeil("magenta");
    setOverlay(title, false);
    setOverlay(pause, false);
    $("go-score").textContent = String(result.score);
    $("go-distance").textContent = t("meters", { distance: result.distance });
    $("go-calls").textContent = String(result.callCount);
    $("go-combo").textContent = result.combo > 1 ? `x${result.combo}` : "—";
    window.setTimeout(() => {
      setOverlay(gameover, true);
      hud.classList.remove("is-on");
    }, 180);
  };

  const showPause = (on: boolean): void => {
    setOverlay(pause, on);
  };

  const renderHud = (snap: HudSnapshot): void => {
    lastHud = snap;
    const scoreEl = $("hud-score");
    if (scoreEl.textContent !== String(snap.score)) {
      scoreEl.textContent = String(snap.score);
      scoreEl.classList.remove("pop");
      void scoreEl.offsetWidth;
      scoreEl.classList.add("pop");
    }
    $("hud-hp").textContent = "●".repeat(Math.max(0, snap.hp)).padEnd(snap.maxHp, "○");
    const src = t(snap.source === "fallback" ? "local" : "model");
    $("hud-jev").textContent = snap.source === "none" ? t("generating") : t("generation", { source: src, latency: snap.latencyMs || "—" });
    const hunterKey = `hunter_${snap.hunterMove}` as MessageKey;
    const hunter = snap.hunterMove && hunterKey in en ? t(hunterKey) : "";
    $("hud-jev").title = [t(`motif_${snap.motif}`), hunter, t("flow", { difficulty: snap.difficulty })].filter(Boolean).join(" · ");
    $("hud-speed").textContent = [t("speedValue", { speed: snap.speed }), t("flow", { difficulty: snap.difficulty })].join(" · ");
    if (snap.combo >= 2) {
      combo.hidden = false;
      $("hud-combo-n").textContent = String(snap.combo);
    } else {
      combo.hidden = true;
    }
    const label = t(`event_${snap.event}`);
    if (label) {
      beat.hidden = false;
      beat.textContent = label;
    } else {
      beat.hidden = true;
    }
    if (snap.warning && snap.source !== "jev") {
      warning.hidden = false;
      warning.textContent = quietWarning(snap.warning);
    } else {
      warning.hidden = true;
    }
  };

  const renderLocale = (): void => {
    document.title = t("pageTitle");
    language.value = i18n.locale;
    for (const el of staticText) el.textContent = t(el.dataset.i18n as MessageKey);
    for (const el of accessibleText) el.setAttribute("aria-label", t(el.dataset.i18nAria as MessageKey));
    status.textContent = t(lastStatus.key, lastStatus.params);
    syncMute();
    if (lastHud) renderHud(lastHud);
    if (lastResult) $("go-distance").textContent = t("meters", { distance: lastResult.distance });
  };
  i18n.subscribe(renderLocale);
  renderLocale();

  const onPlay = (fn: () => void): void => {
    $("btn-play").addEventListener("click", fn);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Enter" && overlayOn("overlay-title")) fn();
    });
  };
  const onRetry = (fn: () => void): void => {
    $("btn-retry").addEventListener("click", fn);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Enter" && overlayOn("overlay-gameover")) {
        e.preventDefault();
        fn();
      }
    });
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
    overlayOn,
    onPlay,
    onRetry,
    onTitle,
    onResume,
    onPauseTitle,
    syncMute,
  };
}
