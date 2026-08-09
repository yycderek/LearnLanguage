import { describe, expect, it } from "vitest";
import type { LanguageDefinition } from "@learn-language/protocol";
import {
  japaneseCafeCourse,
  safeImportCoursePack,
  validateLanguageDefinition,
} from "../src/index.js";

describe("protocol boundaries", () => {
  it("accepts an RTL language without requiring a specialized adapter", () => {
    const arabic: LanguageDefinition = {
      schemaVersion: 1,
      id: "ar",
      name: { ar: "العربية", "zh-CN": "阿拉伯语" },
      scripts: [
        {
          code: "Arab",
          name: { "zh-CN": "阿拉伯字母" },
          direction: "rtl",
          primary: true,
        },
      ],
      readingSystems: [],
      segmentation: { strategy: "grapheme" },
    };

    expect(validateLanguageDefinition(arabic)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("accepts deterministic exercise data used by the no-code studio", () => {
    const course = structuredClone(japaneseCafeCourse);
    course.exercises[0] = {
      ...course.exercises[0]!,
      kind: "single-choice",
      protocolVersion: 1,
      options: [{ "zh-CN": "咖啡" }, { "zh-CN": "茶" }],
      correctOptionIndex: 0,
      evaluationSources: ["deterministic"],
    };

    expect(safeImportCoursePack(course)).toEqual(
      expect.objectContaining({ success: true }),
    );
  });

  it("accepts structured multiple-choice and ordering answer keys", () => {
    const course = structuredClone(japaneseCafeCourse);
    course.exercises.push({
      id: "choose-parts",
      kind: "multiple-choice",
      prompt: { en: "Choose both parts" },
      options: [{ en: "one" }, { en: "two" }, { en: "three" }],
      correctOptionIndices: [0, 2],
      knowledgeRefs: [],
      utteranceRefs: [],
    }, {
      id: "order-parts",
      kind: "ordering",
      prompt: { en: "Order the parts" },
      options: [{ en: "one" }, { en: "two" }, { en: "three" }],
      correctOrder: [0, 1, 2],
      knowledgeRefs: [],
      utteranceRefs: [],
    });

    expect(safeImportCoursePack(course)).toEqual(expect.objectContaining({ success: true }));
  });

  it("rejects an ordering key that is not a complete permutation", () => {
    const course = structuredClone(japaneseCafeCourse);
    course.exercises.push({
      id: "bad-order",
      kind: "ordering",
      prompt: { en: "Order the parts" },
      options: [{ en: "one" }, { en: "two" }, { en: "three" }],
      correctOrder: [0, 2],
      knowledgeRefs: [],
      utteranceRefs: [],
    });

    const result = safeImportCoursePack(course);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues).toContainEqual(expect.objectContaining({ code: "invalid-answer-key" }));
  });

  it("rejects the retired Course Pack v1 after the intentional pre-1.0 reset", () => {
    const legacy = { ...structuredClone(japaneseCafeCourse), schemaVersion: 1 };
    const result = safeImportCoursePack(legacy);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ stage: "schema", path: "/schemaVersion" }),
      );
    }
  });

  it("requires immutable identity fields on published courses", () => {
    const invalid = structuredClone(japaneseCafeCourse);
    invalid.manifest.status = "published";
    delete invalid.manifest.languageAdapter;

    const result = safeImportCoursePack(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.filter((issue) => issue.stage === "schema").length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(["repeat", "dictation"])(
    "rejects deferred speech exercise kind %s",
    (kind) => {
      const course = structuredClone(japaneseCafeCourse) as unknown as {
        exercises: Array<Record<string, unknown>>;
      };
      course.exercises[0]!.kind = kind;

      const result = safeImportCoursePack(course);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            stage: "schema",
            path: "/exercises/0/kind",
          }),
        );
      }
    },
  );

  it("rejects executable or speech-oriented extra course fields", () => {
    const course = structuredClone(japaneseCafeCourse) as unknown as {
      exercises: Array<Record<string, unknown>>;
    };
    course.exercises[0]!.script = "alert('unsafe')";
    course.exercises[0]!.audio = { assetId: "recording" };

    const result = safeImportCoursePack(course);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.filter((issue) => issue.code === "additionalProperties")).toHaveLength(2);
    }
  });
});
