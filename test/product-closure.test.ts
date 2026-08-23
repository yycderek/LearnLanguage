import { describe, expect, it } from "vitest";
import type { CoursePack } from "../packages/protocol/src/types.js";
import { deriveWeakKnowledge, summarizeCourseCompletion, type LearningRecordProjection } from "../packages/application/src/product-closure.js";

const course = {
  manifest: { id: "course", version: "1.0.0", languageId: "en" },
  goals: [
    { id: "goal-1", description: { en: "Handle an introduction" } },
    { id: "goal-2", description: { en: "Ask a follow-up question" } },
  ],
  knowledge: [
    { id: "knowledge-1", form: "Nice to meet you" },
    { id: "knowledge-2", form: "How about you?" },
  ],
  lessons: [
    { id: "lesson-1", canDoGoalRefs: ["goal-1"], steps: [{ id: "step-1", knowledgeRefs: ["knowledge-1"] }] },
    { id: "lesson-2", canDoGoalRefs: ["goal-2"], steps: [{ id: "step-2", knowledgeRefs: ["knowledge-2"] }] },
  ],
} as unknown as CoursePack;

const record: LearningRecordProjection = {
  courseId: "course",
  completedLessonIds: ["lesson-1", "lesson-2"],
  lessonProgress: {
    "lesson-1": { attemptCounts: { "step-1": 3 } },
    "lesson-2": { attemptCounts: { "step-2": 1 } },
  },
  mastery: {
    "knowledge-1": { level: "comprehended" },
    "knowledge-2": { level: "independent-output" },
  },
  reviews: [
    { id: "review-1", knowledgeItemId: "knowledge-1", dueAt: "2026-08-22T00:00:00.000Z" },
    { id: "review-2", knowledgeItemId: "knowledge-2", dueAt: "2026-08-30T00:00:00.000Z" },
  ],
  reviewEvents: [
    { knowledgeItemId: "knowledge-1", result: "retry" },
    { knowledgeItemId: "knowledge-2", result: "remembered" },
  ],
};

describe("R33 product closure projections", () => {
  it("derives targeted practice only from existing evidence, without raw answers", () => {
    const weak = deriveWeakKnowledge(course, record, "2026-08-23T00:00:00.000Z");
    expect(weak).toHaveLength(1);
    expect(weak[0]).toMatchObject({ knowledgeItemId: "knowledge-1", retryCount: 2, failedReviewCount: 1, due: true, masteryLevel: "comprehended", reviewTaskIds: ["review-1"] });
    expect(weak[0]?.reasons).toEqual(["lesson-retries", "review-retries", "due-review", "early-mastery"]);
    expect(JSON.stringify(weak)).not.toContain("answer");
  });
  it("summarizes completion, achieved goals, mastery, reviews, and next actions", () => {
    const summary = summarizeCourseCompletion(course, record, "2026-08-23T00:00:00.000Z");
    expect(summary.complete).toBe(true);
    expect(summary.completedLessonCount).toBe(2);
    expect(summary.achievedGoalIds).toEqual(["goal-1", "goal-2"]);
    expect(summary.masteryCounts).toMatchObject({ comprehended: 1, "independent-output": 1 });
    expect(summary.dueReviewCount).toBe(1);
    expect(summary.nextActions).toEqual(["targeted-practice", "due-review", "revisit-course", "choose-course"]);
  });
  it("does not report an uncompleted goal early", () => {
    const summary = summarizeCourseCompletion(course, { ...record, completedLessonIds: ["lesson-1"] }, "2026-08-23T00:00:00.000Z");
    expect(summary.complete).toBe(false);
    expect(summary.achievedGoalIds).toEqual(["goal-1"]);
  });
});
