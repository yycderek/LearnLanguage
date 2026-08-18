import assert from "node:assert/strict";
import test from "node:test";
import { verifyPublishedCourseIntegrity } from "../lib/course.ts";
import {
  assessCourseUpdate,
  buildCourseLibrary,
  bundledCatalogCourses,
  compareCourseVersions,
  upgradeCourseLearningRecord,
} from "../lib/course-library.ts";
import { createCourseLearningRecord, startLearning, updateCourseLearningRecord } from "../lib/learning.ts";

test("bundled catalog courses are immutable installable Course Packs", async () => {
  const catalog = bundledCatalogCourses();
  assert.equal(catalog.length, 2);
  for (const course of catalog) {
    assert.equal(course.manifest.status, "published");
    assert.equal(course.manifest.visibility, "official");
    assert.equal(course.manifest.license.id, "CC-BY-4.0");
    assert.equal((await verifyPublishedCourseIntegrity(course)).valid, true);
  }
});

test("course versions are compared numerically with prerelease support", () => {
  assert.equal(compareCourseVersions("0.10.0", "0.2.0"), 1);
  assert.equal(compareCourseVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareCourseVersions("1.0.0-beta", "1.0.0"), -1);
});

test("compatible catalog updates preserve and rebase learning progress", () => {
  const candidate = bundledCatalogCourses()[0];
  const installed = structuredClone(candidate);
  installed.manifest.version = "0.1.0";
  let record = createCourseLearningRecord(installed, "2026-08-10T10:00:00.000Z");
  record = updateCourseLearningRecord(record, startLearning(installed, installed.lessons[0].id, "2026-08-10T10:00:00.000Z"));

  const assessment = assessCourseUpdate(installed, candidate, record);
  assert.deepEqual(assessment, { compatible: true, newer: true, issues: [] });

  const entries = buildCourseLibrary([candidate], [installed], { [record.courseId]: record });
  assert.equal(entries[0].status, "update-available");

  const upgraded = upgradeCourseLearningRecord(record, candidate, "2026-08-11T10:00:00.000Z");
  assert.equal(upgraded.courseVersion, candidate.manifest.version);
  assert.ok(Object.values(upgraded.lessonProgress).every((progress) => progress.courseVersion === candidate.manifest.version));
  assert.deepEqual(upgraded.completedLessonIds, record.completedLessonIds);
  assert.deepEqual(upgraded.mastery, record.mastery);
});

test("updates that remove referenced lessons, steps, or knowledge are blocked", () => {
  const installed = bundledCatalogCourses()[0];
  const candidate = structuredClone(installed);
  candidate.manifest.version = "0.7.0";
  let record = createCourseLearningRecord(installed, "2026-08-10T10:00:00.000Z");
  const progress = startLearning(installed, installed.lessons[0].id, "2026-08-10T10:00:00.000Z");
  record = updateCourseLearningRecord(record, progress);
  record.mastery[installed.knowledge[0].id] = {
    knowledgeItemId: installed.knowledge[0].id,
    level: "encountered",
    evidenceCount: 1,
    lastAttemptAt: "2026-08-10T10:00:00.000Z",
  };

  candidate.lessons[0].steps = candidate.lessons[0].steps.filter((step) => step.id !== progress.currentStepId);
  candidate.knowledge = candidate.knowledge.filter((item) => item.id !== installed.knowledge[0].id);
  const assessment = assessCourseUpdate(installed, candidate, record);
  assert.equal(assessment.compatible, false);
  assert.ok(assessment.issues.includes("learning-step-removed"));
  assert.ok(assessment.issues.includes("learned-knowledge-removed"));
  assert.equal(buildCourseLibrary([candidate], [installed], { [record.courseId]: record })[0].status, "update-blocked");
});

test("the library distinguishes available, installed, and user courses", () => {
  const [available, second] = bundledCatalogCourses();
  const user = structuredClone(available);
  user.manifest.id = "private.user.custom-course";
  user.manifest.visibility = "private";
  const entries = buildCourseLibrary([available, second], [available, user]);
  assert.deepEqual(entries.map((entry) => [entry.id, entry.source, entry.status]), [
    [available.manifest.id, "bundled", "installed"],
    [second.manifest.id, "bundled", "available"],
    [user.manifest.id, "user", "installed"],
  ]);
});
