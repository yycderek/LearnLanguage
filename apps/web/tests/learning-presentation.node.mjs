import assert from "node:assert/strict";
import test from "node:test";
import { sampleCourse } from "../lib/course.ts";
import { buildLearnerStages, learnerStageForPhase } from "../lib/learning-presentation.ts";

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
