import type {
  LessonFlow,
  RubricDimension,
  SupportLevel,
} from "./types.js";

export const SESSION_EVENT_SCHEMA_VERSION = 1 as const;

export type AttemptDecision = "advance" | "retry";
export type PromptLevel = 0 | 1 | 2 | 3;

interface SessionEventBase {
  readonly schemaVersion: typeof SESSION_EVENT_SCHEMA_VERSION;
  readonly id: string;
  readonly sessionId: string;
  readonly sequence: number;
  readonly occurredAt: string;
}

export interface SessionStartedEvent extends SessionEventBase {
  readonly type: "session.started";
  readonly learnerId: string;
  readonly courseId: string;
  readonly lessonId: string;
  readonly entryStepId: string;
}

export interface StepEnteredEvent extends SessionEventBase {
  readonly type: "step.entered";
  readonly stepId: string;
}

export interface AttemptRecordedEvent extends SessionEventBase {
  readonly type: "attempt.recorded";
  readonly attemptId: string;
  readonly stepId: string;
  readonly decision: AttemptDecision;
  readonly supportLevelUsed: SupportLevel;
  readonly promptLevel: PromptLevel;
  readonly latencyMs?: number;
  readonly scores?: Readonly<Partial<Record<RubricDimension, number>>>;
  readonly errorTags?: readonly string[];
}

export interface StepRetryRequiredEvent extends SessionEventBase {
  readonly type: "step.retry-required";
  readonly attemptId: string;
  readonly stepId: string;
}

export interface StepCompletedEvent extends SessionEventBase {
  readonly type: "step.completed";
  readonly attemptId: string;
  readonly stepId: string;
}

export interface SessionCompletedEvent extends SessionEventBase {
  readonly type: "session.completed";
  readonly finalStepId: string;
}

export type SessionEvent =
  | SessionStartedEvent
  | StepEnteredEvent
  | AttemptRecordedEvent
  | StepRetryRequiredEvent
  | StepCompletedEvent
  | SessionCompletedEvent;

export interface LearningSessionState {
  readonly sessionId: string;
  readonly learnerId: string;
  readonly courseId: string;
  readonly lessonId: string;
  readonly status: "active" | "completed";
  readonly currentStepId: string | null;
  readonly attemptCounts: Readonly<Record<string, number>>;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly lastSequence: number;
}

export interface SessionTransition {
  readonly state: LearningSessionState;
  readonly events: readonly SessionEvent[];
}

export interface StartSessionCommand {
  readonly sessionId: string;
  readonly learnerId: string;
  readonly courseId: string;
  readonly lessonId: string;
  readonly occurredAt: string;
}

export interface SubmitAttemptCommand {
  readonly attemptId: string;
  readonly expectedStepId: string;
  readonly expectedSequence: number;
  readonly occurredAt: string;
  readonly decision: AttemptDecision;
  readonly supportLevelUsed: SupportLevel;
  readonly promptLevel: PromptLevel;
  readonly latencyMs?: number;
  readonly scores?: Readonly<Partial<Record<RubricDimension, number>>>;
  readonly errorTags?: readonly string[];
  readonly nextStepId?: string;
}

export class SessionTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionTransitionError";
  }
}

function eventIdentity(
  sessionId: string,
  sequence: number,
  occurredAt: string,
): SessionEventBase {
  return {
    schemaVersion: SESSION_EVENT_SCHEMA_VERSION,
    id: `${sessionId}:${sequence}`,
    sessionId,
    sequence,
    occurredAt,
  };
}

function assertSequence(
  state: LearningSessionState | null,
  event: SessionEvent,
): void {
  const expectedSequence = (state?.lastSequence ?? 0) + 1;
  if (event.sequence !== expectedSequence) {
    throw new SessionTransitionError(
      `Expected event sequence ${expectedSequence}, received ${event.sequence}`,
    );
  }

  if (state && event.sessionId !== state.sessionId) {
    throw new SessionTransitionError(
      `Event belongs to session ${event.sessionId}, not ${state.sessionId}`,
    );
  }
}

