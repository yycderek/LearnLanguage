import {
  replaySessionEvents,
  startSession,
  submitAttempt,
  type LearningEffect,
  type SessionEvent,
  type SessionTransition,
  type StartLessonCommand,
  type SubmitExerciseCommand,
} from "@learn-language/engine";
import type { CoursePack } from "@learn-language/protocol";

export * from "./exercise-response.js";
export * from "./authoring.js";
export * from "./trust.js";
export * from "./workspace.js";
export * from "./learning-plan.js";
export * from "./adaptive-agenda.js";
export * from "./product-closure.js";

export interface CourseRepository {
  get(courseId: string): Promise<CoursePack | undefined>;
}

export interface SessionEventRepository {
  load(sessionId: string): Promise<readonly SessionEvent[]>;
  append(sessionId: string, expectedLastSequence: number, events: readonly SessionEvent[]): Promise<void>;
}

export type PersistedEffect = LearningEffect & {
  readonly status: "pending" | "completed";
  readonly attempts: number;
  readonly createdAt: string;
};

export interface EffectQueue {
  enqueue(effects: readonly LearningEffect[], createdAt: string): Promise<void>;
  pending(): Promise<readonly PersistedEffect[]>;
  markCompleted(effectId: string): Promise<void>;
}

export interface LearningUnitOfWork {
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

export class CourseNotFoundError extends Error {
  readonly courseId: string;
  constructor(courseId: string) {
    super(`Course not found: ${courseId}`);
    this.courseId = courseId;
    this.name = "CourseNotFoundError";
  }
}

export class SessionNotFoundError extends Error {
  readonly sessionId: string;
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.sessionId = sessionId;
    this.name = "SessionNotFoundError";
  }
}

export class RepositoryConcurrencyError extends Error {
  readonly sessionId: string;
  readonly expectedSequence: number;
  readonly actualSequence: number;
  constructor(
    sessionId: string,
    expectedSequence: number,
    actualSequence: number,
  ) {
    super(`Session ${sessionId} expected sequence ${expectedSequence}, actual sequence is ${actualSequence}`);
    this.sessionId = sessionId;
    this.expectedSequence = expectedSequence;
    this.actualSequence = actualSequence;
    this.name = "RepositoryConcurrencyError";
  }
}

export class LearningApplicationService {
  private readonly courses: CourseRepository;
  private readonly sessions: SessionEventRepository;
  private readonly effects: EffectQueue;
  private readonly unitOfWork: LearningUnitOfWork;
  constructor(
    courses: CourseRepository,
    sessions: SessionEventRepository,
    effects: EffectQueue,
    unitOfWork: LearningUnitOfWork,
  ) {
    this.courses = courses;
    this.sessions = sessions;
    this.effects = effects;
    this.unitOfWork = unitOfWork;
  }

  async startLesson(command: StartLessonCommand): Promise<SessionTransition> {
    const course = await this.requireCourse(command.courseId);
    const lesson = course.lessons.find((item) => item.id === command.lessonId);
    if (!lesson) throw new Error(`Lesson not found: ${command.lessonId}`);
    const transition = startSession(lesson, command);
    await this.unitOfWork.transaction(async () => {
      await this.sessions.append(command.sessionId, 0, transition.events);
      await this.effects.enqueue(transition.effects, command.occurredAt);
    });
    return transition;
  }

  async submitExercise(command: SubmitExerciseCommand): Promise<SessionTransition> {
    const persisted = await this.sessions.load(command.sessionId);
    if (persisted.length === 0) throw new SessionNotFoundError(command.sessionId);
    const state = replaySessionEvents(persisted);
    const course = await this.requireCourse(state.courseId);
    const lesson = course.lessons.find((item) => item.id === state.lessonId);
    if (!lesson) throw new Error(`Lesson not found: ${state.lessonId}`);
    const transition = submitAttempt(lesson, state, command);
    await this.unitOfWork.transaction(async () => {
      await this.sessions.append(command.sessionId, state.lastSequence, transition.events);
      await this.effects.enqueue(transition.effects, command.occurredAt);
    });
    return transition;
  }

