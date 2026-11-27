import { test } from "node:test";
import assert from "node:assert/strict";
import { speakable, voiceItem, MAX_CHARS } from "./voice.mjs";

test("speakable drops links, emoji and markdown", () => {
  assert.equal(speakable("☀️ *בוקר טוב*\n- פגישה ב-16:00\nhttps://x.co/a"), "בוקר טוב\nפגישה ב-16:00");
});

test("speakable caps length and handles empty", () => {
  assert.equal(speakable("א".repeat(5000)).length, MAX_CHARS);
  assert.equal(speakable(""), "");
  assert.equal(speakable(undefined), "");
});

test("voiceItem goes to the owner (no to) and points at the audio doc", () => {
  const x = voiceItem({ id: "abc", at: "2026-11-27T06:00:00Z", text: "שלום\nעולם" });
  assert.equal(x.voice, "abc");
  assert.equal(x.to, undefined);
  assert.equal(x.templateParam, "שלום עולם");
  assert.ok(x.text.startsWith("🎙️"));
});
