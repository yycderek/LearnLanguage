import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { bundledStarterCourses } from "@learn-language/content";
import {
  createCourseLearningRecord,
  startLearning,
  submitLearningStep,
  updateCourseLearningRecord,
} from "@learn-language/application/learning-record";
import { mobileText, nextLessonIndex } from "../src/model.ts";

test("mobile client consumes shared built-in courses and learning records", () => {
  const courses = bundledStarterCourses();
  assert.equal(courses.length, 3);
  const course = courses[0];
  assert.ok(course);
  let progress = startLearning(course, course.lessons[0]?.id, "2026-08-25T00:00:00.000Z");
  progress = submitLearningStep(course, progress, { decision: "advance", now: "2026-08-25T00:01:00.000Z" });
  const record = updateCourseLearningRecord(createCourseLearningRecord(course, progress.startedAt), progress);
  assert.equal(record.lessonProgress[progress.lessonId]?.currentStepId, progress.currentStepId);
  assert.equal(nextLessonIndex(course, record), 0);
  assert.ok(mobileText(course.manifest.title, "zh-CN"));
  assert.ok(mobileText(course.manifest.title, "en"));
});

test("mobile source keeps native storage and UI outside engine", async () => {
  const [app, storage, backup] = await Promise.all([
    readFile(new URL("../App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/backup.ts", import.meta.url), "utf8"),
  ]);
  assert.match(app, /SQLiteProvider/);
  assert.match(app, /evaluateExerciseResponse/);
  assert.match(storage, /implements LearningProfileRepository/);
  assert.match(storage, /PRAGMA journal_mode = WAL/);
  assert.match(backup, /ProfileBackupApplicationService/);
  assert.doesNotMatch(app, /IndexedDB|localStorage|document\./);
});
