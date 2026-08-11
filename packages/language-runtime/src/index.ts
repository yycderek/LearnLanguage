import type { CoursePack, LanguageCapability, LanguageDefinition } from "@learn-language/protocol";

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
  readonly adapterVersion?: string;
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

export function languageAdapterPin(language: LanguageDefinition): { id: string; version: string } {
  return language.adapter
    ? { id: language.adapter.id, version: language.adapter.version }
    : { id: "core.generic", version: "1.0.0" };
}

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
    ...(adapter ? { adapterVersion: adapter.version } : {}),
    capabilities,
    normalize: (text) => adapter?.normalize(text) ?? text.normalize("NFC").trim(),
    segment: (text) => adapter?.segment(text, language.id) ?? genericSegment(language, text),
    detectScripts: (text) => adapter?.detectScripts(text) ?? detectScriptRuns(text),
  };
}

export type LanguageCompatibilityIssueCode =
  | "language-pack-missing"
  | "language-id-mismatch"
  | "course-adapter-mismatch"
  | "adapter-unavailable"
  | "generic-runtime-cannot-run-adapter-segmentation"
  | "exercise-capability-fallback"
  | "exercise-capability-missing";

export interface LanguageCompatibilityIssue {
  code: LanguageCompatibilityIssueCode;
  severity: "degraded" | "blocked";
  exerciseId?: string;
  capability?: LanguageCapability;
  expected?: string;
  actual?: string;
}

export interface LanguageCompatibilityReport {
  status: "compatible" | "degraded" | "blocked";
  courseId: string;
  languageId: string;
  runtimeAdapterId?: string;
  runtimeAdapterVersion?: string;
  capabilities: readonly LanguageCapability[];
  issues: readonly LanguageCompatibilityIssue[];
}

export function assessCourseLanguageCompatibility(
  course: CoursePack,
  language: LanguageDefinition | undefined,
  registry: LanguageAdapterRegistry = new LanguageAdapterRegistry(),
): LanguageCompatibilityReport {
  const issues: LanguageCompatibilityIssue[] = [];
  if (!language) {
    return {
      status: "blocked",
      courseId: course.manifest.id,
      languageId: course.manifest.languageId,
      capabilities: [],
      issues: [{ code: "language-pack-missing", severity: "blocked", expected: course.manifest.languageId }],
    };
  }
  if (language.id !== course.manifest.languageId) {
    return {
      status: "blocked",
      courseId: course.manifest.id,
      languageId: course.manifest.languageId,
      capabilities: [],
      issues: [{ code: "language-id-mismatch", severity: "blocked", expected: course.manifest.languageId, actual: language.id }],
    };
  }

  const runtime = resolveLanguageRuntime(language, registry);
  const pinned = course.manifest.languageAdapter;
  if (pinned?.id === "core.generic") {
    if (language.segmentation.strategy === "adapter") {
      issues.push({ code: "generic-runtime-cannot-run-adapter-segmentation", severity: "blocked", expected: pinned.id, actual: language.adapter?.id ?? "missing" });
    }
  } else if (pinned) {
    const declared = language.adapter;
    if (!declared || declared.id !== pinned.id || declared.version !== pinned.version) {
      issues.push({
        code: "course-adapter-mismatch",
        severity: "blocked",
        expected: `${pinned.id}@${pinned.version}`,
        actual: declared ? `${declared.id}@${declared.version}` : "missing",
      });
    } else if (runtime.adapterId !== pinned.id || runtime.adapterVersion !== pinned.version) {
      issues.push({
        code: "adapter-unavailable",
        severity: "blocked",
        expected: `${pinned.id}@${pinned.version}`,
        actual: `${runtime.adapterId}@${runtime.adapterVersion ?? "unknown"}`,
      });
    }
  }

  for (const exercise of course.exercises) {
    for (const capability of exercise.requiredCapabilities ?? []) {
      if (runtime.capabilities.has(capability)) continue;
      if (exercise.capabilityFallback) {
        issues.push({ code: "exercise-capability-fallback", severity: "degraded", exerciseId: exercise.id, capability });
      } else {
        issues.push({ code: "exercise-capability-missing", severity: "blocked", exerciseId: exercise.id, capability });
      }
    }
  }

  const status = issues.some((issue) => issue.severity === "blocked")
    ? "blocked"
    : issues.some((issue) => issue.severity === "degraded") ? "degraded" : "compatible";
  return {
    status,
    courseId: course.manifest.id,
    languageId: course.manifest.languageId,
    runtimeAdapterId: runtime.adapterId,
    ...(runtime.adapterVersion ? { runtimeAdapterVersion: runtime.adapterVersion } : {}),
    capabilities: [...runtime.capabilities].sort(),
    issues,
  };
}
