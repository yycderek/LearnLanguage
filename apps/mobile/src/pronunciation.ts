import * as Speech from "expo-speech";
import type {
  PronunciationEvents,
  PronunciationPlayer,
  PronunciationRequest,
} from "@learn-language/application/pronunciation";

let playbackGeneration = 0;

export const mobilePronunciationPlayer: PronunciationPlayer = {
  isSupported: () => true,
  speak(request: PronunciationRequest, events?: PronunciationEvents) {
    const generation = ++playbackGeneration;
    void Speech.stop().then(() => {
      if (generation !== playbackGeneration) return;
      Speech.speak(request.text, {
        language: request.languageTag,
        rate: request.rate,
        onStart: () => { if (generation === playbackGeneration) events?.onStart?.(); },
        onDone: () => { if (generation === playbackGeneration) events?.onDone?.(); },
        onStopped: () => { if (generation === playbackGeneration) events?.onDone?.(); },
        onError: (error) => { if (generation === playbackGeneration) events?.onError?.(error.message || "speech-synthesis-failed"); },
      });
    }).catch((error: unknown) => {
      if (generation === playbackGeneration) events?.onError?.(error instanceof Error ? error.message : "speech-synthesis-failed");
    });
  },
  stop() {
    playbackGeneration += 1;
    return Speech.stop();
  },
};
