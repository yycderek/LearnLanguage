import { describe, expect, it } from "vitest";
import {
  SessionTransitionError,
  replaySessionEvents,
  startSession,
  submitAttempt,
  type LessonFlow,
  type SubmitAttemptCommand,
} from "../src/index.js";

const lesson: LessonFlow = {
  id: "test-lesson",
  title: { en: "Test lesson" },
  canDoGoalRefs: [],
  entryStepId: "input",
  steps: [
    {
      id: "input",
      phase: "supported-input",
      title: { en: "Input" },
      knowledgeRefs: [],
      utteranceRefs: [],
      exerciseRefs: [],
      next: ["task"],
    },
    {
      id: "task",
      phase: "independent-task",
      title: { en: "Task" },
      knowledgeRefs: [],
      utteranceRefs: [],
      exerciseRefs: [],
      next: [],
    },
  ],
};

function start() {
  return startSession(lesson, {
    sessionId: "session-1",
    learnerId: "learner-1",
    courseId: "course-1",
    lessonId: lesson.id,
    occurredAt: "2026-08-03T15:00:00.000Z",
  });
}

function command(
  overrides: Partial<SubmitAttemptCommand> = {},
): SubmitAttemptCommand {
  return {
    attemptId: "attempt-1",
    expectedStepId: "input",
    expectedSequence: 2,
    occurredAt: "2026-08-03T15:01:00.000Z",
    decision: "advance",
    supportLevelUsed: "full",
    promptLevel: 0,
    ...overrides,
  };
}

describe("lesson session state machine", () => {
  it("starts at the declared entry step", () => {
    const transition = start();

    expect(transition.state).toEqual(
      expect.objectContaining({
        status: "active",
        currentStepId: "input",
        lastSequence: 2,
      }),
    );
    expect(transition.events.map((event) => event.type)).toEqual([
      "session.started",
      "step.entered",
    ]);
  });

  it("records retries without advancing the step", () => {
    const started = start();
    const transition = submitAttempt(
      lesson,
      started.state,
      command({
        decision: "retry",
        promptLevel: 2,
        errorTags: ["missing-target-pattern"],
      }),
    );

    expect(transition.state.currentStepId).toBe("input");
    expect(transition.state.attemptCounts.input).toBe(1);
    expect(transition.events.map((event) => event.type)).toEqual([
      "attempt.recorded",
      "step.retry-required",
    ]);
    expect(transition.effects.map((effect) => effect.type)).toEqual([
      "learning-projection.refresh-requested",
    ]);
  });

  it("advances and completes terminal steps", () => {
    const started = start();
    const advanced = submitAttempt(lesson, started.state, command());
    const completed = submitAttempt(
      lesson,
      advanced.state,
      command({
        attemptId: "attempt-2",
        expectedStepId: "task",
        expectedSequence: advanced.state.lastSequence,
        occurredAt: "2026-08-03T15:02:00.000Z",
        supportLevelUsed: "none",
        scores: {
          "task-completion": 1,
          comprehensibility: 0.9,
        },
      }),
    );

    expect(advanced.state.currentStepId).toBe("task");
    expect(completed.state.status).toBe("completed");
    expect(completed.state.currentStepId).toBeNull();
    expect(completed.events.at(-1)?.type).toBe("session.completed");
    expect(completed.effects.map((effect) => effect.type)).toEqual([
      "learning-projection.refresh-requested",
      "lesson-completion.recorded",
    ]);
  });

  it("rebuilds the same state by replaying persisted events", () => {
    const started = start();
    const advanced = submitAttempt(lesson, started.state, command());
    const allEvents = [...started.events, ...advanced.events];

    expect(replaySessionEvents(allEvents)).toEqual(advanced.state);
  });

  it("rejects stale client commands", () => {
    const started = start();

    expect(() =>
      submitAttempt(
        lesson,
        started.state,
        command({ expectedSequence: 1 }),
      ),
    ).toThrow(SessionTransitionError);
  });

  it("rejects invalid runtime learning metrics", () => {
    const started = start();

    expect(() =>
      submitAttempt(
        lesson,
        started.state,
        command({ scores: { comprehensibility: 1.5 } }),
      ),
    ).toThrow("must be between 0 and 1");
  });

  it("requires a valid choice when a step has multiple branches", () => {
    const branchingLesson: LessonFlow = {
      ...lesson,
      steps: [
        { ...lesson.steps[0]!, next: ["task", "help"] },
        lesson.steps[1]!,
        {
          id: "help",
          phase: "preteach",
          title: { en: "Help" },
          knowledgeRefs: [],
          utteranceRefs: [],
          exerciseRefs: [],
          next: ["task"],
        },
      ],
    };
    const started = startSession(branchingLesson, {
      sessionId: "session-2",
      learnerId: "learner-1",
      courseId: "course-1",
      lessonId: branchingLesson.id,
      occurredAt: "2026-08-03T15:00:00.000Z",
    });

    expect(() =>
      submitAttempt(branchingLesson, started.state, command()),
    ).toThrow("requires an explicit next step");

    const transition = submitAttempt(
      branchingLesson,
      started.state,
      command({ nextStepId: "help" }),
    );
    expect(transition.state.currentStepId).toBe("help");
  });
});
