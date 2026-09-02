export const MAX_PRONUNCIATION_TEXT_LENGTH = 1_000;

export type PronunciationSpeed = "normal" | "slow";

export interface PronunciationVoice {
  id: string;
  name: string;
  languageTag: string;
  default: boolean;
  localService: boolean;
}

export interface PronunciationPreference {
  voiceId?: string;
  speed: PronunciationSpeed;
}

export type PronunciationPreferences = Record<string, PronunciationPreference>;

export interface PronunciationRequest {
  text: string;
  languageTag: string;
  rate: number;
  voiceId?: string;
}

export interface PronunciationEvents {
  onStart?: () => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

/** Client-owned output port. The learning engine never depends on a speech API. */
export interface PronunciationPlayer {
  isSupported(): boolean;
  voices(): Promise<readonly PronunciationVoice[]>;
  speak(request: PronunciationRequest, events?: PronunciationEvents): void | Promise<void>;
  stop(): void | Promise<void>;
}

export function createPronunciationRequest(
  text: string,
  languageTag: string,
  speed: PronunciationSpeed = "normal",
  voiceId?: string,
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
  const normalizedVoiceId = voiceId?.trim();
  return {
    text: normalizedText,
    languageTag: normalizedLanguageTag,
    rate: speed === "slow" ? 0.72 : 1,
    ...(normalizedVoiceId ? { voiceId: normalizedVoiceId } : {}),
  };
}

function comparableLanguageTag(languageTag: string) {
  return languageTag.trim().replaceAll("_", "-").toLowerCase();
}

export function pronunciationVoiceMatchesLanguage(voiceLanguageTag: string, targetLanguageTag: string) {
  const voice = comparableLanguageTag(voiceLanguageTag);
  const target = comparableLanguageTag(targetLanguageTag);
  if (!voice || !target) return false;
  if (voice === target || voice.startsWith(`${target}-`) || target.startsWith(`${voice}-`)) return true;
  return voice.split("-")[0] === target.split("-")[0];
}

export function matchingPronunciationVoices(
  voices: readonly PronunciationVoice[],
  languageTag: string,
): PronunciationVoice[] {
  const exactTag = comparableLanguageTag(languageTag);
  return voices
    .filter((voice) => pronunciationVoiceMatchesLanguage(voice.languageTag, languageTag))
    .sort((left, right) => {
      const leftExact = comparableLanguageTag(left.languageTag) === exactTag ? 1 : 0;
      const rightExact = comparableLanguageTag(right.languageTag) === exactTag ? 1 : 0;
      if (leftExact !== rightExact) return rightExact - leftExact;
      if (left.default !== right.default) return left.default ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
}

export function pronunciationPreference(
  preferences: PronunciationPreferences,
  languageTag: string,
): PronunciationPreference {
  return preferences[languageTag] ?? { speed: "normal" };
}

export function setPronunciationPreference(
  preferences: PronunciationPreferences,
  languageTag: string,
  preference: PronunciationPreference,
): PronunciationPreferences {
  const voiceId = preference.voiceId?.trim();
  return {
    ...preferences,
    [languageTag]: {
      speed: preference.speed === "slow" ? "slow" : "normal",
      ...(voiceId ? { voiceId } : {}),
    },
  };
}

export function normalizePronunciationPreferences(value: unknown): PronunciationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: PronunciationPreferences = {};
  for (const [languageTag, raw] of Object.entries(value)) {
    if (!languageTag.trim() || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const candidate = raw as { speed?: unknown; voiceId?: unknown };
    const speed: PronunciationSpeed = candidate.speed === "slow" ? "slow" : "normal";
    const voiceId = typeof candidate.voiceId === "string" ? candidate.voiceId.trim() : "";
    result[languageTag] = { speed, ...(voiceId ? { voiceId } : {}) };
  }
  return result;
}
