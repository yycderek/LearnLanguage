import assert from "node:assert/strict";
import test from "node:test";
import { bundledCatalogCourses } from "../lib/course-library.ts";
import {
  courseFileName,
  MAX_COURSE_FILE_BYTES,
  parseCourseFile,
  serializeCourseFile,
} from "../lib/course-file.ts";

test("a published course file survives an export and import round trip", async () => {
  const course = bundledCatalogCourses()[0];
  const serialized = serializeCourseFile(course);
  assert.ok(serialized.endsWith("\n"));
  const result = await parseCourseFile(serialized);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.course, course);
  assert.equal(courseFileName(course), "private.ja.cafe-request-0.2.0.course.json");
  assert.equal(MAX_COURSE_FILE_BYTES, 5 * 1024 * 1024);
});

test("draft, malformed, and tampered course files are rejected", async () => {
  const course = bundledCatalogCourses()[0];
  const draft = structuredClone(course);
  draft.manifest.status = "draft";
  delete draft.manifest.contentHash;
  assert.equal((await parseCourseFile(JSON.stringify(draft))).error, "not-published");

  const tampered = structuredClone(course);
  tampered.manifest.title.en = "Tampered title";
  assert.equal((await parseCourseFile(JSON.stringify(tampered))).error, "integrity-failed");

  const malformed = await parseCourseFile("not json");
  assert.equal(malformed.error, "invalid-course");
  assert.ok(malformed.issues.length > 0);
});

test("export filenames remove unsafe path characters", () => {
  const course = bundledCatalogCourses()[0];
  course.manifest.id = "../../unsafe course";
  course.manifest.version = "1.0.0 / preview";
  assert.equal(courseFileName(course), "unsafe-course-1.0.0-preview.course.json");
  assert.doesNotMatch(courseFileName(course), /[\\/ ]/u);
});
