import { describe, expect, it } from "vitest";
import {
  CourseImportError,
  importCoursePack,
  japaneseCafeCourse,
  safeImportCoursePack,
} from "../src/index.js";

describe("course pack import", () => {
  it("imports a structurally and semantically valid JSON course", () => {
    const imported = importCoursePack(JSON.stringify(japaneseCafeCourse));

    expect(imported).toEqual(japaneseCafeCourse);
    expect(imported).not.toBe(japaneseCafeCourse);
  });

  it("reports malformed JSON separately", () => {
    const result = safeImportCoursePack('{"schemaVersion":');

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        issues: [
          expect.objectContaining({
            stage: "json",
            code: "invalid-json",
            path: "/",
          }),
        ],
      }),
    );
  });

  it("reports schema paths for missing structural fields", () => {
    const result = safeImportCoursePack({ schemaVersion: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          stage: "schema",
          code: "required",
          path: "/manifest",
        }),
      );
    }
  });

  it("reports domain reference errors after schema validation", () => {
    const invalidCourse = {
      ...japaneseCafeCourse,
      utterances: [
        {
          ...japaneseCafeCourse.utterances[0]!,
          knowledgeRefs: ["missing-knowledge"],
        },
      ],
    };
    const result = safeImportCoursePack(invalidCourse);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          stage: "domain",
          code: "missing-reference",
        }),
      );
    }
    expect(() => importCoursePack(invalidCourse)).toThrow(CourseImportError);
  });

  it("rejects a diagnostic branch whose targets are not declared as next steps", () => {
    const invalidCourse = structuredClone(japaneseCafeCourse);
    const step = invalidCourse.lessons[0]!.steps[0]!;
    step.exerciseRefs = [invalidCourse.exercises[0]!.id];
    step.diagnostic = {
      learnNextStepId: step.next[0]!,
      passNextStepId: "missing-diagnostic-target",
    };

    const result = safeImportCoursePack(invalidCourse);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        stage: "domain",
        code: "missing-diagnostic-branch",
      }));
    }
  });
});
