import type {
  PronunciationEvents,
  PronunciationPlayer,
  PronunciationRequest,
} from "@learn-language/application/pronunciation";

type SpeechController = Pick<SpeechSynthesis, "cancel" | "speak">;
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
    speak(request: PronunciationRequest, events?: PronunciationEvents) {
      if (!browser.controller || !browser.createUtterance) {
        events?.onError?.("speech-synthesis-unavailable");
        return;
      }
      browser.controller.cancel();
      const utterance = browser.createUtterance(request.text);
      utterance.lang = request.languageTag;
      utterance.rate = request.rate;
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