export function applySessionEvent(
  state: LearningSessionState | null,
  event: SessionEvent,
): LearningSessionState {
  assertSequence(state, event);

  if (event.type === "session.started") {
    if (state) {
      throw new SessionTransitionError("A session can only be started once");
    }

    return {
      sessionId: event.sessionId,
      learnerId: event.learnerId,
      courseId: event.courseId,
      lessonId: event.lessonId,
      status: "active",
      currentStepId: null,
      attemptCounts: {},
      startedAt: event.occurredAt,
      completedAt: null,
      lastSequence: event.sequence,
    };
  }

  if (!state) {
    throw new SessionTransitionError("The first event must start the session");
  }

  if (state.status === "completed") {
    throw new SessionTransitionError("Completed sessions cannot accept events");
  }

  switch (event.type) {
    case "step.entered":
      return {
        ...state,
        currentStepId: event.stepId,
        lastSequence: event.sequence,
      };
    case "attempt.recorded": {
      if (event.stepId !== state.currentStepId) {
        throw new SessionTransitionError(
          `Attempt step ${event.stepId} does not match current step ${state.currentStepId}`,
        );
      }
      return {
        ...state,
        attemptCounts: {
          ...state.attemptCounts,
          [event.stepId]: (state.attemptCounts[event.stepId] ?? 0) + 1,
        },
        lastSequence: event.sequence,
      };
    }
    case "step.retry-required":
    case "step.completed": {
      if (event.stepId !== state.currentStepId) {
        throw new SessionTransitionError(
          `Step event ${event.stepId} does not match current step ${state.currentStepId}`,
        );
      }
      return { ...state, lastSequence: event.sequence };
    }
    case "session.completed": {
      if (event.finalStepId !== state.currentStepId) {
        throw new SessionTransitionError(
          `Final step ${event.finalStepId} does not match current step ${state.currentStepId}`,
        );
      }
      return {
        ...state,
        status: "completed",
        currentStepId: null,
        completedAt: event.occurredAt,
        lastSequence: event.sequence,
      };
    }
  }
}

export function replaySessionEvents(
  events: readonly SessionEvent[],
): LearningSessionState {
  if (events.length === 0) {
    throw new SessionTransitionError("Cannot replay an empty event stream");
  }

  let state: LearningSessionState | null = null;
  for (const event of events) {
    state = applySessionEvent(state, event);
  }

  if (!state) {
    throw new SessionTransitionError("Event stream did not produce a session");
  }

  return state;
}

export function startSession(
  lesson: LessonFlow,
  command: StartSessionCommand,
): SessionTransition {
  if (lesson.id !== command.lessonId) {
    throw new SessionTransitionError(
      `Lesson ${lesson.id} does not match command lesson ${command.lessonId}`,
    );
  }

  if (!lesson.steps.some((step) => step.id === lesson.entryStepId)) {
    throw new SessionTransitionError(
      `Lesson entry step does not exist: ${lesson.entryStepId}`,
    );
  }

  const started: SessionStartedEvent = {
    ...eventIdentity(command.sessionId, 1, command.occurredAt),
    type: "session.started",
    learnerId: command.learnerId,
    courseId: command.courseId,
    lessonId: command.lessonId,
    entryStepId: lesson.entryStepId,
  };
  const entered: StepEnteredEvent = {
    ...eventIdentity(command.sessionId, 2, command.occurredAt),
    type: "step.entered",
    stepId: lesson.entryStepId,
  };
  const events: readonly SessionEvent[] = [started, entered];

  return { state: replaySessionEvents(events), events };
}

function resolveNextStep(
  lesson: LessonFlow,
  currentStepId: string,
  requestedNextStepId: string | undefined,
): string | null {
  const currentStep = lesson.steps.find((step) => step.id === currentStepId);
  if (!currentStep) {
    throw new SessionTransitionError(`Unknown current step: ${currentStepId}`);
  }

  if (currentStep.next.length === 0) {
    if (requestedNextStepId) {
      throw new SessionTransitionError("Terminal steps cannot select a next step");
    }
    return null;
  }

  if (currentStep.next.length === 1) {
    const onlyNextStep = currentStep.next[0]!;
    if (requestedNextStepId && requestedNextStepId !== onlyNextStep) {
      throw new SessionTransitionError(
        `Invalid next step ${requestedNextStepId}; expected ${onlyNextStep}`,
      );
    }
    return onlyNextStep;
  }

  if (!requestedNextStepId) {
    throw new SessionTransitionError(
      `Step ${currentStepId} requires an explicit next step`,
    );
  }

  if (!currentStep.next.includes(requestedNextStepId)) {
    throw new SessionTransitionError(
      `Step ${requestedNextStepId} is not reachable from ${currentStepId}`,
    );
  }

  return requestedNextStepId;
}

