import type { LocalizedText } from "@learn-language/protocol";

export type AppLocale = "zh-CN" | "en";
export type TeachingLocale = AppLocale;
export type UiLocale = AppLocale;

export const APP_LOCALE_PREFERENCE_KEY = "app-locale";
export const TEACHING_LOCALE_PREFERENCE_KEY = "teaching-locale";
export const UI_LOCALE_PREFERENCE_KEY = "ui-locale";
export const teachingLocales: readonly AppLocale[] = ["zh-CN", "en"];

export function normalizeAppLocale(value: unknown): AppLocale {
  return value === "en" ? "en" : "zh-CN";
}

export function resolveStoredAppLocale(appLocale: unknown, uiLocale: unknown, teachingLocale: unknown): AppLocale {
  return normalizeAppLocale(appLocale ?? uiLocale ?? teachingLocale);
}

export function normalizeTeachingLocale(value: unknown): TeachingLocale {
  return normalizeAppLocale(value);
}

export function normalizeUiLocale(value: unknown): UiLocale {
  return normalizeAppLocale(value);
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
