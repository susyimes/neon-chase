export type Locale = "en" | "zh-CN";
export const STORAGE_KEY = "neon-chase.language";

export const en = {
  pageTitle: "Neon Chase", language: "Language", audioMute: "Mute audio", audioUnmute: "Unmute audio",
  audioLive: "LIVE", audioMuted: "MUTED", score: "SCORE", chain: "CHAIN", signal: "SIGNAL",
  titleKicker: "SYSTEM ONE · JEV DIRECTS THE NIGHT", title: "NEON CHASE", titleSubtitle: "RUN THE NEON SPINE",
  blurb: "The city is a live wire. You are the spark. Jev chooses the next street, the gaps, and the neon beat. Collect cyan orbs, clear the spikes, and keep running.",
  runControl: "/ arrows — run", jumpControl: "— jump", jumpHint: "forgiving timing", dashControl: "— dash", pauseControl: "— pause",
  play: "ENTER THE SPINE", checking: "Checking terrain generator…", localOffline: "Generator unavailable · local terrain ready",
  localUnconfigured: "Local terrain ready · model generation unavailable", modelReady: "Jev ready · {model}",
  lost: "SIGNAL LOST", gameOver: "GAME OVER", lostSubtitle: "THE NIGHT GOES ON", distance: "Distance", peakChain: "Peak chain", calls: "Jev calls",
  retry: "AGAIN", backTitle: "TITLE", hold: "HOLD", paused: "PAUSED", pauseSubtitle: "TAKE A BREATH", resume: "RESUME",
  left: "Move left", right: "Move right", jump: "JUMP", dash: "DASH", local: "Local", model: "Jev", generating: "Generating terrain…",
  generation: "{source} · {latency} ms", flow: "Difficulty {difficulty}", speed: "Speed", speedValue: "Speed {speed} px/s", meters: "{distance} m",
  offlineWarning: "Using local terrain", lateWarning: "Generator delayed · local terrain",
  event_none: "", event_ambush_spike_run: "AMBUSH", event_orb_fountain: "ORB WELL", event_narrow_gauntlet: "GAUNTLET", event_calm_breather: "BREATHER",
  motif_neon_alley: "Neon alley", motif_rooftop: "Rooftop", motif_underpass: "Underpass",
  hunter_chase: "Chasing", hunter_jump: "Jumping", hunter_bait: "Baiting", hunter_hold: "Holding", hunter_pressure: "Pressure", hunter_cut_off: "Cut-off", hunter_retreat: "Retreat",
  padLabel: "{tiles} tiles · {seconds} s{pit}", pitLabel: " · pit {tiles}", pitStamp: "{tiles} tiles · {pixels} px",
};
export type MessageKey = keyof typeof en;
export const zh: Record<MessageKey, string> = {
  pageTitle: "霓虹追影", language: "语言", audioMute: "关闭声音", audioUnmute: "开启声音", audioLive: "声音开", audioMuted: "已静音",
  score: "得分", chain: "连击", signal: "生命信号", titleKicker: "系统一 · JEV 引领霓虹之夜", title: "霓虹追影", titleSubtitle: "沿着霓虹奔跑",
  blurb: "城市是一根带电的导线，你是其中的火花。Jev 决定下一条街道、沟壑与霓虹的节拍。收集青辉，越过地刺，向前奔跑。",
  runControl: "/ 方向键 — 移动", jumpControl: "— 跳跃", jumpHint: "离地与提前按键均有宽容", dashControl: "— 冲刺", pauseControl: "— 暂停",
  play: "踏入霓虹", checking: "正在检查地形生成器…", localOffline: "生成器暂不可用 · 本地地形已就绪", localUnconfigured: "本地地形已就绪 · 模型生成暂不可用", modelReady: "Jev 已就绪 · {model}",
  lost: "信号中断", gameOver: "游戏结束", lostSubtitle: "霓虹之夜仍在继续", distance: "距离", peakChain: "最高连击", calls: "Jev 调用", retry: "再跑一次", backTitle: "主菜单",
  hold: "稍作停留", paused: "已暂停", pauseSubtitle: "喘口气，再出发", resume: "继续", left: "向左移动", right: "向右移动", jump: "跳跃", dash: "冲刺",
  local: "本地", model: "Jev", generating: "正在生成地形…", generation: "{source} · {latency} 毫秒", flow: "难度 {difficulty}", speed: "速度", speedValue: "速度 {speed} 像素/秒", meters: "{distance} 米",
  offlineWarning: "正在使用本地地形", lateWarning: "生成器延迟 · 使用本地地形",
  event_none: "", event_ambush_spike_run: "地刺伏击", event_orb_fountain: "青辉涌泉", event_narrow_gauntlet: "狭道试炼", event_calm_breather: "平静喘息",
  motif_neon_alley: "霓虹巷道", motif_rooftop: "屋顶", motif_underpass: "地下通道",
  hunter_chase: "追逐", hunter_jump: "跳跃", hunter_bait: "诱敌", hunter_hold: "等待", hunter_pressure: "压迫", hunter_cut_off: "截击", hunter_retreat: "退却",
  padLabel: "{tiles} 格 · {seconds} 秒{pit}", pitLabel: " · 坑 {tiles} 格", pitStamp: "{tiles} 格 · {pixels} 像素",
};
export type Params = Record<string, string | number>;
export interface Message { key: MessageKey; params?: Params }
export interface LocaleEnvironment {
  languages?: readonly string[];
  language?: string;
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  setDocumentLanguage?: (locale: Locale) => void;
}
export function detectLocale(languages: readonly string[] = [], language = ""): Locale {
  const preferred = [...languages, language].find((value) => /^(?:en|zh)(?:-|$)/i.test(value)) || "en";
  return /^zh(?:-|$)/i.test(preferred) ? "zh-CN" : "en";
}
export function createI18n(env: LocaleEnvironment = {}) {
  let locale = detectLocale(env.languages, env.language);
  try {
    const saved = env.storage?.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh-CN") locale = saved;
  } catch { /* Storage may be disabled; language still works in memory. */ }
  const listeners = new Set<() => void>();
  env.setDocumentLanguage?.(locale);
  return {
    get locale(): Locale { return locale; },
    t(key: MessageKey, params: Params = {}): string {
      return (locale === "zh-CN" ? zh[key] : en[key]).replace(/\{(\w+)\}/g, (token, name: string) => String(params[name] ?? token));
    },
    setLocale(next: Locale): void {
      if (next !== "en" && next !== "zh-CN") return;
      try { env.storage?.setItem(STORAGE_KEY, next); } catch { /* Keep the choice for this page. */ }
      if (locale === next) return;
      locale = next;
      env.setDocumentLanguage?.(locale);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
let storage: LocaleEnvironment["storage"];
try { storage = typeof localStorage === "undefined" ? undefined : localStorage; } catch { /* Private browser policy. */ }
export const i18n = createI18n({
  languages: typeof navigator === "undefined" ? [] : navigator.languages,
  language: typeof navigator === "undefined" ? "" : navigator.language,
  storage,
  setDocumentLanguage: (locale) => { if (typeof document !== "undefined") document.documentElement.lang = locale; },
});
export const t = (key: MessageKey, params?: Params): string => i18n.t(key, params);
