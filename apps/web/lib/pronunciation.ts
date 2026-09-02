import type {
  PronunciationEvents,
  PronunciationPlayer,
  PronunciationRequest,
  PronunciationVoice,
} from "@learn-language/application/pronunciation";

type SpeechController = Pick<SpeechSynthesis, "cancel" | "speak"> & Partial<Pick<SpeechSynthesis, "getVoices" | "addEventListener" | "removeEventListener">>;
type UtteranceFactory = (text: string) => SpeechSynthesisUtterance;

function browserDependencies(): { controller?: SpeechController; createUtterance?: UtteranceFactory } {
  if (typeof window === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return {};
  if (!("speechSynthesis" in window)) return {};
  return {
    controller: window.speechSynthesis,
    createUtterance: (text) => new SpeechSynthesisUtterance(text),
  };
}

export function createWebPronunciationPlayer(
  controller?: SpeechController,
  createUtterance?: UtteranceFactory,
): PronunciationPlayer {
  const browser = controller && createUtterance ? { controller, createUtterance } : browserDependencies();
  return {
    isSupported: () => Boolean(browser.controller && browser.createUtterance),
    async voices(): Promise<readonly PronunciationVoice[]> {
      return (browser.controller?.getVoices?.() ?? []).map((voice) => ({
        id: voice.voiceURI,
        name: voice.name,
        languageTag: voice.lang,
        default: voice.default,
        localService: voice.localService,
      }));
    },
    speak(request: PronunciationRequest, events?: PronunciationEvents) {
      if (!browser.controller || !browser.createUtterance) {
        events?.onError?.("speech-synthesis-unavailable");
        return;
      }
      browser.controller.cancel();
      const utterance = browser.createUtterance(request.text);
      utterance.lang = request.languageTag;
      utterance.rate = request.rate;
      if (request.voiceId) {
        const voice = browser.controller.getVoices?.().find((candidate) => candidate.voiceURI === request.voiceId);
        if (voice) utterance.voice = voice;
      }
      utterance.onstart = () => events?.onStart?.();
      utterance.onend = () => events?.onDone?.();
      utterance.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") events?.onDone?.();
        else events?.onError?.(event.error || "speech-synthesis-failed");
      };
      browser.controller.speak(utterance);
    },
    stop() {
      browser.controller?.cancel();
    },
  };
}

export function subscribeToWebPronunciationVoices(listener: () => void) {
  const browser = browserDependencies();
  browser.controller?.addEventListener?.("voiceschanged", listener);
  return () => browser.controller?.removeEventListener?.("voiceschanged", listener);
}
