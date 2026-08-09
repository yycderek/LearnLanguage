import assert from "node:assert/strict";
import test from "node:test";
import { sampleCourse } from "../lib/course.ts";
import {
  completeReviewTask,
  courseLearningPercent,
  createCourseLearningRecord,
  learningPercent,
  lessonIsUnlocked,
  startLearning,
  submitLearningStep,
  updateCourseLearningRecord,
} from "../lib/learning.ts";

test("learning session advances, retries, projects mastery, and schedules reviews", () => {
  const course = sampleCourse("ja");
  let progress = startLearning(course, course.lessons[0].id, "2026-08-05T10:00:00.000Z");

  assert.equal(progress.currentStepId, "diagnose");
  assert.equal(learningPercent(course, progress), 0);

  progress = submitLearningStep(course, progress, {
    decision: "advance",
    now: "2026-08-05T10:01:00.000Z",
  });
  assert.equal(progress.currentStepId, "preteach");
  assert.equal(progress.engineEvents.length, progress.events.length);
  assert.equal(progress.pendingEffects[0]?.type, "learning-projection.refresh-requested");

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

test("course record unlocks lessons and reschedules completed reviews", () => {
  const course = sampleCourse("ja");
  let lessonProgress = startLearning(course, course.lessons[0].id, "2026-08-05T10:00:00.000Z");
  let record = createCourseLearningRecord(course, "2026-08-05T10:00:00.000Z");
  record = updateCourseLearningRecord(record, lessonProgress);
  assert.equal(lessonIsUnlocked(course, record, 1), false);

  while (lessonProgress.status === "active") {
    lessonProgress = submitLearningStep(course, lessonProgress, {
      decision: "advance",
      now: new Date(Date.parse(lessonProgress.updatedAt) + 60_000).toISOString(),
    });
    record = updateCourseLearningRecord(record, lessonProgress);
  }

  assert.equal(lessonIsUnlocked(course, record, 1), true);
  assert.equal(courseLearningPercent(course, record), 33);
  assert.ok(record.reviews.length > 0);

  const replay = startLearning(course, course.lessons[0].id, "2026-08-06T08:00:00.000Z");
  record = updateCourseLearningRecord(record, replay);
  assert.equal(lessonIsUnlocked(course, record, 1), true);
  assert.equal(courseLearningPercent(course, record), 33);

  const original = record.reviews[0];
  const reviewed = completeReviewTask(record, original.id, "remembered", "2026-08-06T12:00:00.000Z");
  const rescheduled = reviewed.reviews.find((item) => item.knowledgeItemId === original.knowledgeItemId);
  assert.equal(reviewed.reviewEvents.length, 1);
  assert.notEqual(rescheduled.id, original.id);
  assert.ok(Date.parse(rescheduled.dueAt) > Date.parse("2026-08-06T12:00:00.000Z"));
});

test("a capability fallback can advance without creating mastery evidence", () => {
  const course = sampleCourse("ja");
  let progress = startLearning(course, course.lessons[0].id, "2026-08-05T10:00:00.000Z");
  progress = submitLearningStep(course, progress, {
    decision: "advance",
    evidenceEligible: false,
    now: "2026-08-05T10:01:00.000Z",
  });

  assert.equal(progress.engineEvents.find((event) => event.type === "attempt.recorded")?.evidenceEligible, false);
  assert.deepEqual(progress.mastery, {});
  assert.deepEqual(progress.reviews, []);
});