  async loadSession(sessionId: string) {
    const events = await this.sessions.load(sessionId);
    return events.length === 0 ? undefined : { state: replaySessionEvents(events), events };
  }

  private async requireCourse(courseId: string): Promise<CoursePack> {
    const course = await this.courses.get(courseId);
    if (!course) throw new CourseNotFoundError(courseId);
    return course;
  }
}

export class MemoryCourseRepository implements CourseRepository {
  readonly #courses = new Map<string, CoursePack>();

  constructor(courses: readonly CoursePack[] = []) {
    for (const course of courses) this.#courses.set(course.manifest.id, course);
  }

  async get(courseId: string): Promise<CoursePack | undefined> {
    return this.#courses.get(courseId);
  }

  put(course: CoursePack): void {
    this.#courses.set(course.manifest.id, course);
  }
}

export class MemorySessionEventRepository implements SessionEventRepository {
  #streams = new Map<string, SessionEvent[]>();

  async load(sessionId: string): Promise<readonly SessionEvent[]> {
    return [...(this.#streams.get(sessionId) ?? [])];
  }

  async append(sessionId: string, expectedLastSequence: number, events: readonly SessionEvent[]): Promise<void> {
    const current = this.#streams.get(sessionId) ?? [];
    const actual = current.at(-1)?.sequence ?? 0;
    if (actual !== expectedLastSequence) {
      throw new RepositoryConcurrencyError(sessionId, expectedLastSequence, actual);
    }
    let expected = expectedLastSequence + 1;
    for (const event of events) {
      if (event.sessionId !== sessionId || event.sequence !== expected) {
        throw new Error(`Invalid event batch at sequence ${expected}`);
      }
      expected += 1;
    }
    this.#streams.set(sessionId, [...current, ...events]);
  }

  snapshot(): Map<string, SessionEvent[]> {
    return new Map([...this.#streams].map(([id, events]) => [id, [...events]]));
  }

  restore(snapshot: Map<string, SessionEvent[]>): void {
    this.#streams = new Map([...snapshot].map(([id, events]) => [id, [...events]]));
  }
}

export class MemoryEffectQueue implements EffectQueue {
  #effects = new Map<string, PersistedEffect>();

  async enqueue(effects: readonly LearningEffect[], createdAt: string): Promise<void> {
    for (const effect of effects) {
      if (!this.#effects.has(effect.id)) {
        this.#effects.set(effect.id, { ...effect, status: "pending", attempts: 0, createdAt });
      }
    }
  }

  async pending(): Promise<readonly PersistedEffect[]> {
    return [...this.#effects.values()].filter((effect) => effect.status === "pending");
  }

  async markCompleted(effectId: string): Promise<void> {
    const effect = this.#effects.get(effectId);
    if (!effect) throw new Error(`Effect not found: ${effectId}`);
    this.#effects.set(effectId, { ...effect, status: "completed", attempts: effect.attempts + 1 });
  }

  snapshot(): Map<string, PersistedEffect> {
    return new Map(this.#effects);
  }

  restore(snapshot: Map<string, PersistedEffect>): void {
    this.#effects = new Map(snapshot);
  }
}

export class MemoryLearningUnitOfWork implements LearningUnitOfWork {
  private readonly sessions: MemorySessionEventRepository;
  private readonly effects: MemoryEffectQueue;
  constructor(
    sessions: MemorySessionEventRepository,
    effects: MemoryEffectQueue,
  ) {
    this.sessions = sessions;
    this.effects = effects;
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    const sessionSnapshot = this.sessions.snapshot();
    const effectSnapshot = this.effects.snapshot();
    try {
      return await work();
    } catch (error) {
      this.sessions.restore(sessionSnapshot);
      this.effects.restore(effectSnapshot);
      throw error;
    }
  }
}
