import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createI18n, detectLocale, en, zh, STORAGE_KEY, type MessageKey } from "../client/src/i18n.ts";
import { EVENT_BEATS, MOTIFS, HUNTER_MOVES, HUNTER_STANCES } from "../shared/types.ts";

assert.equal(detectLocale(["zh-TW", "en-US"]), "zh-CN");
assert.equal(detectLocale(["ZH-hans-CN"]), "zh-CN");
assert.equal(detectLocale(["en-GB", "zh-CN"]), "en");
assert.equal(detectLocale(["fr-FR", "zh-CN", "en-US"]), "zh-CN");
assert.equal(detectLocale(["fr-FR", "de-DE"], "en-US"), "en");
assert.equal(detectLocale([], "zh"), "zh-CN");
assert.equal(detectLocale([], "fr-FR"), "en");
assert.equal(detectLocale(), "en");
assert.equal(detectLocale(["zhx"]), "en");
const saved = new Map<string, string>();
const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } };
let documentLang = "";
const locale = createI18n({ languages: ["zh-CN"], storage, setDocumentLanguage: (value) => { documentLang = value; } });
assert.equal(locale.locale, "zh-CN");
assert.equal(documentLang, "zh-CN");
assert.equal(saved.size, 0, "default detection must not become a saved explicit preference");
let updates = 0;
const snapshot = { score: 123, distance: 45, combo: 3, paused: true };
const before = JSON.stringify(snapshot);
let rendered = "";
const stop = locale.subscribe(() => { updates++; rendered = locale.t("meters", { distance: snapshot.distance }); });
locale.setLocale("en");
assert.equal(documentLang, "en");
assert.equal(rendered, "45 m", "subscriber must render the same existing run data immediately");
assert.equal(JSON.stringify(snapshot), before, "locale changes preserve gameplay state");
assert.equal(saved.get(STORAGE_KEY), "en");
assert.equal(createI18n({ languages: ["zh-CN"], storage }).locale, "en", "saved explicit choice overrides browser default");
locale.setLocale("en");
assert.equal(updates, 1, "same language must not rerender unnecessarily");
stop();
locale.setLocale("zh-CN");
assert.equal(updates, 1, "destroyed canvas labels can unsubscribe");
assert.equal(locale.t("modelReady", { model: "test-model" }), "Jev 已就绪 · test-model");
saved.set(STORAGE_KEY, "invalid");
assert.equal(createI18n({ languages: ["zh-CN"], storage }).locale, "zh-CN");
const blocked = createI18n({ languages: ["en"], storage: { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } } });
blocked.setLocale("zh-CN");
assert.equal(blocked.locale, "zh-CN");
assert.equal(blocked.t("paused"), "已暂停");
assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
for (const key of Object.keys(en) as MessageKey[]) {
  assert.equal(typeof zh[key], "string", `missing Chinese ${key}`);
  if (key !== "event_none") assert.ok(en[key].trim() && zh[key].trim(), `empty translation ${key}`);
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  assert.deepEqual(placeholders(en[key]), placeholders(zh[key]), `placeholder mismatch ${key}`);
}
for (const [prefix, values] of [["event", EVENT_BEATS], ["motif", MOTIFS], ["hunter", [...HUNTER_MOVES, ...HUNTER_STANCES]]] as const) {
  for (const value of values) assert.ok(`${prefix}_${value}` in en, `missing dynamic label ${prefix}_${value}`);
}
const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
for (const match of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) assert.ok(match[1] in en, `unknown HTML dictionary key ${match[1]}`);
assert.ok(html.includes('value="en" lang="en">English') && html.includes('value="zh-CN" lang="zh-CN">简体中文'));
console.log("i18n assertions passed: detection, persistence, blocked storage, live updates, dictionaries, dynamic labels, accessible markup.");
