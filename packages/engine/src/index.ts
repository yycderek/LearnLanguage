import type {
  CoursePack,
  EvaluationSource,
  LessonFlow,
  LessonPhase,
  RubricDimension,
  SupportLevel,
} from "@learn-language/protocol";

export const SESSION_EVENT_SCHEMA_VERSION = 2 as const;
export const ENGINE_VERSION = "0.1.0" as const;

export type AttemptDecision = "advance" | "retry";
export type PromptLevel = 0 | 1 | 2 | 3;
export type MasteryLevel =
  | "encountered"
  | "comprehended"
  | "prompted-output"
  | "independent-output"
  | "delayed-transfer";

interface SessionEventBase {
  readonly schemaVersion: typeof SESSION_EVENT_SCHEMA_VERSION;
  readonly engineVersion: typeof ENGINE_VERSION;
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
  readonly evaluationSource: EvaluationSource;
  readonly evidenceEligible: boolean;
  readonly supportLevelUsed: SupportLevel;
  readonly promptLevel: PromptLevel;
  readonly answer?: string;
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

export interface RefreshLearningProjectionEffect {
  readonly id: string;
  readonly type: "learning-projection.refresh-requested";
  readonly sessionId: string;
  readonly courseId: string;
  readonly lessonId: string;
  readonly afterSequence: number;
}

export interface LessonCompletedEffect {
  readonly id: string;
  readonly type: "lesson-completion.recorded";
  readonly sessionId: string;
  readonly courseId: string;
  readonly lessonId: string;
  readonly afterSequence: number;
}

export interface AiFeedbackRequestedEffect {
  readonly id: string;
  readonly type: "ai-feedback.requested";
  readonly requestId: string;
  readonly sessionId: string;
  readonly courseId: string;
  readonly lessonId: string;
  readonly stepId: string;
  readonly afterSequence: number;
}

export type AiTutorIntent = "explain" | "hint" | "example" | "question";

export interface AiTutorRequestedEffect {
  readonly id: string;
  readonly type: "ai-tutor.requested";
  readonly requestId: string;
  readonly intent: AiTutorIntent;
  readonly sessionId: string;
  readonly courseId: string;
  readonly lessonId: string;
  readonly stepId: string;
  readonly afterSequence: number;
}

export type LearningEffect =
  | RefreshLearningProjectionEffect
  | LessonCompletedEffect
  | AiFeedbackRequestedEffect
  | AiTutorRequestedEffect;

export interface SessionTransition {
  readonly state: LearningSessionState;
  readonly events: readonly SessionEvent[];
  readonly effects: readonly LearningEffect[];
}

export interface StartLessonCommand {
  readonly type: "lesson.start";
  readonly sessionId: string;
  readonly learnerId: string;
  readonly courseId: string;
  readonly lessonId: string;
  readonly occurredAt: string;
}

export type StartSessionCommand = Omit<StartLessonCommand, "type"> & {
  readonly type?: "lesson.start";
};

export interface SubmitExerciseCommand {
  readonly type: "exercise.submit";
  readonly sessionId: string;
  readonly attemptId: string;
  readonly expectedStepId: string;
  readonly expectedSequence: number;
  readonly occurredAt: string;
  readonly decision: AttemptDecision;
  readonly evaluationSource: EvaluationSource;
  readonly evidenceEligible?: boolean;
  readonly supportLevelUsed: SupportLevel;
  readonly promptLevel: PromptLevel;
  readonly answer?: string;
  readonly latencyMs?: number;
  readonly scores?: Readonly<Partial<Record<RubricDimension, number>>>;
  readonly errorTags?: readonly string[];
  readonly nextStepId?: string;
}

export type SubmitAttemptCommand = Omit<
  SubmitExerciseCommand,
  "type" | "sessionId" | "evaluationSource"
> & {
  readonly type?: "exercise.submit";
  readonly sessionId?: string;
  readonly evaluationSource?: EvaluationSource;
};

export type LearningCommand = StartLessonCommand | SubmitExerciseCommand;

export function createAiFeedbackEffect(input: {
  requestId: string;
  sessionId: string;
  courseId: string;
  lessonId: string;
  stepId: string;
  afterSequence: number;
}): AiFeedbackRequestedEffect {
  return {
    id: `${input.sessionId}:${input.afterSequence}:ai:${input.requestId}`,
    type: "ai-feedback.requested",
    ...input,
  };
}

export function createAiTutorEffect(input: {
  requestId: string;
  intent: AiTutorIntent;
  sessionId: string;
  courseId: string;
  lessonId: string;
  stepId: string;
  afterSequence: number;
}): AiTutorRequestedEffect {
  return {
    id: `${input.sessionId}:${input.afterSequence}:tutor:${input.requestId}`,
    type: "ai-tutor.requested",
    ...input,
  };
}

export class SessionTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionTransitionError";
  }
}

