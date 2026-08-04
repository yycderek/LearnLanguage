import { describe, expect, it } from "vitest";
import {
  japaneseCafeCourse,
  projectKnowledgeMastery,
  scheduleReviews,
  startSession,
  submitAttempt,
  type SessionEvent,
} from "../src/index.js";

const lesson = japaneseCafeCourse.lessons[0]!;

function completeLesson(): readonly SessionEvent[] {
  const started = startSession(lesson, {
    sessionId: "mastery-session",
    learnerId: "learner-1",
    courseId: japaneseCafeCourse.manifest.id,
    lessonId: lesson.id,
    occurredAt: "2026-08-04T09:00:00.000Z",
  });
  const events: SessionEvent[] = [...started.events];
  let state = started.state;
  let attemptNumber = 1;

  while (state.status === "active") {
    const step = lesson.steps.find((candidate) => candidate.id === state.currentStepId)!;
    const transition = submitAttempt(lesson, state, {
      attemptId: `attempt-${attemptNumber}`,
      expectedStepId: step.id,
      expectedSequence: state.lastSequence,
      occurredAt: new Date(
        Date.parse("2026-08-04T09:00:00.000Z") + attemptNumber * 60_000,
      ).toISOString(),
      decision: "advance",
      supportLevelUsed: step.supportLevel ?? "none",
      promptLevel: step.phase === "guided-output" ? 1 : 0,
    });
    events.push(...transition.events);
    state = transition.state;
    attemptNumber += 1;
  }

  return events;
}

describe("mastery projection and review scheduling", () => {
  it("promotes knowledge only when stronger evidence is observed", () => {
    const mastery = projectKnowledgeMastery(
      japaneseCafeCourse,
      lesson,
      completeLesson(),
    );

    expect(mastery).toHaveLength(2);
    expect(mastery).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          knowledgeItemId: "coffee",
          level: "delayed-transfer",
          evidenceCount: 9,
        }),
        expect.objectContaining({
          knowledgeItemId: "request-pattern",
          level: "delayed-transfer",
          evidenceCount: 9,
        }),
      ]),
    );
  });

  it("schedules stable knowledge for later fluency review", () => {
    const mastery = projectKnowledgeMastery(
      japaneseCafeCourse,
      lesson,
      completeLesson(),
    );
    const reviews = scheduleReviews(mastery);

    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toEqual(
      expect.objectContaining({
        mode: "fluency",
        basedOnLevel: "delayed-transfer",
        dueAt: "2026-08-18T09:09:00.000Z",
      }),
    );
  });
});
