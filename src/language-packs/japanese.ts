import type { LanguageAdapter } from "../core/index.js";

function segmentJapanese(input: string): readonly string[] {
  return (
    input.match(
      /[\p{Script=Han}]+|[\p{Script=Hiragana}]+|[\p{Script=Katakana}ー]+|[A-Za-z0-9]+|[^\s]/gu,
    ) ?? []
  );
}

export const japaneseLanguagePack: LanguageAdapter = {
  definition: {
    schemaVersion: 1,
    id: "ja",
    name: { "zh-CN": "日语", en: "Japanese", ja: "日本語" },
    scripts: [
      {
        code: "Jpan",
        name: { "zh-CN": "日文混合书写", en: "Japanese script" },
        direction: "ltr",
        primary: true,
      },
    ],
    readingSystems: [
      {
        id: "kana",
        name: { "zh-CN": "假名", en: "Kana" },
        kind: "native",
      },
      {
        id: "hepburn",
        name: { "zh-CN": "赫本式罗马字", en: "Hepburn romanization" },
        kind: "romanization",
      },
    ],
    pronunciationFeatures: [
      {
        id: "mora",
        name: { "zh-CN": "拍", en: "Mora timing" },
        category: "rhythm",
        contrastive: true,
      },
      {
        id: "pitch-accent",
        name: { "zh-CN": "音调", en: "Pitch accent" },
        category: "tone",
        contrastive: true,
      },
    ],
    segmentation: { strategy: "script-run" },
    speech: {
      recognitionLocales: ["ja-JP"],
      synthesisLocales: ["ja-JP"],
    },
  },
  normalize(input) {
    return input.normalize("NFKC").trim();
  },
  segment(input) {
    return segmentJapanese(this.normalize(input));
  },
};
