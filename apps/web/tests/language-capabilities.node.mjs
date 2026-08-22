import assert from "node:assert/strict";
import test from "node:test";
import { assessCourseLanguageCompatibility } from "@learn-language/language-runtime";
import { sampleCourse } from "../lib/course.ts";
import { bundledCatalogCourses } from "../lib/course-library.ts";
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

test("every bundled course passes the language runtime installation gate", () => {
  for (const course of bundledCatalogCourses()) {
    const pack = builtInLanguagePacks.find((item) => item.id === course.manifest.languageId);
    const report = assessCourseLanguageCompatibility(course, pack);
    assert.notEqual(report.status, "blocked", `${course.manifest.id}: ${JSON.stringify(report.issues)}`);
  }
});

test("missing packs and adapter version mismatches block a published course", () => {
  const course = bundledCatalogCourses().find((item) => item.manifest.languageId === "ja");
  assert.ok(course);
  assert.equal(assessCourseLanguageCompatibility(course, undefined).status, "blocked");

  const pack = structuredClone(builtInLanguagePacks.find((item) => item.id === course.manifest.languageId));
  pack.adapter.version = "999.0.0";
  const report = assessCourseLanguageCompatibility(course, pack);
  assert.equal(report.status, "blocked");
  assert.ok(report.issues.some((issue) => issue.code === "course-adapter-mismatch"));
});

test("missing exercise capabilities require an explicit fallback", () => {
  const course = structuredClone(bundledCatalogCourses()[0]);
  course.exercises[0].requiredCapabilities = ["token-comparison"];
  delete course.exercises[0].capabilityFallback;
  const pack = builtInLanguagePacks.find((item) => item.id === course.manifest.languageId);
  const report = assessCourseLanguageCompatibility(course, pack);
  assert.equal(report.status, "blocked");
  assert.ok(report.issues.some((issue) => issue.code === "exercise-capability-missing"));
});
