import assert from "node:assert/strict";
import test from "node:test";
import { sampleCourse } from "../lib/course.ts";
import {
  builtInLanguagePacks,
  languageCapabilities,
  resolveExerciseCapabilities,
} from "../lib/language-pack.ts";

test("built-in adapters declare the capabilities they can satisfy", () => {
  const japanese = builtInLanguagePacks.find((pack) => pack.id === "ja");
  const capabilities = languageCapabilities(japanese);
  assert.equal(capabilities.has("normalization"), true);
  assert.equal(capabilities.has("segmentation"), true);
  assert.equal(capabilities.has("token-comparison"), false);
});

test("exercise capability requirements select an explicit fallback", () => {
  const course = sampleCourse("ja");
  const exercise = course.exercises.find((item) => item.requiredCapabilities?.includes("token-comparison"));
  assert.ok(exercise);
  const japanese = builtInLanguagePacks.find((pack) => pack.id === "ja");
  assert.deepEqual(resolveExerciseCapabilities(exercise, japanese), {
    mode: "self-assessment",
    missing: ["token-comparison"],
  });

  const nativeExercise = { ...exercise, requiredCapabilities: ["segmentation"] };
  assert.deepEqual(resolveExerciseCapabilities(nativeExercise, japanese), {
    mode: "native",
    missing: [],
  });
});

test("generic non-adapter segmentation is exposed as a native capability", () => {
  const generic = {
    schemaVersion: 1,
    id: "en",
    name: { native: "English" },
    accent: "EN",
    scripts: [{ code: "Latn", name: { native: "Latin" }, direction: "ltr", primary: true }],
    readingSystems: [],
    segmentation: { strategy: "whitespace" },
  };
  assert.equal(languageCapabilities(generic).has("segmentation"), true);
});
