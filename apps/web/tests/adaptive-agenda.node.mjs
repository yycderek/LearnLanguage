import assert from "node:assert/strict";
import test from "node:test";
import { createLearningPlan } from "../../../packages/application/src/learning-plan.ts";
import { courseAdaptiveAgenda } from "../lib/adaptive-agenda.ts";
import { bundledStarterCourses } from "../lib/starter-course-library.ts";

test("web agenda derives review and resume tasks from the existing local learning record", () => {
  const course = bundledStarterCourses()[0];
  const plan = createLearningPlan(course, {
    motivation: "daily-life",
    minutesPerDay: 20,
    daysPerWeek: 5,
    placementMode: "skipped",
    occurredAt: "2026-08-24T08:00:00.000Z",
  });
  const [completed, active] = course.lessons;
  const agenda = courseAdaptiveAgenda(course, {
    schemaVersion: 2,
    courseId: course.manifest.id,
    courseVersion: course.manifest.version,
    languageId: course.manifest.languageId,
    completedLessonIds: [completed.id],
    lessonProgress: {
      [completed.id]: {
        lessonId: completed.id,
        status: "completed",
        startedAt: "2026-08-25T08:00:00.000Z",
        completedAt: "2026-08-25T08:18:00.000Z",
      },
      [active.id]: {
        lessonId: active.id,
        status: "active",
        startedAt: "2026-08-25T09:00:00.000Z",
        completedAt: null,
      },
    },
    mastery: {},
    reviews: [{ id: "due", knowledgeItemId: "item", mode: "recognition", dueAt: "2026-08-25T09:30:00.000Z", basedOnLevel: "encountered" }],
    reviewEvents: [],
    updatedAt: "2026-08-25T09:00:00.000Z",
  }, plan, "2026-08-25T10:00:00.000Z", 0);

  assert.equal(agenda.week.completedMinutes, 18);
  assert.deepEqual(agenda.items.map((item) => item.kind), ["review", "continue-lesson"]);
  assert.equal(agenda.items[1].lessonId, active.id);
});
