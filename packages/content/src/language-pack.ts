import type { Exercise, LanguageCapability, LanguageDefinition } from "@learn-language/protocol";
import { resolveLanguageRuntime } from "@learn-language/language-runtime";

const LANGUAGE_CAPABILITIES = new Set(["normalization", "segmentation", "token-comparison", "script-detection", "reading-transform"]);

export type LanguagePack = LanguageDefinition;
export type { LanguageDirection } from "@learn-language/protocol";

export const builtInLanguagePacks: LanguagePack[] = [
  {
    schemaVersion: 1,
    id: "en",
    name: { "zh-CN": "英语", en: "English", native: "English" },
    accent: "En",
    scripts: [
      { code: "Latn", name: { "zh-CN": "拉丁字母", en: "Latin alphabet", native: "Latin alphabet" }, direction: "ltr", primary: true },
    ],
    readingSystems: [],
    segmentation: { strategy: "whitespace" },
  },
  {
    schemaVersion: 1,
    id: "ja",
    name: { "zh-CN": "日语", en: "Japanese", native: "日本語" },
    accent: "樱",
    scripts: [
      { code: "Jpan", name: { "zh-CN": "日文", en: "Japanese script", native: "日本語" }, direction: "ltr", primary: true },
    ],
    readingSystems: [],
    segmentation: { strategy: "adapter" },
    adapter: {
      id: "core.japanese",
      version: "1.0.0",
      capabilities: ["normalization", "segmentation", "script-detection"],
    },
  },
  {
    schemaVersion: 1,
    id: "yue-Hant-HK",
    name: { "zh-CN": "粤语", en: "Cantonese", native: "粵語" },
    accent: "粤",
    scripts: [
      { code: "Hant", name: { "zh-CN": "繁体中文", en: "Traditional Chinese", native: "繁體中文" }, direction: "ltr", primary: true },
    ],
    readingSystems: [],
    segmentation: { strategy: "adapter" },
    adapter: {
      id: "core.cantonese",
      version: "1.0.0",
      capabilities: ["normalization", "segmentation", "script-detection"],
    },
  },
];

export function languageName(pack: LanguagePack, locale: "zh-CN" | "en" | "native" = "zh-CN") {
  return pack.name[locale] ?? pack.name["zh-CN"] ?? pack.name.native ?? pack.id;
}

export interface ExerciseCapabilityResolution {
  mode: "native" | "self-assessment" | "reference-answer" | "disabled";
  missing: LanguageCapability[];
}

export function languageCapabilities(pack: LanguagePack): ReadonlySet<LanguageCapability> {
  return resolveLanguageRuntime(pack).capabilities;
}

export function resolveExerciseCapabilities(exercise: Exercise, pack: LanguagePack): ExerciseCapabilityResolution {
  const available = languageCapabilities(pack);
  const missing = (exercise.requiredCapabilities ?? []).filter((capability) => !available.has(capability));
  if (missing.length === 0) return { mode: "native", missing };
  return { mode: exercise.capabilityFallback ?? "disabled", missing };
}

export function validateLanguagePack(input: string): { pack?: LanguagePack; error?: string } {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch (error) {
    return { error: error instanceof Error ? `JSON 格式无效：${error.message}` : "JSON 格式无效" };
  }

  if (!value || typeof value !== "object") return { error: "Language Pack 必须是 JSON 对象" };
  const pack = value as Partial<LanguagePack>;
  if (pack.schemaVersion !== 1) return { error: "当前仅支持 schemaVersion 1" };
  if (!pack.id || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(pack.id)) return { error: "id 只能包含字母、数字、点、下划线和连字符" };
  if (!pack.name || typeof pack.name !== "object" || !Object.values(pack.name).some(Boolean)) return { error: "name 至少需要一个语言名称" };
  if (!Array.isArray(pack.scripts) || pack.scripts.length === 0) return { error: "scripts 至少需要一种书写系统" };
  if (pack.scripts.some((script) => !script?.code || !["ltr", "rtl", "ttb"].includes(script.direction))) return { error: "书写系统需要 code 和有效的 direction" };
  if (!pack.segmentation?.strategy) return { error: "segmentation.strategy 不能为空" };
  if (!["whitespace", "grapheme", "character", "script-run", "adapter"].includes(pack.segmentation.strategy)) return { error: "segmentation.strategy 不受支持" };
  if (Object.values(pack.name).some((name) => typeof name !== "string" || !name.trim())) return { error: "语言名称必须是非空文本" };
  const scriptCodes = new Set<string>();
  for (const script of pack.scripts) {
    if (!script.name || typeof script.name !== "object" || !Object.values(script.name).some((name) => typeof name === "string" && name.trim())) return { error: "每种书写系统至少需要一个名称" };
    if (scriptCodes.has(script.code)) return { error: `书写系统 code 重复：${script.code}` };
    scriptCodes.add(script.code);
  }
  if (pack.scripts.filter((script) => script.primary).length !== 1) return { error: "Language Pack 必须且只能有一种主要书写系统" };
  if (pack.adapter) {
    if (!pack.adapter.id || !pack.adapter.version) return { error: "adapter 需要 id 和 version" };
    if (!Array.isArray(pack.adapter.capabilities)) return { error: "adapter.capabilities 必须是数组" };
    if (pack.adapter.capabilities.some((capability) => !LANGUAGE_CAPABILITIES.has(capability))) return { error: "adapter.capabilities 包含不受支持的能力" };
  }
  if (pack.segmentation.strategy === "adapter" && !pack.adapter) return { error: "adapter 分词策略需要 adapter 定义" };

  return {
    pack: {
      ...(pack as LanguagePack),
      accent: pack.accent?.trim().slice(0, 2) || pack.id.slice(0, 2).toUpperCase(),
      readingSystems: Array.isArray(pack.readingSystems) ? pack.readingSystems : [],
    },
  };
}
