import { describe, expect, it } from "vitest";
import type { LanguageDefinition } from "../packages/protocol/src/index.js";
import { assessCourseLanguageCompatibility, languageAdapterPin, resolveLanguageRuntime } from "../packages/language-runtime/src/index.js";
import { japaneseCafeCourse } from "../src/index.js";

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
    expect(languageAdapterPin(english)).toEqual({ id: "core.generic", version: "1.0.0" });
    expect(languageAdapterPin(japanese)).toEqual({ id: "core.japanese", version: "1.0.0" });
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

  it("reports compatible adapters and explicit exercise degradation", () => {
    const course = structuredClone(japaneseCafeCourse);
    course.exercises[0]!.requiredCapabilities = ["token-comparison"];
    course.exercises[0]!.capabilityFallback = "self-assessment";
    const report = assessCourseLanguageCompatibility(course, japanese);
    expect(report.status).toBe("degraded");
    expect(report.runtimeAdapterId).toBe("core.japanese");
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "exercise-capability-fallback", capability: "token-comparison" }));
  });

  it("blocks missing packs, adapter version mismatches, and implicit capability gaps", () => {
    expect(assessCourseLanguageCompatibility(japaneseCafeCourse, undefined).issues[0]?.code).toBe("language-pack-missing");
    const incompatible = { ...japanese, adapter: { ...japanese.adapter!, version: "2.0.0" } };
    expect(assessCourseLanguageCompatibility(japaneseCafeCourse, incompatible).issues.some((issue) => issue.code === "course-adapter-mismatch")).toBe(true);

    const noFallback = structuredClone(japaneseCafeCourse);
    noFallback.exercises[0]!.requiredCapabilities = ["token-comparison"];
    delete noFallback.exercises[0]!.capabilityFallback;
    const report = assessCourseLanguageCompatibility(noFallback, japanese);
    expect(report.status).toBe("blocked");
    expect(report.issues.some((issue) => issue.code === "exercise-capability-missing")).toBe(true);
  });
});
