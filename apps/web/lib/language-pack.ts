export type LanguageDirection = "ltr" | "rtl" | "ttb";

export interface LanguagePack {
  schemaVersion: 1;
  id: string;
  name: Record<string, string>;
  accent: string;
  scripts: Array<{
    code: string;
    name: Record<string, string>;
    direction: LanguageDirection;
    primary: boolean;
  }>;
  readingSystems: unknown[];
  pronunciationFeatures: unknown[];
  segmentation: { strategy: string };
  speech: { recognitionLocales: string[]; synthesisLocales: string[] };
}

export const builtInLanguagePacks: LanguagePack[] = [
  {
    schemaVersion: 1,
    id: "ja",
    name: { "zh-CN": "日语", native: "日本語" },
    accent: "桜",
    scripts: [
      { code: "Jpan", name: { "zh-CN": "日文", native: "日本語" }, direction: "ltr", primary: true },
    ],
    readingSystems: [],
    pronunciationFeatures: [],
    segmentation: { strategy: "dictionary" },
    speech: { recognitionLocales: ["ja-JP"], synthesisLocales: ["ja-JP"] },
  },
  {
    schemaVersion: 1,
    id: "yue-Hant-HK",
    name: { "zh-CN": "粤语", native: "粵語" },
    accent: "粵",
    scripts: [
      { code: "Hant", name: { "zh-CN": "繁体中文", native: "繁體中文" }, direction: "ltr", primary: true },
    ],
    readingSystems: [],
    pronunciationFeatures: [],
    segmentation: { strategy: "dictionary" },
    speech: { recognitionLocales: ["yue-Hant-HK"], synthesisLocales: ["yue-Hant-HK"] },
  },
];

export function languageName(pack: LanguagePack, locale: "zh-CN" | "native" = "zh-CN") {
  return pack.name[locale] ?? pack.name["zh-CN"] ?? pack.name.native ?? pack.id;
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
  if (!pack.speech || !Array.isArray(pack.speech.recognitionLocales) || !Array.isArray(pack.speech.synthesisLocales)) return { error: "speech 需要 recognitionLocales 与 synthesisLocales 数组" };

  return {
    pack: {
      ...(pack as LanguagePack),
      accent: pack.accent?.trim().slice(0, 2) || pack.id.slice(0, 2).toUpperCase(),
      readingSystems: Array.isArray(pack.readingSystems) ? pack.readingSystems : [],
      pronunciationFeatures: Array.isArray(pack.pronunciationFeatures) ? pack.pronunciationFeatures : [],
    },
  };
}
