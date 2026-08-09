import type { LocalizedText } from "@learn-language/protocol";

export type TeachingLocale = "zh-CN" | "en";
export type UiLocale = "zh-CN" | "en";

export const TEACHING_LOCALE_PREFERENCE_KEY = "teaching-locale";
export const UI_LOCALE_PREFERENCE_KEY = "ui-locale";
export const teachingLocales: readonly TeachingLocale[] = ["zh-CN", "en"];

export function normalizeTeachingLocale(value: unknown): TeachingLocale {
  return value === "en" ? "en" : "zh-CN";
}

export function normalizeUiLocale(value: unknown): UiLocale {
  return value === "en" ? "en" : "zh-CN";
}

export function uiText(locale: TeachingLocale | UiLocale, chinese: string, english: string): string {
  return locale === "en" ? english : chinese;
}

export function localizedText(value: LocalizedText | undefined, locale: TeachingLocale): string {
  if (!value) return uiText(locale, "未命名", "Untitled");
  const matchingPrefix = Object.entries(value).find(([key]) => key.toLowerCase().startsWith(`${locale.toLowerCase()}-`))?.[1];
  return value[locale]
    ?? matchingPrefix
    ?? (locale === "en" ? value.en : value["zh-CN"] ?? value.zh)
    ?? value["zh-CN"]
    ?? value.en
    ?? value.native
    ?? Object.values(value)[0]
    ?? uiText(locale, "未命名", "Untitled");
}

export function dateLocale(locale: TeachingLocale | UiLocale): string {
  return locale === "en" ? "en-US" : "zh-CN";
}
