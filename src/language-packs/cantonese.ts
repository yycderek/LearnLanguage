import type { LanguageAdapter } from "../core/index.js";

function segmentCantonese(input: string): readonly string[] {
  return input.match(/\p{Script=Han}|[A-Za-z]+[1-6]?|\d+|[^\s]/gu) ?? [];
}

export const cantoneseLanguagePack: LanguageAdapter = {
  definition: {
    schemaVersion: 1,
    id: "yue-Hant-HK",
    name: { "zh-CN": "粤语", en: "Cantonese", "zh-HK": "廣東話" },
    scripts: [
      {
        code: "Hant",
        name: { "zh-CN": "繁体中文", en: "Traditional Chinese" },
        direction: "ltr",
        primary: true,
      },
    ],
    readingSystems: [
      {
        id: "jyutping",
        name: { "zh-CN": "粤拼", en: "Jyutping" },
        kind: "romanization",
      },
    ],
    segmentation: { strategy: "character" },
    adapter: {
      id: "core.cantonese",
      version: "1.0.0",
      capabilities: ["normalization", "segmentation", "script-detection"],
    },
  },
  normalize(input) {
    return input.normalize("NFKC").trim();
  },
  segment(input) {
    return segmentCantonese(this.normalize(input));
  },
};
