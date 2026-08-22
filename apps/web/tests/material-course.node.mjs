import assert from "node:assert/strict";
import test from "node:test";
import { applyCourseAuthoringEnhancement, requestCourseAuthoringEnhancement } from "../lib/course-ai.ts";
import { analyzeCourseMaterial, createCourseDraftFromMaterials } from "../lib/material-course.ts";
import { validateCourse } from "../lib/course.ts";

const materials = [
  { id: "story", title: "Morning market", kind: "article", sourceLabel: "market.md", text: "I visit the morning market. A baker sells warm bread. I choose a small loaf and thank her." },
  { id: "song", title: "Walking home", kind: "lyrics", sourceLabel: "walking.lrc", text: "Walking home\nUnder the moon\nWalking home\nI remember you" },
];

test("multiple materials become separate editable units with deterministic answers", () => {
  const course = createCourseDraftFromMaterials({ languageId: "en", languageName: "English", locale: "en", courseId: "mixed-materials", title: "Everyday materials", materials });
  assert.equal(course.manifest.visibility, "private");
  assert.equal(course.manifest.status, "draft");
  assert.equal(course.units.length, 2);
  assert.equal(course.lessons.length, 2);
  assert.equal(course.exercises.length, 8);
  assert.ok(course.knowledge.some((item) => item.tags?.includes("review-required")));
  assert.ok(course.exercises.filter((item) => item.evaluationSources?.includes("deterministic")).every((item) => item.acceptedAnswers?.length || item.correctOrder?.length));
  assert.equal(validateCourse(JSON.stringify(course)).issues.length, 0);
});

test("lyrics preserve lines and report repetitions while level remains an estimate", () => {
  const analysis = analyzeCourseMaterial(materials[1].text, "en", "lyrics");
  assert.equal(analysis.sentenceCount, 4);
  assert.deepEqual(analysis.repeatedLines, ["Walking home"]);
  assert.match(analysis.estimatedLevel, /^(?:A1|A2|B1|B2|C1)$/);
});

test("very short lyric lines still produce a protocol-valid ordering exercise", () => {
  const course = createCourseDraftFromMaterials({ languageId: "ja", languageName: "Japanese", locale: "en", courseId: "short-lines", title: "Short lines", materials: [{ id: "short", title: "Short lyric", kind: "lyrics", text: "春\n風\n花\n空\n海\n山\n光\n夢\n今\n心\n声\n道\n星\n月\n夜\n朝\n雨\n雲\n森\n川" }] });
  assert.equal(validateCourse(JSON.stringify(course)).issues.length, 0);
  assert.ok(course.exercises.find((item) => item.kind === "ordering").options.length >= 2);
});

test("personal AI enhancement is validated and merged into the same Course Pack", async () => {
  const course = createCourseDraftFromMaterials({ languageId: "en", languageName: "English", locale: "zh-CN", courseId: "ai-material", title: "素材课", materials: [materials[0]] });
  const firstUtterance = course.utterances[0].id;
  const enhancement = await requestCourseAuthoringEnhancement(
    { provider: "compatible", model: "teacher-model", endpoint: "https://ai.example/v1/chat/completions", apiKey: "session-key" },
    course,
    "zh-CN",
    async () => Response.json({ choices: [{ message: { content: JSON.stringify({ estimatedLevel: { level: "A2", reason: "Short concrete sentences" }, translations: [{ utteranceId: firstUtterance, text: "我逛早市。" }, { utteranceId: "unknown", text: "ignored" }], knowledge: [{ kind: "grammar", form: "visit", meaning: "表示到访", usage: "后接地点", utteranceIds: [firstUtterance, "unknown"] }] }) } }] }),
  );
  const merged = applyCourseAuthoringEnhancement(course, enhancement, "zh-CN");
  assert.equal(merged.utterances[0].translation["zh-CN"], "我逛早市。");
  assert.equal(merged.goals[0].framework.level, "A2");
  assert.ok(merged.knowledge.some((item) => item.kind === "grammar" && item.form === "visit"));
  assert.equal(validateCourse(JSON.stringify(merged)).issues.length, 0);
});
