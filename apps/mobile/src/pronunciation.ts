import * as Speech from "expo-speech";
import type {
  PronunciationEvents,
  PronunciationPlayer,
  PronunciationRequest,
  PronunciationVoice,
} from "@learn-language/application/pronunciation";

let playbackGeneration = 0;

export const mobilePronunciationPlayer: PronunciationPlayer = {
  isSupported: () => true,
  async voices(): Promise<readonly PronunciationVoice[]> {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.map((voice) => ({
      id: voice.identifier,
      name: voice.name,
      languageTag: voice.language,
      default: false,
      localService: false,
    }));
  },
  speak(request: PronunciationRequest, events?: PronunciationEvents) {
    const generation = ++playbackGeneration;
    void Speech.stop().then(async () => {
      if (generation !== playbackGeneration) return;
      let voiceId: string | undefined;
      if (request.voiceId) {
        const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
        if (generation !== playbackGeneration) return;
        if (voices.some((voice) => voice.identifier === request.voiceId)) voiceId = request.voiceId;
      }
      Speech.speak(request.text, {
        language: request.languageTag,
        rate: request.rate,
        ...(voiceId ? { voice: voiceId } : {}),
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
