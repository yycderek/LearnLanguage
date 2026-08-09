import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_LOCALE_PREFERENCE_KEY,
  localizedText,
  normalizeAppLocale,
  normalizeTeachingLocale,
  normalizeUiLocale,
  resolveStoredAppLocale,
  TEACHING_LOCALE_PREFERENCE_KEY,
  UI_LOCALE_PREFERENCE_KEY,
  uiText,
} from "../lib/i18n.ts";
import { displayText, sampleCourse } from "../lib/course.ts";

test("teaching locale selects English and preserves Chinese as the default", () => {
  const value = { "zh-CN": "咖啡", en: "coffee" };
  assert.equal(localizedText(value, "zh-CN"), "咖啡");
  assert.equal(localizedText(value, "en"), "coffee");
  assert.equal(displayText(value), "咖啡");
  assert.equal(uiText("en", "中文", "English"), "English");
  assert.equal(normalizeTeachingLocale("unsupported"), "zh-CN");
});

test("one application locale drives both interface and teaching content", () => {
  assert.equal(APP_LOCALE_PREFERENCE_KEY, "app-locale");
  assert.notEqual(UI_LOCALE_PREFERENCE_KEY, TEACHING_LOCALE_PREFERENCE_KEY);
  assert.equal(resolveStoredAppLocale("en", "zh-CN", "zh-CN"), "en");
  assert.equal(resolveStoredAppLocale(undefined, "en", "zh-CN"), "en");
  assert.equal(resolveStoredAppLocale(undefined, undefined, "en"), "en");
  assert.equal(normalizeAppLocale("unsupported"), "zh-CN");
  assert.equal(normalizeUiLocale("en"), "en");
  assert.equal(normalizeUiLocale("unsupported"), "zh-CN");
  assert.equal(uiText("en", "中文界面", "English interface"), "English interface");
  assert.equal(localizedText({ "zh-CN": "中文解释", en: "English explanation" }, "zh-CN"), "中文解释");
});

test("localized content has deterministic fallbacks", () => {
  assert.equal(localizedText({ "zh-CN": "只有中文" }, "en"), "只有中文");
  assert.equal(localizedText({ native: "Français" }, "en"), "Français");
  assert.equal(localizedText(undefined, "en"), "Untitled");
});

test("bundled course provides a complete English learner path", () => {
  const course = sampleCourse("ja");
  assert.equal(displayText(course.manifest.title, "en"), "Japanese Café Starter");
  assert.ok(course.lessons.every((lesson) => Boolean(lesson.title.en)));
  assert.ok(course.lessons.flatMap((lesson) => lesson.steps).every((step) => Boolean(step.title.en)));
  assert.ok(course.knowledge.every((item) => Boolean(item.meaning.en)));
  assert.ok(course.exercises.every((exercise) => Boolean(exercise.prompt.en)));
});
