import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_ARTICLE_CHARACTERS,
  MAX_ARTICLE_SENTENCES,
  articleSentenceCount,
  createCourseDraftFromArticle,
} from "../lib/article-course.ts";
import { validateCourse } from "../lib/course.ts";

test("article material becomes a private editable Course Pack with one unit", () => {
  const course = createCourseDraftFromArticle({
    languageId: "es",
    languageName: "Spanish",
    locale: "en",
    courseId: "weekend-walk",
    title: "A weekend walk",
    text: "I walk through the old town. The market is busy! I stop for coffee and write a postcard.",
  });

  assert.equal(course.manifest.status, "draft");
  assert.equal(course.manifest.visibility, "private");
  assert.equal(course.manifest.source.kind, "imported");
  assert.equal(course.manifest.languageId, "es");
  assert.equal(course.utterances.length, 3);
  assert.equal(course.exercises.length, 4);
  assert.equal(course.units.length, 1);
  assert.deepEqual(course.units[0].lessonRefs, [course.lessons[0].id]);
  assert.equal(course.lessons[0].steps.length, 4);
  assert.equal(validateCourse(JSON.stringify(course)).issues.length, 0);
});

test("article splitting is deterministic and capped for a manageable draft", () => {
  const text = Array.from({ length: MAX_ARTICLE_SENTENCES + 5 }, (_, index) => "Sentence " + (index + 1) + ".").join(" ");
  assert.equal(articleSentenceCount(text), MAX_ARTICLE_SENTENCES);
  const course = createCourseDraftFromArticle({ languageId: "fr", languageName: "French", locale: "en", title: "Many lines", text });
  assert.equal(course.utterances.length, MAX_ARTICLE_SENTENCES);
});

test("article conversion rejects missing titles and unsafe content sizes", () => {
  const base = { languageId: "de", languageName: "German", locale: "en", title: "Source", text: "This source paragraph is long enough to become a course draft." };
  assert.throws(() => createCourseDraftFromArticle({ ...base, title: "" }), /article-title-required/);
  assert.throws(() => createCourseDraftFromArticle({ ...base, text: "Too short." }), /article-too-short/);
  assert.throws(() => createCourseDraftFromArticle({ ...base, text: "a".repeat(MAX_ARTICLE_CHARACTERS + 1) }), /article-too-large/);
});
