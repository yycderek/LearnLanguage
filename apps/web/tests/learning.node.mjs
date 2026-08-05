import assert from "node:assert/strict";
import test from "node:test";
import { sampleCourse } from "../lib/course.ts";
import { learningPercent, startLearning, submitLearningStep } from "../lib/learning.ts";

test("learning session advances, retries, projects mastery, and schedules reviews", () => {
  const course = sampleCourse("ja");
  let progress = startLearning(course, "2026-08-05T10:00:00.000Z");

  assert.equal(progress.currentStepId, "diagnose");
  assert.equal(learningPercent(course, progress), 0);

  progress = submitLearningStep(course, progress, {
    decision: "advance",
    now: "2026-08-05T10:01:00.000Z",
  });
  assert.equal(progress.currentStepId, "preteach");

  progress = submitLearningStep(course, progress, {
    decision: "retry",
    answer: "wrong",
    score: 0,
    now: "2026-08-05T10:02:00.000Z",
  });
  assert.equal(progress.currentStepId, "preteach");
  assert.equal(progress.attemptCounts.preteach, 1);
  assert.equal(progress.events.at(-1)?.type, "step.retry-required");

  while (progress.status === "active") {
    progress = submitLearningStep(course, progress, {
      decision: "advance",
      answer: "コーヒーを一つお願いします。",
      score: 1,
      now: new Date(Date.parse(progress.updatedAt) + 60_000).toISOString(),
    });
  }

  assert.equal(progress.status, "completed");
  assert.equal(learningPercent(course, progress), 100);
  assert.equal(progress.completedStepIds.length, course.lessons[0].steps.length);
  assert.ok(Object.keys(progress.mastery).length > 0);
  assert.equal(progress.reviews.length, Object.keys(progress.mastery).length);
  assert.equal(progress.events.at(-1)?.type, "session.completed");
});
