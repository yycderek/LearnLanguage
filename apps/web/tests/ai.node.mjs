import assert from "node:assert/strict";
import test from "node:test";
import { buildLearningFeedbackPrompt, parseAiFeedback, resolveCompatibleEndpoint } from "../lib/ai.ts";
import { sampleCourse } from "../lib/course.ts";

test("AI feedback parser accepts fenced JSON and rejects incomplete output", () => {
  const parsed = parseAiFeedback('```json\n{"verdict":"retry","title":"再自然一点","message":"任务已表达清楚。","suggestion":"请给我一杯咖啡。"}\n```');
  assert.equal(parsed.verdict, "retry");
  assert.equal(parsed.suggestion, "请给我一杯咖啡。");
  assert.throws(() => parseAiFeedback('{"title":"缺少判定"}'));
});

test("compatible endpoint and learning prompt are normalized", () => {
  assert.equal(resolveCompatibleEndpoint("https://example.test/v1"), "https://example.test/v1/chat/completions");
  assert.equal(resolveCompatibleEndpoint("https://example.test/responses"), "https://example.test/responses");
  const course = sampleCourse("ja");
  const prompt = buildLearningFeedbackPrompt({
    course,
    lessonTitle: "咖啡店点单",
    prompt: "向店员点一杯饮料",
    answer: "コーヒーをお願いします。",
    targetForms: ["コーヒー", "〜をお願いします"],
  });
  assert.match(prompt, /コーヒーをお願いします/);
  assert.match(prompt, /不要要求逐字复现/);
});

test("English teaching language produces an English feedback contract", () => {
  const course = sampleCourse("ja");
  const prompt = buildLearningFeedbackPrompt({
    course,
    lessonTitle: "Ordering at a café",
    prompt: "Order a drink from the server.",
    answer: "コーヒーをお願いします。",
    targetForms: ["コーヒー", "〜をお願いします"],
    teachingLocale: "en",
  });
  assert.match(prompt, /Course: Japanese Zero Beginner/);
  assert.match(prompt, /Respond in English/);
  assert.equal(parseAiFeedback('{"verdict":"pass","message":"Clear and appropriate."}', "en").title, "Task complete");
});