function eventIdentity(sessionId: string, sequence: number, occurredAt: string) {
  return {
    schemaVersion: SESSION_EVENT_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    id: `${sessionId}:${sequence}`,
    sessionId,
    sequence,
    occurredAt,
  } as const;
}

function assertSequence(state: LearningSessionState | null, event: SessionEvent): void {
  const expected = (state?.lastSequence ?? 0) + 1;
  if (event.sequence !== expected) {
    throw new SessionTransitionError(`Expected event sequence ${expected}, received ${event.sequence}`);
  }
  if (state && event.sessionId !== state.sessionId) {
    throw new SessionTransitionError(`Event belongs to session ${event.sessionId}, not ${state.sessionId}`);
  }
}

export function applySessionEvent(state: LearningSessionState | null, event: SessionEvent): LearningSessionState {
  assertSequence(state, event);
  if (event.type === "session.started") {
    if (state) throw new SessionTransitionError("A session can only be started once");
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
  if (!state) throw new SessionTransitionError("The first event must start the session");
  if (state.status === "completed") throw new SessionTransitionError("Completed sessions cannot accept events");

  switch (event.type) {
    case "step.entered":
      return { ...state, currentStepId: event.stepId, lastSequence: event.sequence };
    case "attempt.recorded":
      if (event.stepId !== state.currentStepId) {
        throw new SessionTransitionError(`Attempt step ${event.stepId} does not match current step ${state.currentStepId}`);
      }
      return {
        ...state,
        attemptCounts: {
          ...state.attemptCounts,
          [event.stepId]: (state.attemptCounts[event.stepId] ?? 0) + 1,
        },
        lastSequence: event.sequence,
      };
    case "step.retry-required":
    case "step.completed":
      if (event.stepId !== state.currentStepId) {
        throw new SessionTransitionError(`Step event ${event.stepId} does not match current step ${state.currentStepId}`);
      }
      return { ...state, lastSequence: event.sequence };
    case "session.completed":
      if (event.finalStepId !== state.currentStepId) {
        throw new SessionTransitionError(`Final step ${event.finalStepId} does not match current step ${state.currentStepId}`);
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

export function replaySessionEvents(events: readonly SessionEvent[]): LearningSessionState {
  if (events.length === 0) throw new SessionTransitionError("Cannot replay an empty event stream");
  let state: LearningSessionState | null = null;
  for (const event of events) state = applySessionEvent(state, event);
  if (!state) throw new SessionTransitionError("Event stream did not produce a session");
  return state;
}

export function startSession(lesson: LessonFlow, command: StartSessionCommand): SessionTransition {
  if (lesson.id !== command.lessonId) {
    throw new SessionTransitionError(`Lesson ${lesson.id} does not match command lesson ${command.lessonId}`);
  }
  if (!lesson.steps.some((step) => step.id === lesson.entryStepId)) {
    throw new SessionTransitionError(`Lesson entry step does not exist: ${lesson.entryStepId}`);
  }
  const events: readonly SessionEvent[] = [
    {
      ...eventIdentity(command.sessionId, 1, command.occurredAt),
      type: "session.started",
      learnerId: command.learnerId,
      courseId: command.courseId,
      lessonId: command.lessonId,
      entryStepId: lesson.entryStepId,
    },
    {
      ...eventIdentity(command.sessionId, 2, command.occurredAt),
      type: "step.entered",
      stepId: lesson.entryStepId,
    },
  ];
  return { state: replaySessionEvents(events), events, effects: [] };
}

function resolveNextStep(lesson: LessonFlow, currentStepId: string, requested?: string): string | null {
  const current = lesson.steps.find((step) => step.id === currentStepId);
  if (!current) throw new SessionTransitionError(`Unknown current step: ${currentStepId}`);
  if (current.next.length === 0) {
    if (requested) throw new SessionTransitionError("Terminal steps cannot select a next step");
    return null;
  }
  if (current.next.length === 1) {
    const only = current.next[0]!;
    if (requested && requested !== only) {
      throw new SessionTransitionError(`Invalid next step ${requested}; expected ${only}`);
    }
    return only;
  }
  if (!requested) throw new SessionTransitionError(`Step ${currentStepId} requires an explicit next step`);
  if (!current.next.includes(requested)) {
    throw new SessionTransitionError(`Step ${requested} is not reachable from ${currentStepId}`);
  }
  return requested;
}

function validateAttempt(command: SubmitAttemptCommand): void {
  if (command.latencyMs !== undefined && (!Number.isFinite(command.latencyMs) || command.latencyMs < 0)) {
    throw new SessionTransitionError("Attempt latency must be non-negative");
  }
  if (![0, 1, 2, 3].includes(command.promptLevel)) {
    throw new SessionTransitionError("Prompt level must be between 0 and 3");
  }
  for (const [dimension, score] of Object.entries(command.scores ?? {})) {
    if (score === undefined || !Number.isFinite(score) || score < 0 || score > 1) {
      throw new SessionTransitionError(`Score for ${dimension} must be between 0 and 1`);
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
  if (command.sessionId && command.sessionId !== initialState.sessionId) {
    throw new SessionTransitionError(`Command session ${command.sessionId} does not match ${initialState.sessionId}`);
  }
  if (initialState.lessonId !== lesson.id) {
    throw new SessionTransitionError(`Session lesson ${initialState.lessonId} does not match ${lesson.id}`);
  }
  if (command.expectedSequence !== initialState.lastSequence) {
    throw new SessionTransitionError(`Stale command sequence ${command.expectedSequence}; current sequence is ${initialState.lastSequence}`);
  }
  if (command.expectedStepId !== initialState.currentStepId) {
    throw new SessionTransitionError(`Stale command step ${command.expectedStepId}; current step is ${initialState.currentStepId}`);
  }
  if (command.decision === "retry" && command.nextStepId) {
    throw new SessionTransitionError("Retry attempts cannot select a next step");
  }
  validateAttempt(command);

  let state = initialState;
  const events: SessionEvent[] = [];
  const append = (event: SessionEvent) => {
    state = applySessionEvent(state, event);
    events.push(event);
  };
  const nextSequence = () => state.lastSequence + 1;
  const evaluationSource = command.evaluationSource ?? "deterministic";

  append({
    ...eventIdentity(state.sessionId, nextSequence(), command.occurredAt),
    type: "attempt.recorded",
    attemptId: command.attemptId,
    stepId: command.expectedStepId,
    decision: command.decision,
    evaluationSource,
    evidenceEligible: command.evidenceEligible ?? true,
    supportLevelUsed: command.supportLevelUsed,
    promptLevel: command.promptLevel,
    ...(command.answer === undefined ? {} : { answer: command.answer }),
    ...(command.latencyMs === undefined ? {} : { latencyMs: command.latencyMs }),
    ...(command.scores === undefined ? {} : { scores: command.scores }),
    ...(command.errorTags === undefined ? {} : { errorTags: command.errorTags }),
  });

  if (command.decision === "retry") {
    append({
      ...eventIdentity(state.sessionId, nextSequence(), command.occurredAt),
      type: "step.retry-required",
      attemptId: command.attemptId,
      stepId: command.expectedStepId,
    });
  } else {
    const nextStepId = resolveNextStep(lesson, command.expectedStepId, command.nextStepId);
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
  }

  const effects: LearningEffect[] = [
    {
      id: `${state.sessionId}:${state.lastSequence}:projection`,
      type: "learning-projection.refresh-requested",
      sessionId: state.sessionId,
      courseId: state.courseId,
      lessonId: state.lessonId,
      afterSequence: state.lastSequence,
    },
  ];
  if (state.status === "completed") {
    effects.push({
      id: `${state.sessionId}:${state.lastSequence}:completion`,
      type: "lesson-completion.recorded",
      sessionId: state.sessionId,
      courseId: state.courseId,
      lessonId: state.lessonId,
      afterSequence: state.lastSequence,
    });
  }
  return { state, events, effects };
}

export interface LearnerKnowledgeState {
  readonly learnerId: string;
  readonly languageId: string;
  readonly knowledgeItemId: string;
  readonly level: MasteryLevel;
  readonly evidenceCount: number;
  readonly lastAttemptAt: string;
}

const masteryRank: Readonly<Record<MasteryLevel, number>> = {
  encountered: 0,
  comprehended: 1,
  "prompted-output": 2,
  "independent-output": 3,
  "delayed-transfer": 4,
};

function levelForAttempt(phase: LessonPhase, attempt: AttemptRecordedEvent): MasteryLevel {
  if (attempt.decision === "retry") return "encountered";
  if (phase === "diagnostic") return "comprehended";
  if (phase === "supported-input" || phase === "comprehension") return "comprehended";
  if (phase === "guided-output") return "prompted-output";
  if (attempt.evaluationSource === "self") return "prompted-output";
  if (phase === "independent-task" || phase === "feedback-retry") {
    return attempt.promptLevel === 0 && attempt.supportLevelUsed === "none" ? "independent-output" : "prompted-output";
  }
  if (phase === "delayed-transfer") {
    return attempt.promptLevel === 0 && attempt.supportLevelUsed === "none" ? "delayed-transfer" : "prompted-output";
  }
  return "encountered";
}

export function projectKnowledgeMastery(
  course: CoursePack,
  lesson: LessonFlow,
  events: readonly SessionEvent[],
): readonly LearnerKnowledgeState[] {
  const session = replaySessionEvents(events);
  if (session.courseId !== course.manifest.id || session.lessonId !== lesson.id) {
    throw new Error("Session does not match the supplied course and lesson");
  }
  const steps = new Map(lesson.steps.map((step) => [step.id, step]));
  const projected = new Map<string, LearnerKnowledgeState>();
  for (const event of events) {
    if (event.type !== "attempt.recorded") continue;
    if (!event.evidenceEligible) continue;
    const step = steps.get(event.stepId);
    if (!step) throw new Error(`Unknown lesson step in event stream: ${event.stepId}`);
    const candidate = levelForAttempt(step.phase, event);
    for (const knowledgeItemId of step.knowledgeRefs) {
      const current = projected.get(knowledgeItemId);
      projected.set(knowledgeItemId, {
        learnerId: session.learnerId,
        languageId: course.manifest.languageId,
        knowledgeItemId,
        level: current && masteryRank[current.level] >= masteryRank[candidate] ? current.level : candidate,
        evidenceCount: (current?.evidenceCount ?? 0) + 1,
        lastAttemptAt: event.occurredAt,
      });
    }
  }
  return [...projected.values()].sort((a, b) => a.knowledgeItemId.localeCompare(b.knowledgeItemId));
}

export type ReviewMode = "recognition" | "active-recall" | "scenario" | "transfer" | "fluency";
export interface ReviewRule { readonly delayMs: number; readonly mode: ReviewMode }
export type ReviewPolicy = Readonly<Record<MasteryLevel, ReviewRule>>;
export interface ScheduledReview {
  readonly id: string;
  readonly learnerId: string;
  readonly languageId: string;
  readonly knowledgeItemId: string;
  readonly mode: ReviewMode;
  readonly dueAt: string;
  readonly basedOnLevel: MasteryLevel;
}

const hour = 60 * 60 * 1000;
const day = 24 * hour;
export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
  encountered: { delayMs: 4 * hour, mode: "recognition" },
  comprehended: { delayMs: day, mode: "active-recall" },
  "prompted-output": { delayMs: day, mode: "scenario" },
  "independent-output": { delayMs: 3 * day, mode: "transfer" },
  "delayed-transfer": { delayMs: 14 * day, mode: "fluency" },
};

export function scheduleReviews(
  states: readonly LearnerKnowledgeState[],
  policy: ReviewPolicy = DEFAULT_REVIEW_POLICY,
): readonly ScheduledReview[] {
  return states.map((state) => {
    const timestamp = Date.parse(state.lastAttemptAt);
    if (!Number.isFinite(timestamp)) throw new Error(`Invalid last attempt date for ${state.knowledgeItemId}`);
    const rule = policy[state.level];
    const dueAt = new Date(timestamp + rule.delayMs).toISOString();
    return {
      id: [state.learnerId, state.languageId, state.knowledgeItemId, rule.mode, dueAt].join(":"),
      learnerId: state.learnerId,
      languageId: state.languageId,
      knowledgeItemId: state.knowledgeItemId,
      mode: rule.mode,
      dueAt,
      basedOnLevel: state.level,
    };
  }).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
