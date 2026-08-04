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
    pronunciationFeatures: [
      {
        id: "lexical-tone",
        name: { "zh-CN": "词汇声调", en: "Lexical tone" },
        category: "tone",
        contrastive: true,
      },
      {
        id: "checked-syllable",
        name: { "zh-CN": "入声", en: "Checked syllable" },
        category: "segment",
        contrastive: true,
      },
    ],
    segmentation: { strategy: "character" },
    speech: {
      recognitionLocales: ["yue-Hant-HK", "zh-HK"],
      synthesisLocales: ["yue-Hant-HK", "zh-HK"],
    },
  },
  normalize(input) {
    return input.normalize("NFKC").trim();
  },
  segment(input) {
    return segmentCantonese(this.normalize(input));
  },
};
