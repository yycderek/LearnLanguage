import assert from "node:assert/strict";
import test from "node:test";
import { createPronunciationRequest } from "@learn-language/application/pronunciation";
import { createWebPronunciationPlayer } from "../lib/pronunciation.ts";

class FakeUtterance {
  constructor(text) { this.text = text; }
  lang = "";
  rate = 1;
  onstart = null;
  onend = null;
  onerror = null;
}

test("Web pronunciation maps a platform-neutral request to SpeechSynthesis", () => {
  const calls = [];
  const controller = {
    cancel: () => calls.push("cancel"),
    speak: (utterance) => {
      calls.push({ text: utterance.text, lang: utterance.lang, rate: utterance.rate });
      utterance.onstart?.();
      utterance.onend?.();
    },
  };
  const player = createWebPronunciationPlayer(controller, (text) => new FakeUtterance(text));
  const events = [];
  player.speak(createPronunciationRequest("¿Dónde está la farmacia?", "es", "slow"), {
    onStart: () => events.push("start"),
    onDone: () => events.push("done"),
  });
  assert.equal(player.isSupported(), true);
  assert.deepEqual(calls, ["cancel", { text: "¿Dónde está la farmacia?", lang: "es", rate: 0.72 }]);
  assert.deepEqual(events, ["start", "done"]);
});

test("Web pronunciation reports an unavailable client without changing product state", () => {
  const errors = [];
  const player = createWebPronunciationPlayer(undefined, undefined);
  player.speak(createPronunciationRequest("Hello", "en"), { onError: (message) => errors.push(message) });
  assert.equal(player.isSupported(), false);
  assert.deepEqual(errors, ["speech-synthesis-unavailable"]);
});

test("Web pronunciation stops queued speech and treats cancellation as completion", () => {
  let utterance;
  let cancels = 0;
  const controller = {
    cancel: () => { cancels += 1; },
    speak: (value) => { utterance = value; },
  };
  const player = createWebPronunciationPlayer(controller, (text) => new FakeUtterance(text));
  const events = [];
  player.speak(createPronunciationRequest("こんにちは", "ja"), { onDone: () => events.push("done") });
  utterance.onerror?.({ error: "interrupted" });
  player.stop();
  assert.equal(cancels, 2);
  assert.deepEqual(events, ["done"]);
});
