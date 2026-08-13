import { sampleCourse, type CoursePack } from "./course.ts";
import type { AppLocale } from "./i18n.ts";

export type CourseTemplateId = "single-lesson" | "scenario-course" | "practice-course";

export const courseTemplates: readonly { id: CourseTemplateId; zh: string; en: string; descriptionZh: string; descriptionEn: string }[] = [
  { id: "single-lesson", zh: "单课节入门", en: "Single lesson", descriptionZh: "适合先完成一个最小可发布课程", descriptionEn: "Start with one minimal publishable lesson" },
  { id: "scenario-course", zh: "情景递进课程", en: "Scenario course", descriptionZh: "按真实情景组织三个递进课节", descriptionEn: "Three progressive lessons around real situations" },
  { id: "practice-course", zh: "练习强化课程", en: "Practice course", descriptionZh: "以理解、输入和开放回答练习为主", descriptionEn: "Focus on comprehension, input, and open response" },
] as const;

export function createCourseFromTemplate(templateId: CourseTemplateId, languageId: string, locale: AppLocale): CoursePack {
  const course = sampleCourse(languageId);
  course.manifest.id = `${languageId}-${templateId}-${Date.now().toString(36)}`;
  course.manifest.title = {
    "zh-CN": templateId === "single-lesson" ? "我的入门课程" : templateId === "scenario-course" ? "我的情景课程" : "我的练习课程",
    en: templateId === "single-lesson" ? "My starter course" : templateId === "scenario-course" ? "My scenario course" : "My practice course",
  };
  course.manifest.description = {
    "zh-CN": "使用可视化编辑器完善内容、预览学习流程并发布。",
    en: "Complete the content in the visual editor, preview the learning flow, and publish.",
  };
  course.manifest.author = { id: "local-author", displayName: locale === "en" ? "Course author" : "课程作者" };
  course.manifest.visibility = "private";
  course.manifest.status = "draft";
  course.manifest.source = { kind: "original" };
  course.manifest.license = { id: "CC-BY-4.0" };
  delete course.manifest.contentHash;
  if (templateId !== "scenario-course") course.lessons = [course.lessons[0]!];
  if (templateId === "practice-course") {
    course.lessons[0]!.title = { "zh-CN": "综合练习", en: "Integrated practice" };
  }
  return course;
}
