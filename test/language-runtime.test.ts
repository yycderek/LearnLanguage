import { describe, expect, it } from "vitest";
import type { LanguageDefinition } from "../packages/protocol/src/index.js";
import { resolveLanguageRuntime } from "../packages/language-runtime/src/index.js";

const japanese: LanguageDefinition = {
  schemaVersion: 1,
  id: "ja",
  name: { native: "日本語" },
  scripts: [{ code: "Jpan", name: { native: "日本語" }, direction: "ltr", primary: true }],
  readingSystems: [],
  segmentation: { strategy: "adapter" },
  adapter: { id: "core.japanese", version: "1.0.0", capabilities: ["normalization", "segmentation", "script-detection"] },
};

describe("language runtime", () => {
  it("resolves and executes a built-in adapter", () => {
    const runtime = resolveLanguageRuntime(japanese);
    expect(runtime.adapterId).toBe("core.japanese");
    expect(runtime.capabilities.has("segmentation")).toBe(true);
    expect(runtime.normalize("  コーヒー  ")).toBe("コーヒー");
    expect(runtime.segment("コーヒーをお願いします").length).toBeGreaterThan(1);
    expect(runtime.detectScripts("日本語ABC").some((run) => run.code === "Latn")).toBe(true);
  });

  it("uses the generic runtime for custom languages", () => {
    const { adapter: _adapter, ...baseLanguage } = japanese;
    const english: LanguageDefinition = {
      ...baseLanguage,
      id: "en",
      name: { native: "English" },
      segmentation: { strategy: "whitespace" },
    };
    const runtime = resolveLanguageRuntime(english);
    expect(runtime.adapterId).toBe("core.generic");
    expect(runtime.segment("learn any language").map((token) => token.text)).toEqual(["learn", "any", "language"]);
  });

  it("does not advertise segmentation when a requested adapter is missing", () => {
    const unavailable: LanguageDefinition = {
      ...japanese,
      adapter: { ...japanese.adapter!, id: "community.uninstalled" },
    };
    expect(resolveLanguageRuntime(unavailable).capabilities.has("segmentation")).toBe(false);
  });

  it("requires the adapter version selected by the course ecosystem", () => {
    const incompatible: LanguageDefinition = {
      ...japanese,
      adapter: { ...japanese.adapter!, version: "2.0.0" },
    };
    expect(resolveLanguageRuntime(incompatible).adapterId).toBe("core.generic");
    expect(resolveLanguageRuntime(incompatible).capabilities.has("segmentation")).toBe(false);
  });
});
