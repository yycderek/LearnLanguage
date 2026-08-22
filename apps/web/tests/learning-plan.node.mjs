import assert from "node:assert/strict";
import test from "node:test";
import { createLearningPlan, placementQuestions } from "../../../packages/application/src/learning-plan.ts";
import { bundledStarterCourses } from "../lib/starter-course-library.ts";

test("all starter courses expose deterministic placement checks", () => {
  for (const course of bundledStarterCourses()) {
    const questions = placementQuestions(course);
    assert.equal(questions.length, 4, `${course.manifest.languageId} needs four foundation checks`);
    assert.deepEqual(questions.map((item) => item.lessonIndex), [0, 1, 2, 3]);
  }
});

test("placement recommends a start without creating learning progress", () => {
  for (const course of bundledStarterCourses()) {
    const questions = placementQuestions(course);
    const plan = createLearningPlan(course, {
      motivation: "culture-media",
      minutesPerDay: 15,
      daysPerWeek: 5,
      placementMode: "completed",
      placementResults: questions.map((item, index) => ({ lessonId: item.lessonId, passed: index < 2 })),
      occurredAt: "2026-08-22T08:00:00.000Z",
    });
    assert.equal(plan.startingLessonId, course.lessons[2].id);
    assert.deepEqual(plan.placement.placedOutLessonIds, course.lessons.slice(0, 2).map((lesson) => lesson.id));
    assert.equal("lessonProgress" in plan, false);
    assert.equal("answers" in plan, false);
  }
});

test("a learner can override the recommended starting lesson", () => {
  const course = bundledStarterCourses()[0];
  const plan = createLearningPlan(course, {
    motivation: "work-study",
    minutesPerDay: 25,
    daysPerWeek: 3,
    placementMode: "skipped",
    startingLessonId: course.lessons[3].id,
    occurredAt: "2026-08-22T08:00:00.000Z",
  });
  assert.equal(plan.startingLessonId, course.lessons[3].id);
});
