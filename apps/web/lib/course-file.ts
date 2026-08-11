import type { ImportIssue, PublishedCoursePack } from "@learn-language/protocol";
import { validateCourse, verifyPublishedCourseIntegrity } from "./course.ts";

export const MAX_COURSE_FILE_BYTES = 5 * 1024 * 1024;

export type CourseFileError = "file-too-large" | "invalid-course" | "not-published" | "integrity-failed";

export interface CourseFileImportResult {
  course?: PublishedCoursePack;
  error?: CourseFileError;
  issues?: ImportIssue[];
}

export async function parseCourseFile(text: string): Promise<CourseFileImportResult> {
  const validated = validateCourse(text);
  if (!validated.course) return { error: "invalid-course", issues: validated.issues };
  if (validated.course.manifest.status !== "published") return { error: "not-published" };
  const integrity = await verifyPublishedCourseIntegrity(validated.course);
  if (!integrity.valid) return { error: "integrity-failed" };
  return { course: validated.course as PublishedCoursePack };
}

export function courseFileName(course: PublishedCoursePack) {
  const safeId = course.manifest.id.replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^[.-]+|[.-]+$/gu, "") || "course";
  const safeVersion = course.manifest.version.replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^[.-]+|[.-]+$/gu, "") || "version";
  return `${safeId}-${safeVersion}.course.json`;
}

export function serializeCourseFile(course: PublishedCoursePack) {
  return `${JSON.stringify(course, null, 2)}\n`;
}
