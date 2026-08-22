import { describe, expect, it } from "vitest";
import {
  LearningPlanApplicationService,
  MemoryLearningPlanRepository,
  createLearningPlan,
  placementQuestions,
} from "@learn-language/application";
import type { CoursePack } from "@learn-language/protocol";

function course(): CoursePack {
  const lesson = (index: number, diagnostic = true) => ({
    id: `lesson-${index}`,
    title: { en: `Lesson ${index}` },
    canDoGoalRefs: [`goal-${index}`],
    entryStepId: "diagnose",
    steps: [{
      id: "diagnose",
      phase: "diagnostic" as const,
      title: { en: "Check" },
      supportLevel: "none" as const,
      knowledgeRefs: [],
      utteranceRefs: [],
      exerciseRefs: diagnostic ? [`exercise-${index}`] : [],
      next: [],
      ...(diagnostic ? { diagnostic: { learnNextStepId: "diagnose", passNextStepId: "diagnose" } } : {}),
    }],
  });
  return {
    schemaVersion: 2,
    manifest: {
      id: "course.en.beginner",
      version: "1.0.0",
      languageId: "en",
      title: { en: "English" },
      description: { en: "Beginner course" },
      author: { id: "test", displayName: "Test" },
      visibility: "private",
      status: "draft",
      source: { kind: "original", title: "Test" },
      languageAdapter: { id: "core.generic", version: "1.0.0" },
    },
    goals: [1, 2, 3, 4, 5].map((index) => ({ id: `goal-${index}`, description: { en: `Goal ${index}` } })),
    knowledge: [],
    utterances: [],
    exercises: [1, 2, 3, 4].map((index) => ({
      id: `exercise-${index}`,
      kind: "single-choice" as const,
      prompt: { en: `Question ${index}` },
      options: [{ en: "A" }, { en: "B" }],
      correctOptionIndex: 0,
      knowledgeRefs: [],
      utteranceRefs: [],
    })),
    rubrics: [],
    lessons: [lesson(1), lesson(2), lesson(3), lesson(4), lesson(5, false)],
  };
}

describe("client-independent learning plans", () => {
  it("reuses deterministic lesson diagnostics as placement questions", () => {
    expect(placementQuestions(course())).toEqual([
      { lessonId: "lesson-1", lessonIndex: 0, exerciseRef: "exercise-1" },
      { lessonId: "lesson-2", lessonIndex: 1, exerciseRef: "exercise-2" },
      { lessonId: "lesson-3", lessonIndex: 2, exerciseRef: "exercise-3" },
      { lessonId: "lesson-4", lessonIndex: 3, exerciseRef: "exercise-4" },
    ]);
  });

  it("recommends the first failed foundation lesson without creating mastery evidence", () => {
    const plan = createLearningPlan(course(), {
      motivation: "travel",
      minutesPerDay: 15,
      daysPerWeek: 5,
      placementMode: "completed",
      placementResults: [
        { lessonId: "lesson-1", passed: true },
        { lessonId: "lesson-2", passed: true },
        { lessonId: "lesson-3", passed: false },
        { lessonId: "lesson-4", passed: false },
      ],
      occurredAt: "2026-08-22T08:00:00.000Z",
    });
    expect(plan.placement).toMatchObject({
      correctCount: 2,
      total: 4,
      recommendedLessonId: "lesson-3",
      placedOutLessonIds: ["lesson-1", "lesson-2"],
    });
    expect(plan.weeklyTargetMinutes).toBe(75);
    expect(plan.lessonTargetCount).toBe(2);
    expect(plan.reviewTargetMinutes).toBe(35);
    expect(plan).not.toHaveProperty("answers");
  });

  it("starts after the assessed foundation when every check passes", () => {
    const plan = createLearningPlan(course(), {
      motivation: "daily-life",
      minutesPerDay: 20,
      daysPerWeek: 3,
      placementMode: "completed",
      placementResults: [1, 2, 3, 4].map((index) => ({ lessonId: `lesson-${index}`, passed: true })),
      occurredAt: "2026-08-22T08:00:00.000Z",
    });
    expect(plan.placement.recommendedLessonId).toBe("lesson-5");
    expect(plan.placement.placedOutLessonIds).toEqual(["lesson-1", "lesson-2", "lesson-3", "lesson-4"]);
  });

  it("keeps creation time stable when a learner updates a device-local plan", async () => {
    const repository = new MemoryLearningPlanRepository();
    const service = new LearningPlanApplicationService(repository);
    const first = await service.create(course(), {
      motivation: "travel", minutesPerDay: 15, daysPerWeek: 5, placementMode: "skipped", occurredAt: "2026-08-22T08:00:00.000Z",
    });
    const updated = await service.create(course(), {
      motivation: "work-study", minutesPerDay: 25, daysPerWeek: 3, placementMode: "skipped", occurredAt: "2026-08-23T08:00:00.000Z",
    });
    expect(updated.createdAt).toBe(first.createdAt);
    expect(updated.updatedAt).not.toBe(first.updatedAt);
    expect((await service.list())[0]?.motivation).toBe("work-study");
  });
});
