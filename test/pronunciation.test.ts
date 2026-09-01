import { describe, expect, it } from "vitest";
import {
  MAX_PRONUNCIATION_TEXT_LENGTH,
  createPronunciationRequest,
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
});
