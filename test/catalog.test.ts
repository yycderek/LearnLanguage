import { describe, expect, it } from "vitest";
import {
  CatalogValidationError,
  LearningCatalog,
  cantoneseCafeCourse,
  cantoneseLanguagePack,
  japaneseCafeCourse,
  japaneseLanguagePack,
  validateCoursePack,
} from "../src/index.js";

describe("LearningCatalog", () => {
  it("loads two languages through the same core registry", () => {
    const catalog = new LearningCatalog();
    catalog.registerLanguage(japaneseLanguagePack);
    catalog.registerLanguage(cantoneseLanguagePack);
    catalog.registerCourse(japaneseCafeCourse);
    catalog.registerCourse(cantoneseCafeCourse);

    expect(catalog.listLanguages().map((pack) => pack.definition.id)).toEqual([
      "ja",
      "yue-Hant-HK",
    ]);
    expect(catalog.listCourses("ja")).toHaveLength(1);
    expect(catalog.listCourses("yue-Hant-HK")).toHaveLength(1);
  });

  it("keeps normalization and segmentation inside language adapters", () => {
    expect(japaneseLanguagePack.normalize("  ｺｰﾋｰ  ")).toBe("コーヒー");
    expect(japaneseLanguagePack.segment("コーヒーをお願いします")).toEqual([
      "コーヒー",
      "をお",
      "願",
      "いします",
    ]);
    expect(cantoneseLanguagePack.segment("我想要咖啡")).toEqual([
      "我",
      "想",
      "要",
      "咖",
      "啡",
    ]);
  });

  it("rejects courses that refer to missing content", () => {
    const invalidCourse = {
      ...japaneseCafeCourse,
      lessons: [
        {
          ...japaneseCafeCourse.lessons[0]!,
          entryStepId: "missing-step",
        },
      ],
    };

    const validation = validateCoursePack(invalidCourse);
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContainEqual(
      expect.objectContaining({ code: "missing-entry-step" }),
    );

    const catalog = new LearningCatalog();
    catalog.registerLanguage(japaneseLanguagePack);
    expect(() => catalog.registerCourse(invalidCourse)).toThrow(
      CatalogValidationError,
    );
  });

  it("requires a matching language pack before course registration", () => {
    const catalog = new LearningCatalog();
    expect(() => catalog.registerCourse(japaneseCafeCourse)).toThrow(
      "Language pack is not registered: ja",
    );
  });
});
