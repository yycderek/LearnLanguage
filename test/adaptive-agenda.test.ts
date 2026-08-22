import { describe, expect, it } from "vitest";
import { buildAdaptiveLearningAgenda } from "../packages/application/src/adaptive-agenda.js";
import type { LearningPlan } from "../packages/application/src/learning-plan.js";

const plan: LearningPlan = {
  schemaVersion: 1,
  courseId: "course",
  courseVersion: "1.0.0",
  languageId: "en",
  motivation: "daily-life",
  minutesPerDay: 20,
  daysPerWeek: 5,
  weeklyTargetMinutes: 100,
  lessonTargetCount: 3,
  reviewTargetMinutes: 40,
  placement: {
    mode: "skipped",
    assessedLessonIds: [],
    placedOutLessonIds: [],
    correctCount: 0,
    total: 0,
    recommendedLessonId: "lesson-1",
    assessedAt: "2026-08-24T00:00:00.000Z",
  },
  startingLessonId: "lesson-1",
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
};

describe("adaptive daily learning agenda", () => {
  it("combines due reviews with an active lesson and counts the local week", () => {
    const agenda = buildAdaptiveLearningAgenda(plan, {
      lessonIds: ["lesson-1", "lesson-2", "lesson-3"],
      completedLessons: [
        { lessonId: "lesson-1", startedAt: "2026-08-24T01:00:00.000Z", completedAt: "2026-08-24T01:20:00.000Z" },
      ],
      activeLessonId: "lesson-2",
      dueReviewCount: 4,
      reviewEvents: [{ occurredAt: "2026-08-25T02:00:00.000Z" }],
    }, { occurredAt: "2026-08-26T04:00:00.000Z", timezoneOffsetMinutes: -480 });

    expect(agenda.weekStartAt).toBe("2026-08-23T16:00:00.000Z");
    expect(agenda.week).toMatchObject({ completedMinutes: 22, completedLessonCount: 1, completedReviewCount: 1, targetMinutes: 100 });
    expect(agenda.today).toMatchObject({ completedMinutes: 0, targetMinutes: 20, remainingMinutes: 20 });
    expect(agenda.items).toEqual([
      { kind: "review", taskCount: 4, estimatedMinutes: 8 },
      { kind: "continue-lesson", lessonId: "lesson-2", estimatedMinutes: 12 },
    ]);
  });

  it("stops adding new lessons after the weekly lesson target but keeps due review", () => {
    const completedLessons = ["lesson-1", "lesson-2", "lesson-3"].map((lessonId, index) => ({
      lessonId,
      startedAt: `2026-08-${24 + index}T01:00:00.000Z`,
      completedAt: `2026-08-${24 + index}T01:05:00.000Z`,
    }));
    const agenda = buildAdaptiveLearningAgenda(plan, {
      lessonIds: ["lesson-1", "lesson-2", "lesson-3", "lesson-4"],
      completedLessons,
      dueReviewCount: 1,
      reviewEvents: [],
    }, { occurredAt: "2026-08-26T04:00:00.000Z", timezoneOffsetMinutes: -480 });

    expect(agenda.status).toBe("target-met");
    expect(agenda.today.targetMinutes).toBe(0);
    expect(agenda.items).toEqual([{ kind: "review", taskCount: 1, estimatedMinutes: 2 }]);
  });

  it("reports course completion without manufacturing more work", () => {
    const agenda = buildAdaptiveLearningAgenda(plan, {
      lessonIds: ["lesson-1"],
      completedLessons: [{ lessonId: "lesson-1", completedAt: "2026-08-26T02:00:00.000Z" }],
      dueReviewCount: 0,
      reviewEvents: [],
    }, { occurredAt: "2026-08-26T04:00:00.000Z", timezoneOffsetMinutes: -480 });

    expect(agenda.status).toBe("course-complete");
    expect(agenda.items).toEqual([]);
  });
});
