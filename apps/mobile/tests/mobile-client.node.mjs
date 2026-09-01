import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { bundledStarterCourses, canonicalizeCourse, validateCourse, validateLanguagePack } from "@learn-language/content";
import {
  createCourseLearningRecord,
  startLearning,
  submitLearningStep,
  updateCourseLearningRecord,
} from "@learn-language/application/learning-record";
import { mobileText, nextLessonIndex } from "../src/model.ts";
import { createLearningPlan } from "@learn-language/application/learning-plan";
import { courseAdaptiveAgenda } from "@learn-language/application/adaptive-agenda";

test("mobile client consumes shared built-in courses and learning records", () => {
  const courses = bundledStarterCourses();
  assert.equal(courses.length, 4);
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

test("mobile personal plans produce an adaptive local agenda", () => {
  const course = bundledStarterCourses()[0];
  assert.ok(course);
  const plan = createLearningPlan(course, {
    motivation: "daily-life",
    minutesPerDay: 20,
    daysPerWeek: 5,
    placementMode: "skipped",
    occurredAt: "2026-08-25T08:00:00.000Z",
  });
  const agenda = courseAdaptiveAgenda(course, undefined, plan, "2026-08-25T09:00:00.000Z", 0);
  assert.equal(agenda.today.targetMinutes, 20);
  assert.equal(agenda.items[0]?.kind, "start-lesson");
  assert.equal(agenda.items[0]?.lessonId, course.lessons[0]?.id);
});
test("mobile source keeps native storage and UI outside engine", async () => {
  const [app, storage, backup, contentImport, pronunciation] = await Promise.all([
    readFile(new URL("../App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/backup.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/content-import.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pronunciation.ts", import.meta.url), "utf8"),
  ]);
  assert.match(app, /SQLiteProvider/);
  assert.match(app, /evaluateExerciseResponse/);
  assert.match(app, /createPronunciationRequest/);
  assert.match(pronunciation, /expo-speech/);
  assert.match(pronunciation, /request\.languageTag/);
  assert.match(storage, /implements LearningProfileRepository/);
  assert.match(storage, /implements LearningPlanRepository/);
  assert.match(storage, /learning_plans/);
  assert.match(storage, /PRAGMA journal_mode = WAL/);
  assert.match(storage, /implements LanguagePackRepository/);
  assert.match(storage, /implements InstalledCourseRepository/);
  assert.match(storage, /installed_language_packs/);
  assert.match(storage, /installed_courses/);
  assert.match(contentImport, /CryptoDigestAlgorithm\.SHA256/);
  assert.match(contentImport, /validateLanguagePack/);
  assert.match(contentImport, /validateCourse/);
  assert.match(backup, /ProfileBackupApplicationService/);
  assert.match(backup, /LearningPlanApplicationService/);
  assert.match(backup, /schemaVersion: 2/);
  assert.match(app, /function PlanSetup/);
  assert.match(app, /function Onboarding/);
  assert.match(app, /function StartupFailure/);
  assert.match(app, /BackHandler\.addEventListener/);
  assert.match(app, /KeyboardAvoidingView/);
  assert.match(app, /AppState\.addEventListener/);
  assert.match(app, /AccessibilityInfo\.announceForAccessibility/);
  assert.match(app, /accessibilityRole="progressbar"/);
  assert.match(app, /Could not save progress/);
  assert.match(storage, /onboarding-complete/);
  assert.match(backup, /不是有效的 JSON/);
  assert.match(app, /courseAdaptiveAgenda/);
  assert.doesNotMatch(app, /IndexedDB|localStorage|document\./);
});
test("shared content validation protects mobile imports", () => {
  const course = bundledStarterCourses()[0];
  assert.ok(course);
  assert.deepEqual(validateCourse(JSON.stringify(course)).course, course);
  const withHash = structuredClone(course);
  withHash.manifest.contentHash = "sha256:ignored-by-canonicalization";
  assert.equal(canonicalizeCourse(withHash), canonicalizeCourse(course));

  const pack = {
    schemaVersion: 1,
    id: "fr",
    name: { en: "French", native: "Français" },
    accent: "Fr",
    scripts: [
      { code: "Latn", name: { en: "Latin" }, direction: "ltr", primary: true },
      { code: "Latn", name: { en: "Duplicate" }, direction: "ltr", primary: false },
    ],
    readingSystems: [],
    segmentation: { strategy: "whitespace" },
  };
  assert.match(validateLanguagePack(JSON.stringify(pack)).error, /code 重复/u);
});