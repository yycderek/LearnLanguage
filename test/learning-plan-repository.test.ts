import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MemoryLearningPlanRepository,
  type LearningPlan,
  type LearningPlanRepository,
} from "@learn-language/application";
import { SqliteLearningPlanRepository } from "../src/index.js";

const plan: LearningPlan = {
  schemaVersion: 1,
  courseId: "course.en.beginner",
  courseVersion: "1.0.0",
  languageId: "en",
  motivation: "daily-life",
  minutesPerDay: 15,
  daysPerWeek: 5,
  weeklyTargetMinutes: 75,
  lessonTargetCount: 2,
  reviewTargetMinutes: 35,
  placement: {
    mode: "skipped",
    assessedLessonIds: [],
    placedOutLessonIds: [],
    correctCount: 0,
    total: 0,
    recommendedLessonId: "lesson-1",
    assessedAt: "2026-08-22T08:00:00.000Z",
  },
  startingLessonId: "lesson-1",
  createdAt: "2026-08-22T08:00:00.000Z",
  updatedAt: "2026-08-22T08:00:00.000Z",
};

async function verify(repository: LearningPlanRepository) {
  expect(await repository.list()).toEqual([]);
  await repository.put(plan);
  expect(await repository.get(plan.courseId)).toEqual(plan);
  expect(await repository.list()).toEqual([plan]);
}

describe("learning plan repository contracts", () => {
  it("keeps the in-memory adapter conformant", async () => {
    await verify(new MemoryLearningPlanRepository());
  });

  it("persists a plan across SQLite reopen", async () => {
    const directory = mkdtempSync(join(tmpdir(), "learn-language-plan-"));
    const filename = join(directory, "workspace.sqlite");
    try {
      const repository = new SqliteLearningPlanRepository(filename);
      await verify(repository);
      repository.close();

      const reopened = new SqliteLearningPlanRepository(filename);
      expect(await reopened.get(plan.courseId)).toEqual(plan);
      reopened.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
