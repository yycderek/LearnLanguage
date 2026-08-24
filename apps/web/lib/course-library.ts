import type { CoursePack, PublishedCoursePack } from "@learn-language/protocol";
import { assessCourseTrust, type CourseTrustReport } from "@learn-language/application/trust";
import type { CourseLearningRecord } from "./learning.ts";
import { bundledStarterCourses } from "./starter-course-library.ts";

const BUNDLED_CONTENT_HASHES: Record<string, string> = {
  en: "sha256:7ac5ca6559caf36c54e7190d9cc7ebdbec34f62ad8de91a0b19cceb0288e8c11",
  ja: "sha256:55447535bf6a692d440f3b4989db6376e95733fcb8eb463886e2f7310045fe0d",
  "yue-Hant-HK": "sha256:9a7fe9bc28e50c7e06c86b08ea99b7671ba19e5de52048b71c2b4bc42608e137",
};

export type CourseLibrarySource = "bundled" | "user";
export type CourseLibraryStatus = "available" | "installed" | "update-available" | "update-blocked";
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

export interface CourseLibraryEntry {
  id: string;
  source: CourseLibrarySource;
  status: CourseLibraryStatus;
  course: CoursePack;
  installedCourse?: CoursePack;
  update?: CourseUpdateAssessment;
  trust: CourseTrustReport;
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
    const usedLessonIds = new Set([
      ...record.completedLessonIds,
      ...Object.keys(record.lessonProgress),
    ]);
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

function publishedBundledCourse(course: CoursePack): PublishedCoursePack {
  const published = structuredClone(course) as CoursePack;
  published.manifest.visibility = "official";
  published.manifest.status = "published";
  published.manifest.license = {
    id: "CC-BY-4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "LearnLanguage contributors",
  };
  published.manifest.contentHash = BUNDLED_CONTENT_HASHES[course.manifest.languageId]!;
  return published as PublishedCoursePack;
}

export function bundledCatalogCourses(): PublishedCoursePack[] {
  return bundledStarterCourses().map(publishedBundledCourse);
}

export function buildCourseLibrary(
  available: CoursePack[],
  installed: CoursePack[],
  records: Record<string, CourseLearningRecord> = {},
): CourseLibraryEntry[] {
  const installedById = new Map(installed.map((course) => [course.manifest.id, course]));
  const entries = available.map((course): CourseLibraryEntry => {
    const installedCourse = installedById.get(course.manifest.id);
    if (!installedCourse) return { id: course.manifest.id, source: "bundled", status: "available", course, trust: assessCourseTrust(course) };
    installedById.delete(course.manifest.id);
    const update = assessCourseUpdate(installedCourse, course, records[course.manifest.id]);
    const status = update.newer ? (update.compatible ? "update-available" : "update-blocked") : "installed";
    return { id: course.manifest.id, source: "bundled", status, course, installedCourse, update, trust: assessCourseTrust(course) };
  });

  for (const course of installedById.values()) {
    entries.push({ id: course.manifest.id, source: "user", status: "installed", course, installedCourse: course, trust: assessCourseTrust(course) });
  }
  return entries;
}
