import assert from "node:assert/strict";
import test from "node:test";
import {
  appendLesson,
  appendLessonStep,
  duplicateLesson,
  moveLesson,
  moveLessonStep,
  removeLesson,
  removeLessonStep,
} from "../lib/course-authoring.ts";
import { sampleCourse, validateCourse } from "../lib/course.ts";

test("a no-code author can add and reorder lessons without changing their identity", () => {
  const course = sampleCourse("ja");
  const id = appendLesson(course, "en", "A new situation");
  const created = course.lessons.find((lesson) => lesson.id === id);

  assert.ok(created);
  assert.equal(created.title.en, "A new situation");
  assert.equal(created.steps.length, 1);
  assert.equal(created.entryStepId, "start");
  assert.deepEqual(created.canDoGoalRefs, [course.goals[0].id]);
  assert.equal(moveLesson(course, id, -1), true);
  assert.equal(course.lessons.at(-2).id, id);
  assert.equal(validateCourse(JSON.stringify(course)).issues.length, 0);
});

test("a no-code author can duplicate a lesson with independent step identities", () => {
  const course = sampleCourse("ja");
  const source = course.lessons[0];
  const duplicatedId = duplicateLesson(course, source.id, "en");
  const copy = course.lessons.find((lesson) => lesson.id === duplicatedId);
  assert.ok(copy);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.steps.length, source.steps.length);
  assert.equal(new Set(copy.steps.map((step) => step.id)).size, copy.steps.length);
  assert.ok(copy.steps.every((step) => !source.steps.some((sourceStep) => sourceStep.id === step.id)));
});

test("lesson removal chooses a stable adjacent lesson and preserves the last lesson", () => {
  const course = sampleCourse("ja");
  const removedId = course.lessons[1].id;
  const expectedNextId = course.lessons[2].id;

  assert.equal(removeLesson(course, removedId), expectedNextId);
  assert.equal(course.lessons.some((lesson) => lesson.id === removedId), false);

  course.lessons = [course.lessons[0]];
  assert.equal(removeLesson(course, course.lessons[0].id), undefined);
  assert.equal(course.lessons.length, 1);
});

test("step changes rebuild a valid linear path for the selected lesson", () => {
  const course = sampleCourse("ja");
  const lesson = course.lessons[0];
  const addedId = appendLessonStep(lesson, "zh-CN", "新的练习步骤");

  assert.equal(lesson.steps.at(-1).id, addedId);
  assert.equal(lesson.steps.at(-2).next[0], addedId);
  assert.equal(moveLessonStep(lesson, lesson.steps.length - 1, -1), true);
  assert.equal(lesson.steps.at(-2).id, addedId);
  assert.equal(lesson.entryStepId, lesson.steps[0].id);
  assert.ok(lesson.steps.every((step, index) => index === lesson.steps.length - 1 ? step.next.length === 0 : step.next[0] === lesson.steps[index + 1].id));

  const addedIndex = lesson.steps.findIndex((step) => step.id === addedId);
  assert.equal(removeLessonStep(lesson, addedIndex), true);
  assert.equal(lesson.steps.some((step) => step.id === addedId), false);
  assert.equal(validateCourse(JSON.stringify(course)).issues.length, 0);
});

test("the only step in a lesson cannot be removed", () => {
  const course = sampleCourse("ja");
  const lesson = course.lessons[0];
  lesson.steps = [lesson.steps[0]];
  lesson.entryStepId = lesson.steps[0].id;
  lesson.steps[0].next = [];
  assert.equal(removeLessonStep(lesson, 0), false);
  assert.equal(lesson.steps.length, 1);
});
