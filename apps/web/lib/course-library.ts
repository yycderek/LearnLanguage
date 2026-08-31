import type { CoursePack, PublishedCoursePack } from "@learn-language/protocol";
import { assessCourseTrust, type CourseTrustReport } from "@learn-language/application/trust";
import { assessCourseUpdate, compareCourseVersions, upgradeCourseLearningRecord, type CourseUpdateAssessment } from "@learn-language/application/course-update";
import type { CourseLearningRecord } from "./learning.ts";
import { bundledStarterCourses } from "./starter-course-library.ts";

const BUNDLED_CONTENT_HASHES: Record<string, string> = {
  en: "sha256:7ac5ca6559caf36c54e7190d9cc7ebdbec34f62ad8de91a0b19cceb0288e8c11",
  ja: "sha256:55447535bf6a692d440f3b4989db6376e95733fcb8eb463886e2f7310045fe0d",
  "yue-Hant-HK": "sha256:80ccd005ac7fc9b5cc363d596e8242f4ba631e9b9972ea322514f358834f0a54",
  es: "sha256:50e1f938b87ca46defc601a9b72de96e9e20b7bd6ccef391982fd76f3a922faf",
};

export type CourseLibrarySource = "bundled" | "user";
export type CourseLibraryStatus = "available" | "installed" | "update-available" | "update-blocked";
export { assessCourseUpdate, compareCourseVersions, upgradeCourseLearningRecord };
export type { CourseUpdateAssessment };

export interface CourseLibraryEntry {
  id: string;
  source: CourseLibrarySource;
  status: CourseLibraryStatus;
  course: CoursePack;
  installedCourse?: CoursePack;
  update?: CourseUpdateAssessment;
  trust: CourseTrustReport;
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
