# Neon Chase / 霓虹追影

Endless side-scrolling runner. You run, jump, and dash. **TypeSafe Jev** (System One) does not write text or draw art — it only returns structured Choice answers that pick the next platforms and the hunter’s next move.

无尽横版跑酷。玩家奔跑、跳跃、冲刺。**TypeSafe Jev**（System One）不生成文案或美术，只从固定选项里返回结构化 Choice，用来铺前方地形并驱动追猎 AI。

## Play / 怎么玩

- **Goal:** survive, collect cyan orbs, score from distance + orbs.
- **Hazards:** gaps, magenta spikes, the hunter.
- **HP:** 3. Spikes / hunter / falling off cost 1 HP (brief i-frames). 0 HP → game over.

| Input | Action |
| --- | --- |
| `A` `D` or arrows | run (there is also a steady auto-run) |
| `W` / `↑` / `Space` | jump |
| `Shift` | dash |
| `Enter` | start from the title screen |

On a touch device, on-screen buttons appear.

## Run locally / 本地运行

Needs Node 20+.

```bash
npm install
```

Copy the env template and (optionally) add a TypeSafe key. The key stays on the **server** only.

```bash
cp .env.example .env.local
# edit .env.local and set TYPESAFE_API_KEY=...
```

`.env.example` ships with an empty key. Do not commit `.env` or `.env.local`.

```bash
npm run dev
```

- Client (Vite + Phaser 3): [http://127.0.0.1:43123](http://127.0.0.1:43123)
- Server (Hono Jev proxy): [http://127.0.0.1:43124](http://127.0.0.1:43124)

Or start them separately:

```bash
npm run dev:server
npm run dev:client
```

Without a key, or if Jev errors / exceeds **800ms**, the game keeps running on **safe flat ground** and a hunter that simply chases. The HUD shows a non-blocking warning.

没有 Key、接口报错或超过 **800ms** 时，游戏不会卡死：用地形兜底（平坦安全地面）和“追赶”猎人，HUD 会显示一条不打断操作的警告。

## What Jev does / Jev 做什么

The browser **never** sees `TYPESAFE_API_KEY`. It posts compact game state to the local proxy:

`POST /api/jev/decide` → server → `POST https://api.typesafe.ai/v1/systemone`

Pinned model: **`jev-1.13.0`**.

### Request mapping

Client body:

```json
{
  "state": {
    "player": { "x": 0, "y": 0, "vx": 0, "vy": 0, "hp": 3, "dash": true },
    "hunter": { "x": 0, "aggression": 0.5 },
    "ahead": ["solid:5", "gap:2"],
    "score": 0
  },
  "ask": { "terrainSegments": 2, "hunter": true }
}
```

The server turns `ask` into one System One call. Several questions run **in parallel** on the same `state`:

| Question id | Type | Options | Used for |
| --- | --- | --- | --- |
| `next_surface` (`s1_…`, `s2_…` for extra segments) | choice | `solid` \| `ledge` \| `spike` | platform kind |
| `width` | choice | `2` \| `3` \| `5` | platform width in tiles |
| `gap` | choice | `0` \| `1` \| `2` | empty tiles after the platform |
| `height` | choice | `4`–`9` | platform row from the bottom |
| `hunter_move` | choice | `chase` \| `jump` \| `bait` \| `hold` | hunter intent |

Upstream body the server sends:

```json
{
  "model": "jev-1.13.0",
  "state": { "player": {}, "hunter": {}, "ahead": [], "score": 0 },
  "questions": {
    "next_surface": { "type": "choice", "instructions": "…", "criteria": { "solid": "…", "ledge": "…", "spike": "…" } },
    "width": { "type": "choice", "criteria": { "2": "short", "3": "medium", "5": "long" } },
    "gap": { "type": "choice", "criteria": { "0": "none", "1": "small jump", "2": "wide jump" } },
    "height": { "type": "choice", "criteria": { "4": "low", "9": "very high" } },
    "hunter_move": { "type": "choice", "criteria": { "chase": "…", "jump": "…", "bait": "…", "hold": "…" } }
  }
}
```

### Response mapping

Jev returns `{ answers: { <id>: { type: "choice", choice: "…", probabilities, confidence } } }`.

The proxy reads each `choice`, validates it against the option set, and replies to the game:

```json
{
  "ok": true,
  "source": "jev",
  "latencyMs": 412,
  "model": "jev-1.13.0",
  "terrain": [{ "surface": "ledge", "width": 3, "gap": 1, "height": 7 }],
  "hunterMove": "bait"
}
```

Unknown or missing answers fall back per-field (`solid` / `5` / `0` / `5` / `chase`). HTTP errors, a missing key, or a timeout become `source: "fallback"` plus a `warning` string.

### Game loop

- Physics and render stay at ~60fps in Phaser. Jev is **never** awaited on the update loop.
- When the terrain buffer drops below ~2 screens, the client prefetches 2 segments (and piggy-backs a hunter question when a tick is due).
- Hunter AI ticks about every **400ms**. Between ticks the sprite interpolates toward the last target (`chase` / `jump` / `bait` / `hold`).
- HUD: score, HP, last Jev latency, call count, source (`jev` \| `fallback`), last hunter move.

## Layout

```
client/   Phaser 3 + Vite + TypeScript
server/   Hono + TypeScript proxy
shared/   Compact state + decide request/response types
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | server + client together |
| `npm run dev:client` | Vite only (proxies `/api` → `:43124`) |
| `npm run dev:server` | Jev proxy only |
| `npm run build` | production client build |

Get an API key from the [TypeSafe console](https://console.typesafe.ai/settings/keys) after you have Jev access.
