import assert from "node:assert/strict";
import test from "node:test";
import { sampleCourse, validateCourse } from "../lib/course.ts";
import {
  bundledStarterCourses,
  bundledStarterLanguageIds,
} from "../lib/starter-course-library.ts";

function assertBilingual(value, path) {
  assert.equal(typeof value?.["zh-CN"], "string", `${path} needs Chinese text`);
  assert.ok(value["zh-CN"].trim(), `${path} Chinese text must not be empty`);
  assert.equal(typeof value?.en, "string", `${path} needs English text`);
  assert.ok(value.en.trim(), `${path} English text must not be empty`);
}

function reachableStepIds(lesson) {
  const byId = new Map(lesson.steps.map((step) => [step.id, step]));
  const visited = new Set();
  const pending = [lesson.entryStepId];
  while (pending.length) {
    const id = pending.pop();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    pending.push(...(byId.get(id)?.next ?? []));
  }
  return visited;
}

test("the bundled library contains progressive Japanese and Cantonese zero-beginner courses", () => {
  assert.deepEqual(bundledStarterLanguageIds, ["ja", "yue-Hant-HK"]);
  const courses = bundledStarterCourses();
  assert.equal(courses.length, 2);

  for (const course of courses) {
    assert.equal(validateCourse(JSON.stringify(course)).issues.length, 0);
    assert.equal(course.schemaVersion, 2);
    assert.equal(course.manifest.version, "0.3.0");
    assert.equal(course.lessons.length, 7);
    assert.equal(course.goals.length, 7);
    assert.ok(course.knowledge.length >= 21);
    assert.ok(course.utterances.length >= 14);
    assert.ok(course.exercises.length >= 21);

    assertBilingual(course.manifest.title, "manifest.title");
    assertBilingual(course.manifest.description, "manifest.description");
    course.goals.forEach((goal) => assertBilingual(goal.description, `goal.${goal.id}`));
    course.knowledge.forEach((item) => {
      assertBilingual(item.meaning, `knowledge.${item.id}.meaning`);
      assertBilingual(item.usage, `knowledge.${item.id}.usage`);
      assert.ok(item.reading && Object.values(item.reading).some(Boolean), `knowledge.${item.id} needs a reading`);
    });
    course.utterances.forEach((item) => {
      assertBilingual(item.translation, `utterance.${item.id}.translation`);
      assert.ok(item.reading && Object.values(item.reading).some(Boolean), `utterance.${item.id} needs a reading`);
    });
    course.exercises.forEach((exercise) => {
      assertBilingual(exercise.prompt, `exercise.${exercise.id}.prompt`);
      assertBilingual(exercise.guidance, `exercise.${exercise.id}.guidance`);
      exercise.options?.forEach((option, index) => assertBilingual(option, `exercise.${exercise.id}.option.${index}`));
    });

    const usedExerciseIds = new Set();
    const exerciseSets = [];
    for (const lesson of course.lessons) {
      assertBilingual(lesson.title, `lesson.${lesson.id}.title`);
      assert.equal(lesson.steps.length, 9);
      assert.equal(reachableStepIds(lesson).size, lesson.steps.length, `${lesson.id} has unreachable steps`);
      assert.equal(lesson.steps.filter((step) => step.next.length === 0).length, 1, `${lesson.id} needs one terminal step`);
      lesson.steps.forEach((step) => {
        assertBilingual(step.title, `lesson.${lesson.id}.step.${step.id}.title`);
        step.exerciseRefs.forEach((id) => usedExerciseIds.add(id));
      });
      exerciseSets.push([...new Set(lesson.steps.flatMap((step) => step.exerciseRefs))].sort().join(","));
    }
    assert.equal(new Set(exerciseSets).size, course.lessons.length, "each lesson needs its own exercises");
    assert.deepEqual([...usedExerciseIds].sort(), course.exercises.map((item) => item.id).sort());

    const kinds = new Set(course.exercises.map((exercise) => exercise.kind));
    for (const kind of ["single-choice", "multiple-choice", "ordering", "role-play"]) {
      assert.ok(kinds.has(kind), `${course.manifest.languageId} needs a ${kind} exercise`);
    }
  }
});

test("foundation lessons cover each language's writing or romanization system before scenarios", () => {
  const [japanese, cantonese] = bundledStarterCourses();

  assert.deepEqual(japanese.lessons.slice(0, 4).map((lesson) => lesson.id), [
    "writing-and-vowels",
    "hiragana-core",
    "kana-patterns",
    "katakana-core",
  ]);
  assert.deepEqual(cantonese.lessons.slice(0, 4).map((lesson) => lesson.id), [
    "jyutping-structure",
    "jyutping-finals",
    "jyutping-tones",
    "greeting-and-identity",
  ]);
  assert.equal(japanese.lessons[4].id, "basic-order");
  assert.equal(cantonese.lessons[4].id, "basic-order");

  const japaneseTags = new Set(japanese.knowledge.flatMap((item) => item.tags ?? []));
  const cantoneseTags = new Set(cantonese.knowledge.flatMap((item) => item.tags ?? []));
  for (const tag of ["foundation", "writing-system", "hiragana", "kana-pattern", "katakana"]) assert.ok(japaneseTags.has(tag), `Japanese needs ${tag}`);
  for (const tag of ["foundation", "writing-system", "jyutping", "tone", "grammar"]) assert.ok(cantoneseTags.has(tag), `Cantonese needs ${tag}`);

  assert.ok(japanese.exercises.some((exercise) => exercise.acceptedAnswers?.includes("がっこう")));
  assert.ok(cantonese.exercises.some((exercise) => exercise.acceptedAnswers?.includes("ngo5")));
  assert.ok(cantonese.exercises.some((exercise) => exercise.acceptedAnswers?.includes("si6")));
});

test("sampleCourse selects bundled content while custom languages receive an editable scaffold", () => {
  assert.equal(sampleCourse("ja").lessons[0].id, "writing-and-vowels");
  assert.equal(sampleCourse("yue-Hant-HK").lessons[2].id, "jyutping-tones");

  const custom = sampleCourse("fr", "French");
  assert.equal(custom.manifest.languageId, "fr");
  assert.equal(custom.lessons.length, 1);
  assert.equal(custom.manifest.languageAdapter.id, "core.generic");
  assert.equal(validateCourse(JSON.stringify(custom)).issues.length, 0);
});
