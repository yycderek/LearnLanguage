export const MAX_PRONUNCIATION_TEXT_LENGTH = 1_000;

export type PronunciationSpeed = "normal" | "slow";

export interface PronunciationRequest {
  text: string;
  languageTag: string;
  rate: number;
}

export interface PronunciationEvents {
  onStart?: () => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

/** Client-owned output port. The learning engine never depends on a speech API. */
export interface PronunciationPlayer {
  isSupported(): boolean;
  speak(request: PronunciationRequest, events?: PronunciationEvents): void | Promise<void>;
  stop(): void | Promise<void>;
}

export function createPronunciationRequest(
  text: string,
  languageTag: string,
  speed: PronunciationSpeed = "normal",
): PronunciationRequest {
  const normalizedText = text.trim();
  const normalizedLanguageTag = languageTag.trim();
  if (!normalizedText) throw new Error("Pronunciation text cannot be empty");
  if (normalizedText.length > MAX_PRONUNCIATION_TEXT_LENGTH) {
    throw new Error(`Pronunciation text cannot exceed ${MAX_PRONUNCIATION_TEXT_LENGTH} characters`);
  }
  if (!normalizedLanguageTag || normalizedLanguageTag.length > 63) {
    throw new Error("Pronunciation language tag is invalid");
  }
  return {
    text: normalizedText,
    languageTag: normalizedLanguageTag,
    rate: speed === "slow" ? 0.72 : 1,
  };
}
