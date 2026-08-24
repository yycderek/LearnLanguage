import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAiTutorPrompt,
  buildLearningFeedbackPrompt,
  parseAiFeedback,
  parseAiTutorAnswer,
  resolveCompatibleEndpoint,
} from "../lib/ai.ts";
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

test("AI tutor prompt stays contextual and cannot decide learning progress", () => {
  const course = sampleCourse("ja");
  const prompt = buildAiTutorPrompt({
    course,
    lessonTitle: "咖啡店点单",
    stepTitle: "独立完成场景任务",
    phase: "independent-task",
    task: "向店员点一杯饮料",
    learnerResponse: "コーヒー",
    knowledge: [{ form: "〜をお願いします", meaning: "请给我……" }],
    utterances: [{ text: "コーヒーをお願いします。", translation: "请给我咖啡。" }],
    intent: "hint",
  });
  assert.match(prompt, /不直接替学习者完成当前练习/);
  assert.match(prompt, /不得评分、判定完成、改变学习进度/);
  assert.match(prompt, /コーヒー/);
});

test("AI tutor parser validates bounded structured replies", () => {
  const answer = parseAiTutorAnswer('```json\n{"title":"请求表达","explanation":"使用名词加 をお願いします。","examples":["水をお願いします。— 请给我水。"],"practicePrompt":"试着点一杯茶。","caution":"这是礼貌的基础表达。"}\n```');
  assert.equal(answer.title, "请求表达");
  assert.equal(answer.examples.length, 1);
  assert.equal(answer.practicePrompt, "试着点一杯茶。");
  assert.throws(() => parseAiTutorAnswer('{"title":"缺少解释","examples":[]}'), /explanation/);
  assert.throws(() => parseAiTutorAnswer(JSON.stringify({ title: "过多例句", explanation: "说明", examples: ["1", "2", "3", "4"] })), /examples/);
});
