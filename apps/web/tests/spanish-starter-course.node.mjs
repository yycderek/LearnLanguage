import assert from "node:assert/strict";
import test from "node:test";
import {
  builtInLanguagePacks,
  bundledStarterCourse,
  validateCourse,
} from "@learn-language/content";
import { assessCourseLanguageCompatibility, resolveLanguageRuntime } from "@learn-language/language-runtime";

function assertBilingual(value, path) {
  assert.equal(typeof value?.["zh-CN"], "string", `${path} needs Chinese text`);
  assert.ok(value["zh-CN"].trim(), `${path} Chinese text must not be empty`);
  assert.equal(typeof value?.en, "string", `${path} needs English text`);
  assert.ok(value.en.trim(), `${path} English text must not be empty`);
}

test("Spanish ships as a complete generic-runtime Language Pack and Course Pack pair", () => {
  const pack = builtInLanguagePacks.find((item) => item.id === "es");
  const course = bundledStarterCourse("es");
  assert.ok(pack && course);

  assert.equal(pack.name.native, "Español");
  assert.equal(pack.scripts[0]?.code, "Latn");
  assert.equal(pack.segmentation.strategy, "whitespace");
  assert.equal(pack.adapter, undefined);
  assert.equal(course.manifest.version, "0.6.0");
  assert.equal(course.manifest.languageAdapter.id, "core.generic");
  assert.equal(validateCourse(JSON.stringify(course)).issues.length, 0);
  const compatibility = assessCourseLanguageCompatibility(course, pack);
  assert.equal(compatibility.status, "degraded");
  assert.ok(compatibility.issues.every((issue) => issue.code === "exercise-capability-fallback"));
});

test("Spanish 0.6 contains twelve progressive lessons, 43 exercises, four readings, and three checkpoints", () => {
  const course = bundledStarterCourse("es");
  assert.ok(course);
  assert.deepEqual(course.lessons.map((lesson) => lesson.id), [
    "alphabet-and-signs",
    "pronouns-and-ser",
    "gender-number-and-articles",
    "greeting-and-identity",
    "numbers-time-and-dates",
    "estar-location-and-negation",
    "shopping-and-prices",
    "transport-and-directions",
    "help-and-clarification",
    "basic-order",
    "quantity-preference-and-agreement",
    "dine-in-takeaway-and-service",
  ]);
  assert.equal(course.goals.length, 12);
  assert.ok(course.knowledge.length >= 52);
  assert.ok(course.utterances.length >= 28);
  assert.equal(course.exercises.length, 43);
  assert.equal(course.utterances.filter((item) => item.id.includes("reading-")).length, 4);
  assert.equal(course.exercises.filter((item) => item.id.includes("-read-")).length, 4);
  assert.deepEqual(course.lessons.flatMap((lesson, index) => lesson.steps.some((step) => step.id === "integrated-capstone") ? [index + 1] : []), [4, 8, 12]);
  assert.ok(course.exercises.some((item) => item.id === "es-capstone-course"));
});

test("Spanish content preserves accents, paired punctuation, agreement, bilingual teaching, and regional restraint", () => {
  const course = bundledStarterCourse("es");
  const pack = builtInLanguagePacks.find((item) => item.id === "es");
  assert.ok(course && pack);
  const runtime = resolveLanguageRuntime(pack);

  assert.equal(runtime.adapterId, "core.generic");
  assert.equal(runtime.normalize("  Espan\u0303ol  "), "Español");
  assert.deepEqual(runtime.segment("¿Cómo te llamas?").map((token) => token.text), ["¿Cómo", "te", "llamas?"]);
  assert.ok(course.knowledge.some((item) => item.form.includes("¿")));
  assert.ok(course.knowledge.some((item) => item.form.includes("ñ")));
  assert.ok(course.knowledge.some((item) => item.id === "es-adjective-agreement"));
  assert.match(course.knowledge.find((item) => item.id === "es-here-takeaway")?.usage.en ?? "", /different regions/i);
  assert.ok(course.exercises.some((exercise) => exercise.acceptedAnswers?.includes("¿Cómo se escribe?")));

  assertBilingual(course.manifest.title, "manifest.title");
  assertBilingual(course.manifest.description, "manifest.description");
  course.goals.forEach((goal) => assertBilingual(goal.description, `goal.${goal.id}`));
  course.exercises.forEach((exercise) => {
    assertBilingual(exercise.prompt, `exercise.${exercise.id}.prompt`);
    assertBilingual(exercise.guidance, `exercise.${exercise.id}.guidance`);
  });
});
