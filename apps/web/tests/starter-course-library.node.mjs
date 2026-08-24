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

test("the bundled library contains progressive English, Japanese, and Cantonese zero-beginner courses", () => {
  assert.deepEqual(bundledStarterLanguageIds, ["en", "ja", "yue-Hant-HK"]);
  const courses = bundledStarterCourses();
  assert.equal(courses.length, 3);
  const expected = {
    en: { version: "0.7.0", lessons: 16, exercises: 60 },
    ja: { version: "0.7.0", lessons: 16, exercises: 60 },
    "yue-Hant-HK": { version: "0.7.0", lessons: 16, exercises: 60 },
  };

  for (const course of courses) {
    const courseExpected = expected[course.manifest.languageId];
    assert.ok(courseExpected);
    assert.equal(validateCourse(JSON.stringify(course)).issues.length, 0);
    assert.equal(course.schemaVersion, 2);
    assert.equal(course.manifest.version, courseExpected.version);
    assert.equal(course.lessons.length, courseExpected.lessons);
    assert.equal(course.goals.length, courseExpected.lessons);
    assert.ok(course.knowledge.length >= 52);
    assert.ok(course.utterances.length >= 28);
    assert.equal(course.exercises.length, courseExpected.exercises);
    assert.ok(course.goals.every((goal) => goal.framework?.name === "CEFR Can-do" && goal.framework.level === "A1"));

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
      const diagnostic = lesson.steps.find((step) => step.diagnostic);
      const readingStep = lesson.steps.find((step) => step.id === "reading-comprehension");
      const capstoneStep = lesson.steps.find((step) => step.id === "integrated-capstone");
      assert.equal(lesson.steps.length, 9 + (diagnostic ? 1 : 0) + (readingStep ? 1 : 0) + (capstoneStep ? 1 : 0));
      assert.equal(reachableStepIds(lesson).size, lesson.steps.length, `${lesson.id} has unreachable steps`);
      assert.equal(lesson.steps.filter((step) => step.next.length === 0).length, diagnostic && !capstoneStep ? 2 : 1, `${lesson.id} has the wrong terminal count`);
      if (diagnostic) {
        assert.equal(diagnostic.phase, "diagnostic");
        assert.equal(diagnostic.exerciseRefs.length, 1);
        assert.deepEqual(new Set(diagnostic.next), new Set([diagnostic.diagnostic.learnNextStepId, diagnostic.diagnostic.passNextStepId]));
      }
      lesson.steps.forEach((step) => {
        assertBilingual(step.title, `lesson.${lesson.id}.step.${step.id}.title`);
        assert.ok(step.exerciseRefs.length <= 1, `${lesson.id}.${step.id} exceeds the player exercise limit`);
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

test("each course has cross-lesson checkpoints after every four-lesson stage", () => {
  for (const course of bundledStarterCourses()) {
    const capstones = course.lessons.flatMap((lesson, index) => {
      const step = lesson.steps.find((candidate) => candidate.id === "integrated-capstone");
      return step ? [{ lesson, index, step }] : [];
    });

    const expectedCheckpoints = Array.from({ length: course.lessons.length / 4 }, (_, index) => (index + 1) * 4);
    assert.deepEqual(capstones.map(({ index }) => index + 1), expectedCheckpoints);

    for (const { lesson, step } of capstones) {
      const lessonKnowledge = new Set(lesson.steps.find((candidate) => candidate.id === "preteach")?.knowledgeRefs ?? []);
      assert.ok(step.knowledgeRefs.some((id) => !lessonKnowledge.has(id)), `${lesson.id} checkpoint must integrate earlier lessons`);
      assert.equal(step.exerciseRefs.length, 1);
      const exercise = course.exercises.find((candidate) => candidate.id === step.exerciseRefs[0]);
      assert.ok(exercise, `${lesson.id} checkpoint exercise must exist`);
      assert.ok(exercise.kind === "short-input" || exercise.rubricRef, `${lesson.id} checkpoint needs deterministic answers or a rubric`);
    }

    const finalExercise = course.exercises.find((exercise) => exercise.id === capstones.at(-1).step.exerciseRefs[0]);
    assert.match(finalExercise.prompt["zh-CN"], /结业/);
    assert.match(finalExercise.prompt.en, /capstone/i);
  }
});

test("A1 courses include denser vocabulary and short-text information extraction", () => {
  for (const course of bundledStarterCourses()) {
    const readingKnowledge = course.knowledge.filter((item) => item.tags?.includes("reading"));
    const readingTexts = course.utterances.filter((item) => item.id.includes("reading-"));
    const readingExercises = course.exercises.filter((item) => item.id.includes("-read-"));

    assert.ok(readingKnowledge.length >= 15, `${course.manifest.languageId} needs denser reading vocabulary`);
    const expectedReadingCount = 8;
    assert.equal(readingTexts.length, expectedReadingCount, `${course.manifest.languageId} has the wrong short-reading count`);
    assert.equal(readingExercises.length, expectedReadingCount, `${course.manifest.languageId} has the wrong information-extraction count`);

    const readingTextIds = new Set(readingTexts.map((item) => item.id));
    for (const exercise of readingExercises) {
      assert.equal(exercise.kind, "single-choice");
      assert.ok(exercise.utteranceRefs?.some((id) => readingTextIds.has(id)), `${exercise.id} must cite its reading text`);
      assert.ok(course.lessons.some((lesson) => lesson.steps.some((step) => step.id === "reading-comprehension" && step.exerciseRefs.includes(exercise.id))), `${exercise.id} must run in a dedicated reading step`);
    }
  }
});

test("foundation lessons cover each language's writing or romanization system before scenarios", () => {
  const courses = bundledStarterCourses();
  const english = courses.find((course) => course.manifest.languageId === "en");
  const japanese = courses.find((course) => course.manifest.languageId === "ja");
  const cantonese = courses.find((course) => course.manifest.languageId === "yue-Hant-HK");
  assert.ok(english && japanese && cantonese);

  assert.deepEqual(english.lessons.slice(0, 4).map((lesson) => lesson.id), [
    "alphabet-and-case",
    "pronouns-and-be",
    "basic-word-order",
    "greeting-and-identity",
  ]);
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
  assert.deepEqual(english.lessons.slice(4, 9).map((lesson) => lesson.id), [
    "numbers-and-time",
    "places-and-questions",
    "shopping-and-prices",
    "transport-and-directions",
    "help-and-clarification",
  ]);
  assert.deepEqual(japanese.lessons.slice(4, 9).map((lesson) => lesson.id), [
    "greeting-and-identity",
    "numbers-and-time",
    "places-and-questions",
    "shopping-and-prices",
    "transport-and-help",
  ]);
  assert.deepEqual(cantonese.lessons.slice(4, 9).map((lesson) => lesson.id), [
    "numbers-and-time",
    "places-and-questions",
    "shopping-and-prices",
    "transport-and-directions",
    "help-and-negation",
  ]);
  assert.equal(english.lessons[9].id, "basic-order");
  assert.equal(japanese.lessons[9].id, "basic-order");
  assert.equal(cantonese.lessons[9].id, "basic-order");
  assert.equal(english.manifest.languageAdapter.id, "core.generic");

  const englishTags = new Set(english.knowledge.flatMap((item) => item.tags ?? []));
  const japaneseTags = new Set(japanese.knowledge.flatMap((item) => item.tags ?? []));
  const cantoneseTags = new Set(cantonese.knowledge.flatMap((item) => item.tags ?? []));
  for (const tag of ["foundation", "writing-system", "alphabet", "capitalization", "grammar"]) assert.ok(englishTags.has(tag), `English needs ${tag}`);
  for (const tag of ["foundation", "writing-system", "hiragana", "kana-pattern", "katakana"]) assert.ok(japaneseTags.has(tag), `Japanese needs ${tag}`);
  for (const tag of ["foundation", "writing-system", "jyutping", "tone", "grammar"]) assert.ok(cantoneseTags.has(tag), `Cantonese needs ${tag}`);

  assert.ok(english.exercises.some((exercise) => exercise.acceptedAnswers?.includes("How do you spell your name?")));
  assert.ok(japanese.exercises.some((exercise) => exercise.acceptedAnswers?.includes("がっこう")));
  assert.ok(cantonese.exercises.some((exercise) => exercise.acceptedAnswers?.includes("ngo5")));
  assert.ok(cantonese.exercises.some((exercise) => exercise.acceptedAnswers?.includes("si6")));
  assert.ok(japanese.knowledge.some((item) => item.tags?.includes("jlpt-n5-relevant")));
});

test("English 0.7 adds four compatible A1 domains after the stable twelve-lesson core", () => {
  const english = bundledStarterCourses().find((course) => course.manifest.languageId === "en");
  assert.ok(english);
  assert.equal(english.manifest.version, "0.7.0");
  assert.deepEqual(english.lessons.slice(12).map((lesson) => lesson.id), [
    "daily-routines",
    "family-and-possessions",
    "days-and-arrangements",
    "health-and-essential-needs",
  ]);
  assert.ok(english.knowledge.some((item) => item.id === "en-present-routine"));
  assert.ok(english.knowledge.some((item) => item.id === "en-feel-sick"));
  assert.ok(english.exercises.some((item) => item.id === "en-capstone-expanded-a1"));
});

test("Japanese 0.7 adds four compatible N5-relevant A1 domains after the stable twelve-lesson core", () => {
  const japanese = bundledStarterCourses().find((course) => course.manifest.languageId === "ja");
  assert.ok(japanese);
  assert.equal(japanese.manifest.version, "0.7.0");
  assert.deepEqual(japanese.lessons.slice(0, 12).map((lesson) => lesson.id), [
    "writing-and-vowels",
    "hiragana-core",
    "kana-patterns",
    "katakana-core",
    "greeting-and-identity",
    "numbers-and-time",
    "places-and-questions",
    "shopping-and-prices",
    "transport-and-help",
    "basic-order",
    "drink-details",
    "dine-or-takeaway",
  ]);
  assert.deepEqual(japanese.lessons.slice(12).map((lesson) => lesson.id), [
    "daily-routines",
    "family-and-existence",
    "days-and-arrangements",
    "health-and-medicine",
  ]);
  assert.ok(japanese.knowledge.some((item) => item.id === "ja-time-ni"));
  assert.ok(japanese.knowledge.some((item) => item.id === "ja-body-pain"));
  assert.ok(japanese.exercises.some((item) => item.id === "ja-capstone-expanded-a1"));
});

test("Cantonese 0.7 adds four compatible A1 domains after the stable twelve-lesson core", () => {
  const cantonese = bundledStarterCourses().find((course) => course.manifest.languageId === "yue-Hant-HK");
  assert.ok(cantonese);
  assert.equal(cantonese.manifest.version, "0.7.0");
  assert.deepEqual(cantonese.lessons.slice(0, 12).map((lesson) => lesson.id), [
    "jyutping-structure",
    "jyutping-finals",
    "jyutping-tones",
    "greeting-and-identity",
    "numbers-and-time",
    "places-and-questions",
    "shopping-and-prices",
    "transport-and-directions",
    "help-and-negation",
    "basic-order",
    "drink-details",
    "dine-or-takeaway",
  ]);
  assert.deepEqual(cantonese.lessons.slice(12).map((lesson) => lesson.id), [
    "daily-routines",
    "classifiers-and-family",
    "days-and-arrangements",
    "health-and-medicine",
  ]);
  assert.ok(cantonese.knowledge.some((item) => item.id === "yue-classifier-go"));
  assert.ok(cantonese.knowledge.some((item) => item.id === "yue-body-pain"));
  assert.ok(cantonese.exercises.some((item) => item.id === "yue-capstone-expanded-a1"));
});

test("sampleCourse selects bundled content while custom languages receive an editable scaffold", () => {
  assert.equal(sampleCourse("en").lessons[0].id, "alphabet-and-case");
  assert.equal(sampleCourse("ja").lessons[0].id, "writing-and-vowels");
  assert.equal(sampleCourse("yue-Hant-HK").lessons[2].id, "jyutping-tones");

  const custom = sampleCourse("fr", "French");
  assert.equal(custom.manifest.languageId, "fr");
  assert.equal(custom.lessons.length, 1);
  assert.equal(custom.manifest.languageAdapter.id, "core.generic");
  assert.equal(validateCourse(JSON.stringify(custom)).issues.length, 0);
});
