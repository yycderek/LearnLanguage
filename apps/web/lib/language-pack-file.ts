import { languagePackReferenceUsage, type LanguagePackReferenceUsage } from "@learn-language/application/workspace";
import { validateLanguagePack, type LanguagePack } from "./language-pack.ts";

export const MAX_LANGUAGE_PACK_FILE_BYTES = 1024 * 1024;
const LANGUAGE_CAPABILITIES = new Set(["normalization", "segmentation", "token-comparison", "script-detection", "reading-transform"]);

export type LanguagePackUsage = LanguagePackReferenceUsage;

export function parseLanguagePackFile(text: string): { pack?: LanguagePack; error?: string } {
  const result = validateLanguagePack(text);
  if (!result.pack) return result;
  const pack = result.pack;
  if (Object.values(pack.name).some((value) => typeof value !== "string" || !value.trim())) {
    return { error: "语言名称必须是非空文本" };
  }
  const scriptCodes = new Set<string>();
  for (const script of pack.scripts) {
    if (!script.name || typeof script.name !== "object" || !Object.values(script.name).some((value) => typeof value === "string" && value.trim())) {
      return { error: "每种书写系统至少需要一个名称" };
    }
    if (scriptCodes.has(script.code)) return { error: `书写系统 code 重复：${script.code}` };
    scriptCodes.add(script.code);
  }
  if (pack.scripts.filter((script) => script.primary).length !== 1) {
    return { error: "Language Pack 必须且只能有一种主要书写系统" };
  }
  if (pack.adapter) {
    if (!pack.adapter.id || !pack.adapter.version) return { error: "adapter 需要 id 和 version" };
    if (!Array.isArray(pack.adapter.capabilities)) return { error: "adapter.capabilities 必须是数组" };
    if (pack.adapter.capabilities.some((capability) => !LANGUAGE_CAPABILITIES.has(capability))) return { error: "adapter.capabilities 包含不受支持的能力" };
  }
  if (pack.segmentation.strategy === "adapter" && !pack.adapter) return { error: "adapter 分词策略需要 adapter 定义" };
  return { pack };
}

export function serializeLanguagePackFile(pack: LanguagePack) {
  return `${JSON.stringify(pack, null, 2)}\n`;
}

export function languagePackFileName(pack: LanguagePack) {
  const safeId = pack.id.replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^[.-]+|[.-]+$/gu, "") || "language";
  return `${safeId}.language-pack.json`;
}

export function languagePackUsage(
  languageId: string,
  activeLanguageId: string | undefined,
  draftLanguageIds: readonly string[],
  installedLanguageIds: readonly string[],
): LanguagePackUsage {
  return languagePackReferenceUsage(languageId, activeLanguageId, draftLanguageIds, installedLanguageIds);
}

/** Prefer a recognized language code; custom names get a collision-free private ID. */
export function suggestLanguageId(englishName: string, existingIds: readonly string[]): string {
  const name = englishName.trim().toLocaleLowerCase("en");
  const names = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });
  let base = "";
  for (let first = 97; first <= 122 && !base; first += 1) {
    for (let second = 97; second <= 122; second += 1) {
      const code = String.fromCharCode(first, second);
      if (name && names.of(code)?.toLocaleLowerCase("en") === name) { base = code; break; }
    }
  }
  base ||= "x-" + (name.normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "language");
  let id = base;
  let suffix = 2;
  while (existingIds.some((existing) => existing.toLowerCase() === id.toLowerCase())) id = base + "-x-" + suffix++;
  return id;
}
