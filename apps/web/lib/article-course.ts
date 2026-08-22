import type { CoursePack } from "./course.ts";
import type { AppLocale } from "./i18n.ts";
import { createCourseDraftFromMaterials, MAX_MATERIAL_CHARACTERS, MAX_MATERIAL_SENTENCES, splitMaterialText } from "./material-course.ts";
import type { MaterialKind } from "./material-import.ts";

export const MAX_ARTICLE_CHARACTERS = MAX_MATERIAL_CHARACTERS;
export const MAX_ARTICLE_SENTENCES = MAX_MATERIAL_SENTENCES;

export interface ArticleCourseInput {
  languageId: string;
  languageName: string;
  locale: AppLocale;
  title: string;
  text: string;
  materialKind?: MaterialKind;
  courseId?: string;
}

export function createCourseDraftFromArticle(input: ArticleCourseInput): CoursePack {
  return createCourseDraftFromMaterials({
    languageId: input.languageId,
    languageName: input.languageName,
    locale: input.locale,
    title: input.title,
    courseId: input.courseId,
    materials: [{ id: "pasted-material", title: input.title, text: input.text, kind: input.materialKind ?? "article", sourceLabel: input.locale === "en" ? "Pasted text" : "粘贴文本" }],
  });
}

export function articleSentenceCount(text: string, kind: MaterialKind = "article") {
  return splitMaterialText(text, kind).length;
}
