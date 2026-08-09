import { describe, expect, it } from "vitest";
import {
  LearningApplicationService,
  MemoryCourseRepository,
  MemoryEffectQueue,
  MemoryLearningUnitOfWork,
  MemorySessionEventRepository,
  type EffectQueue,
} from "@learn-language/application";
import { japaneseCafeCourse } from "../src/index.js";

function createApplication(effectQueue: EffectQueue = new MemoryEffectQueue()) {
  const courses = new MemoryCourseRepository([japaneseCafeCourse]);
  const sessions = new MemorySessionEventRepository();
  const transactionEffects = effectQueue instanceof MemoryEffectQueue ? effectQueue : new MemoryEffectQueue();
  const unitOfWork = new MemoryLearningUnitOfWork(sessions, transactionEffects);
  return {
    service: new LearningApplicationService(courses, sessions, effectQueue, unitOfWork),
    sessions,
    effects: effectQueue,
  };
}

describe("learning application vertical slice", () => {
  it("starts, advances, completes, and persists effects", async () => {
    const { service, effects } = createApplication();
    const lesson = japaneseCafeCourse.lessons[0]!;
    let transition = await service.startLesson({
      type: "lesson.start",
      sessionId: "application-session",
      learnerId: "local-anonymous",
      courseId: japaneseCafeCourse.manifest.id,
      lessonId: lesson.id,
      occurredAt: "2026-08-09T10:00:00.000Z",
    });

    let attempt = 0;
    while (transition.state.status === "active") {
      attempt += 1;
      const step = lesson.steps.find((item) => item.id === transition.state.currentStepId)!;
      transition = await service.submitExercise({
        type: "exercise.submit",
        sessionId: transition.state.sessionId,
        attemptId: `attempt-${attempt}`,
        expectedStepId: step.id,
        expectedSequence: transition.state.lastSequence,
        occurredAt: new Date(Date.parse("2026-08-09T10:00:00.000Z") + attempt * 60_000).toISOString(),
        decision: "advance",
        evaluationSource: "deterministic",
        supportLevelUsed: step.supportLevel ?? "none",
        promptLevel: 0,
        ...(step.next.length > 1 && step.next[0] ? { nextStepId: step.next[0] } : {}),
      });
    }

    const persisted = await service.loadSession("application-session");
    expect(persisted?.state.status).toBe("completed");
    expect(persisted?.events.at(-1)?.type).toBe("session.completed");
    expect((await effects.pending()).some((effect) => effect.type === "lesson-completion.recorded")).toBe(true);
  });

  it("rolls back event persistence when effect enqueue fails", async () => {
    const failingEffects: EffectQueue = {
      enqueue: async (items) => { if (items.length > 0) throw new Error("queue unavailable"); },
      pending: async () => [],
      markCompleted: async () => undefined,
    };
    const { service } = createApplication(failingEffects);
    const lesson = japaneseCafeCourse.lessons[0]!;
    const started = await service.startLesson({
      type: "lesson.start",
      sessionId: "rollback-session",
      learnerId: "local-anonymous",
      courseId: japaneseCafeCourse.manifest.id,
      lessonId: lesson.id,
      occurredAt: "2026-08-09T11:00:00.000Z",
    });
    await expect(service.submitExercise({
      type: "exercise.submit",
      sessionId: started.state.sessionId,
      attemptId: "attempt-fails",
      expectedStepId: started.state.currentStepId!,
      expectedSequence: started.state.lastSequence,
      occurredAt: "2026-08-09T11:01:00.000Z",
      decision: "advance",
      evaluationSource: "deterministic",
      supportLevelUsed: "none",
      promptLevel: 0,
    })).rejects.toThrow("queue unavailable");

    expect((await service.loadSession("rollback-session"))?.state.lastSequence).toBe(2);
  });

  it("deduplicates durable effects by deterministic effect id", async () => {
    const effects = new MemoryEffectQueue();
    const effect = {
      id: "session:4:projection",
      type: "learning-projection.refresh-requested" as const,
      sessionId: "session",
      courseId: "course",
      lessonId: "lesson",
      afterSequence: 4,
    };
    await effects.enqueue([effect], "2026-08-09T12:00:00.000Z");
    await effects.enqueue([effect], "2026-08-09T12:01:00.000Z");
    expect(await effects.pending()).toHaveLength(1);
  });
});
