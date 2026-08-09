import type { LanguageCapability, LanguageDefinition } from "@learn-language/protocol";

export interface LanguageToken {
  text: string;
  start: number;
  end: number;
}

export interface DetectedScript {
  code: string;
  text: string;
}

export interface LanguageAdapter {
  readonly id: string;
  readonly version: string;
  readonly capabilities: ReadonlySet<LanguageCapability>;
  normalize(text: string): string;
  segment(text: string, locale?: string): LanguageToken[];
  detectScripts(text: string): DetectedScript[];
}

export interface ResolvedLanguageRuntime {
  readonly languageId: string;
  readonly adapterId: string;
  readonly capabilities: ReadonlySet<LanguageCapability>;
  normalize(text: string): string;
  segment(text: string): LanguageToken[];
  detectScripts(text: string): DetectedScript[];
}

function scriptOf(character: string): string {
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(character)) return "Jpan";
  if (/\p{Script=Han}/u.test(character)) return "Hani";
  if (/\p{Script=Latin}/u.test(character)) return "Latn";
  if (/\p{Script=Arabic}/u.test(character)) return "Arab";
  return "Zyyy";
}

function detectScriptRuns(text: string): DetectedScript[] {
  const runs: DetectedScript[] = [];
  for (const character of text) {
    const code = scriptOf(character);
    const previous = runs.at(-1);
    if (previous?.code === code) previous.text += character;
    else runs.push({ code, text: character });
  }
  return runs;
}

function tokensFromParts(text: string, parts: string[]): LanguageToken[] {
  const tokens: LanguageToken[] = [];
  let cursor = 0;
  for (const part of parts) {
    const start = text.indexOf(part, cursor);
    if (start < 0) continue;
    const end = start + part.length;
    tokens.push({ text: part, start, end });
    cursor = end;
  }
  return tokens;
}

function intlSegments(text: string, locale: string, granularity: "word" | "grapheme") {
  const segments = [...new Intl.Segmenter(locale, { granularity }).segment(text)]
    .filter((segment) => granularity === "grapheme" || segment.isWordLike)
    .map((segment) => segment.segment);
  return tokensFromParts(text, segments);
}

function createAdapter(id: string, locale: string): LanguageAdapter {
  return {
    id,
    version: "1.0.0",
    capabilities: new Set<LanguageCapability>(["normalization", "segmentation", "script-detection"]),
    normalize: (text) => text.normalize("NFC").trim(),
    segment: (text, requestedLocale) => intlSegments(text, requestedLocale ?? locale, "word"),
    detectScripts: detectScriptRuns,
  };
}

export class LanguageAdapterRegistry {
  readonly #adapters = new Map<string, LanguageAdapter>();

  constructor(adapters: Iterable<LanguageAdapter> = builtInLanguageAdapters) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: LanguageAdapter) {
    this.#adapters.set(adapter.id, adapter);
  }

  get(id: string) {
    return this.#adapters.get(id);
  }
}

export const builtInLanguageAdapters: readonly LanguageAdapter[] = [
  createAdapter("core.japanese", "ja"),
  createAdapter("core.cantonese", "zh-Hant-HK"),
];

function genericSegment(language: LanguageDefinition, text: string): LanguageToken[] {
  switch (language.segmentation.strategy) {
    case "whitespace":
      return tokensFromParts(text, text.trim().split(/\s+/).filter(Boolean));
    case "character":
    case "grapheme":
      return intlSegments(text, language.id, "grapheme");
    case "script-run":
      return tokensFromParts(text, detectScriptRuns(text).map((run) => run.text));
    case "adapter":
      return [];
  }
}

export function resolveLanguageRuntime(
  language: LanguageDefinition,
  registry: LanguageAdapterRegistry = new LanguageAdapterRegistry(),
): ResolvedLanguageRuntime {
  const registeredAdapter = language.adapter ? registry.get(language.adapter.id) : undefined;
  const adapter = registeredAdapter?.version === language.adapter?.version ? registeredAdapter : undefined;
  const capabilities = new Set<LanguageCapability>(["normalization", "script-detection"]);
  if (adapter) {
    for (const capability of adapter.capabilities) capabilities.add(capability);
  } else if (language.segmentation.strategy !== "adapter") {
    capabilities.add("segmentation");
  }

  return {
    languageId: language.id,
    adapterId: adapter?.id ?? "core.generic",
    capabilities,
    normalize: (text) => adapter?.normalize(text) ?? text.normalize("NFC").trim(),
    segment: (text) => adapter?.segment(text, language.id) ?? genericSegment(language, text),
    detectScripts: (text) => adapter?.detectScripts(text) ?? detectScriptRuns(text),
  };
}