function validateAttemptMetrics(command: SubmitAttemptCommand): void {
  if (
    command.latencyMs !== undefined &&
    (!Number.isFinite(command.latencyMs) || command.latencyMs < 0)
  ) {
    throw new SessionTransitionError("Attempt latency must be non-negative");
  }

  if (![0, 1, 2, 3].includes(command.promptLevel)) {
    throw new SessionTransitionError("Prompt level must be between 0 and 3");
  }

  for (const [dimension, score] of Object.entries(command.scores ?? {})) {
    if (score === undefined || !Number.isFinite(score) || score < 0 || score > 1) {
      throw new SessionTransitionError(
        `Score for ${dimension} must be between 0 and 1`,
      );
    }
  }
}

export function submitAttempt(
  lesson: LessonFlow,
  initialState: LearningSessionState,
  command: SubmitAttemptCommand,
): SessionTransition {
  if (initialState.status !== "active" || !initialState.currentStepId) {
    throw new SessionTransitionError("Session is not active");
  }

  if (initialState.lessonId !== lesson.id) {
    throw new SessionTransitionError(
      `Session lesson ${initialState.lessonId} does not match ${lesson.id}`,
    );
  }

  if (command.expectedSequence !== initialState.lastSequence) {
    throw new SessionTransitionError(
      `Stale command sequence ${command.expectedSequence}; current sequence is ${initialState.lastSequence}`,
    );
  }

  if (command.expectedStepId !== initialState.currentStepId) {
    throw new SessionTransitionError(
      `Stale command step ${command.expectedStepId}; current step is ${initialState.currentStepId}`,
    );
  }

  if (command.decision === "retry" && command.nextStepId) {
    throw new SessionTransitionError("Retry attempts cannot select a next step");
  }

  validateAttemptMetrics(command);

  let state = initialState;
  const events: SessionEvent[] = [];
  const append = (event: SessionEvent): void => {
    state = applySessionEvent(state, event);
    events.push(event);
  };
  const nextSequence = (): number => state.lastSequence + 1;

  const attempt: AttemptRecordedEvent = {
    ...eventIdentity(
      state.sessionId,
      nextSequence(),
      command.occurredAt,
    ),
    type: "attempt.recorded",
    attemptId: command.attemptId,
    stepId: command.expectedStepId,
    decision: command.decision,
    supportLevelUsed: command.supportLevelUsed,
    promptLevel: command.promptLevel,
    ...(command.latencyMs === undefined ? {} : { latencyMs: command.latencyMs }),
    ...(command.scores === undefined ? {} : { scores: command.scores }),
    ...(command.errorTags === undefined
      ? {}
      : { errorTags: command.errorTags }),
  };
  append(attempt);

  if (command.decision === "retry") {
    append({
      ...eventIdentity(state.sessionId, nextSequence(), command.occurredAt),
      type: "step.retry-required",
      attemptId: command.attemptId,
      stepId: command.expectedStepId,
    });
    return { state, events };
  }

  const nextStepId = resolveNextStep(
    lesson,
    command.expectedStepId,
    command.nextStepId,
  );
  append({
    ...eventIdentity(state.sessionId, nextSequence(), command.occurredAt),
    type: "step.completed",
    attemptId: command.attemptId,
    stepId: command.expectedStepId,
  });

  if (nextStepId) {
    append({
      ...eventIdentity(state.sessionId, nextSequence(), command.occurredAt),
      type: "step.entered",
      stepId: nextStepId,
    });
  } else {
    append({
      ...eventIdentity(state.sessionId, nextSequence(), command.occurredAt),
      type: "session.completed",
      finalStepId: command.expectedStepId,
    });
  }

  return { state, events };
}
