import type { CoursePack, ImportIssue } from "./course.ts";
import type { AppLocale } from "./i18n.ts";

export type ReadinessStatus = "pass" | "warning" | "blocked";
export interface PublishReadinessCheck {
  id: string;
  status: ReadinessStatus;
  zh: string;
  en: string;
}

export function assessPublishReadiness(
  course: CoursePack,
  locale: AppLocale,
  issues: readonly ImportIssue[],
  languagePackPresent: boolean,
): readonly PublishReadinessCheck[] {
  const hasLocalizedTitle = Boolean(course.manifest.title[locale]?.trim());
  const hasLocalizedDescription = Boolean(course.manifest.description[locale]?.trim());
  const everyLessonHasSteps = course.lessons.length > 0 && course.lessons.every((lesson) => lesson.steps.length > 0 && lesson.entryStepId);
  const referencedPractice = course.exercises.length > 0 && course.lessons.some((lesson) => lesson.steps.some((step) => step.exerciseRefs.length > 0));
  return [
    { id: "identity", status: course.manifest.id.trim() && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(course.manifest.version) ? "pass" : "blocked", zh: "课程 ID 与语义化版本有效", en: "Course ID and semantic version are valid" },
    { id: "localization", status: hasLocalizedTitle && hasLocalizedDescription ? "pass" : "blocked", zh: "当前应用语言的标题与简介完整", en: "Title and description exist in the app language" },
    { id: "author", status: course.manifest.author.id.trim() && course.manifest.author.displayName.trim() ? "pass" : "blocked", zh: "作者身份完整", en: "Author identity is complete" },
    { id: "license", status: course.manifest.license?.id ? "pass" : "blocked", zh: "已选择课程内容许可证", en: "A content license is selected" },
    { id: "language", status: languagePackPresent ? "pass" : "blocked", zh: "目标语言包可用", en: "The target Language Pack is available" },
    { id: "flow", status: course.goals.length > 0 && everyLessonHasSteps ? "pass" : "blocked", zh: "能力目标与课节流程完整", en: "Can-do goals and lesson flows are complete" },
    { id: "practice", status: referencedPractice ? "pass" : "warning", zh: "至少一个练习已加入学习流程", en: "At least one exercise is connected to the learning flow" },
    { id: "validation", status: issues.length === 0 ? "pass" : "blocked", zh: "Course Pack 结构与引用校验通过", en: "Course Pack structure and references are valid" },
  ];
}

export function canPublish(checks: readonly PublishReadinessCheck[]) {
  return !checks.some((check) => check.status === "blocked");
}
