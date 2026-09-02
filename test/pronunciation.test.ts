import { describe, expect, it } from "vitest";
import {
  MAX_PRONUNCIATION_TEXT_LENGTH,
  createPronunciationRequest,
  matchingPronunciationVoices,
  normalizePronunciationPreferences,
  pronunciationPreference,
  setPronunciationPreference,
  type PronunciationPlayer,
} from "@learn-language/application";

describe("pronunciation application boundary", () => {
  it("builds platform-neutral normal and slow requests from a Language Pack id", () => {
    expect(createPronunciationRequest("  こんにちは。 ", "ja")).toEqual({
      text: "こんにちは。",
      languageTag: "ja",
      rate: 1,
    });
    expect(createPronunciationRequest("我想要一杯茶。", "yue-Hant-HK", "slow")).toEqual({
      text: "我想要一杯茶。",
      languageTag: "yue-Hant-HK",
      rate: 0.72,
    });
  });

  it("rejects empty, oversized, and invalid requests before reaching a client", () => {
    expect(() => createPronunciationRequest("  ", "en")).toThrow("cannot be empty");
    expect(() => createPronunciationRequest("a".repeat(MAX_PRONUNCIATION_TEXT_LENGTH + 1), "en")).toThrow("cannot exceed");
    expect(() => createPronunciationRequest("hello", " ")).toThrow("language tag is invalid");
  });

  it("defines a client-owned port without creating learning evidence", async () => {
    const calls: string[] = [];
    const player: PronunciationPlayer = {
      isSupported: () => true,
      voices: async () => [],
      speak: async (request, events) => {
        calls.push(`${request.languageTag}:${request.text}`);
        events?.onStart?.();
        events?.onDone?.();
      },
      stop: () => { calls.push("stop"); },
    };
    const events: string[] = [];
    await player.speak(createPronunciationRequest("Hola.", "es"), {
      onStart: () => events.push("start"),
      onDone: () => events.push("done"),
    });
    await player.stop();
    expect(calls).toEqual(["es:Hola.", "stop"]);
    expect(events).toEqual(["start", "done"]);
  });

  it("matches exact and base-language voices without language-specific branches", () => {
    const voices = [
      { id: "en-gb", name: "British", languageTag: "en-GB", default: false, localService: true },
      { id: "ja", name: "Japanese", languageTag: "ja-JP", default: true, localService: true },
      { id: "en-us", name: "American", languageTag: "en-US", default: true, localService: false },
    ];
    expect(matchingPronunciationVoices(voices, "en-US").map((voice) => voice.id)).toEqual(["en-us", "en-gb"]);
    expect(matchingPronunciationVoices(voices, "ja").map((voice) => voice.id)).toEqual(["ja"]);
  });

  it("normalizes and updates per-language pronunciation preferences", () => {
    const normalized = normalizePronunciationPreferences({
      en: { speed: "slow", voiceId: " voice-en " },
      ja: { speed: "unexpected" },
      invalid: null,
    });
    expect(normalized).toEqual({ en: { speed: "slow", voiceId: "voice-en" }, ja: { speed: "normal" } });
    expect(pronunciationPreference(normalized, "es")).toEqual({ speed: "normal" });
    expect(setPronunciationPreference(normalized, "es", { speed: "slow", voiceId: "" })).toEqual({
      ...normalized,
      es: { speed: "slow" },
    });
    expect(createPronunciationRequest("Hola", "es", "normal", " es-voice ")).toMatchObject({ voiceId: "es-voice" });
  });
});
