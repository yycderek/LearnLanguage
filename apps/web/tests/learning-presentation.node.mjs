import assert from "node:assert/strict";
import test from "node:test";
import { sampleCourse } from "../lib/course.ts";
import { startLearning, createCourseLearningRecord } from "../lib/learning.ts";
import { mostRecentActiveLesson, buildLearnerStages, learnerStageForPhase } from "../lib/learning-presentation.ts";

test("engine phases collapse into three stable learner stages", () => {
  assert.equal(learnerStageForPhase("diagnostic"), "learn");
  assert.equal(learnerStageForPhase("comprehension"), "practice");
  assert.equal(learnerStageForPhase("delayed-transfer"), "use");

  const lesson = sampleCourse("ja").lessons[0];
  const completedLearn = lesson.steps.filter((step) => learnerStageForPhase(step.phase) === "learn").map((step) => step.id);
  const stages = buildLearnerStages(lesson, "guided-output", completedLearn);
  assert.deepEqual(stages.map((stage) => stage.id), ["learn", "practice", "use"]);
  assert.equal(stages[0].status, "completed");
  assert.equal(stages[1].status, "active");
  assert.equal(stages[2].status, "upcoming");
});

test("empty presentation stages are omitted for custom course flows", () => {
  const lesson = structuredClone(sampleCourse("ja").lessons[0]);
  lesson.steps = lesson.steps.filter((step) => step.phase === "preteach");
  const stages = buildLearnerStages(lesson, "preteach", []);
  assert.deepEqual(stages.map((stage) => stage.id), ["learn"]);
  assert.equal(stages[0].status, "active");
});


test("resume chooses the latest compatible active lesson", () => {
  const course = sampleCourse("en");
  const record = createCourseLearningRecord(course);
  const first = startLearning(course, course.lessons[0].id, "2026-09-01T00:00:00Z");
  const second = startLearning(course, course.lessons[1].id, "2026-09-02T00:00:00Z");
  record.lessonProgress = { [first.lessonId]: first, [second.lessonId]: second };
  assert.equal(mostRecentActiveLesson(course, record)?.id, second.lessonId);
  second.courseVersion = "obsolete";
  assert.equal(mostRecentActiveLesson(course, record)?.id, first.lessonId);
  first.currentStepId = "removed-step";
  assert.equal(mostRecentActiveLesson(course, record), undefined);
  assert.equal(mostRecentActiveLesson(course), undefined);
});
