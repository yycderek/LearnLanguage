import type { CourseLearningRecord } from "./learning-record.ts";
import type { CoursePack } from "@learn-language/protocol";

export type CourseUpdateIssue =
  | "not-newer"
  | "course-id-changed"
  | "language-changed"
  | "schema-changed"
  | "learned-lesson-removed"
  | "learning-step-removed"
  | "learned-knowledge-removed";

export interface CourseUpdateAssessment {
  compatible: boolean;
  newer: boolean;
  issues: CourseUpdateIssue[];
}

function versionParts(value: string) {
  const [core, prerelease] = value.trim().split("-", 2);
  const numbers = core?.split(".").map((part) => Number.parseInt(part, 10)) ?? [];
  return { numbers: numbers.every(Number.isFinite) ? numbers : [0], prerelease };
}

export function compareCourseVersions(left: string, right: string) {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.numbers.length, b.numbers.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a.numbers[index] ?? 0) - (b.numbers[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

export function assessCourseUpdate(
  installed: CoursePack,
  candidate: CoursePack,
  record?: CourseLearningRecord,
): CourseUpdateAssessment {
  const issues: CourseUpdateIssue[] = [];
  const newer = compareCourseVersions(candidate.manifest.version, installed.manifest.version) > 0;
  if (!newer) issues.push("not-newer");
  if (candidate.manifest.id !== installed.manifest.id) issues.push("course-id-changed");
  if (candidate.manifest.languageId !== installed.manifest.languageId) issues.push("language-changed");
  if (candidate.schemaVersion !== installed.schemaVersion) issues.push("schema-changed");

  if (record) {
    const lessonIds = new Set(candidate.lessons.map((lesson) => lesson.id));
    const knowledgeIds = new Set(candidate.knowledge.map((item) => item.id));
    const usedLessonIds = new Set([...record.completedLessonIds, ...Object.keys(record.lessonProgress)]);
    if ([...usedLessonIds].some((id) => !lessonIds.has(id))) issues.push("learned-lesson-removed");

    for (const [lessonId, progress] of Object.entries(record.lessonProgress)) {
      const candidateLesson = candidate.lessons.find((lesson) => lesson.id === lessonId);
      const stepIds = new Set(candidateLesson?.steps.map((step) => step.id) ?? []);
      if (progress.currentStepId && !stepIds.has(progress.currentStepId)) issues.push("learning-step-removed");
      if (progress.completedStepIds.some((id) => !stepIds.has(id))) issues.push("learning-step-removed");
    }

    const learnedKnowledgeIds = new Set([
      ...Object.keys(record.mastery),
      ...record.reviews.map((review) => review.knowledgeItemId),
    ]);
    if ([...learnedKnowledgeIds].some((id) => !knowledgeIds.has(id))) issues.push("learned-knowledge-removed");
  }

  return { compatible: issues.length === 0, newer, issues: [...new Set(issues)] };
}

export function upgradeCourseLearningRecord(
  record: CourseLearningRecord,
  course: CoursePack,
  now = new Date().toISOString(),
): CourseLearningRecord {
  const next = structuredClone(record);
  next.courseVersion = course.manifest.version;
  next.updatedAt = now;
  for (const progress of Object.values(next.lessonProgress)) progress.courseVersion = course.manifest.version;
  return next;
}