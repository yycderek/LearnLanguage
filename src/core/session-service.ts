import type { SessionEventStore } from "./event-store.js";
import {
  replaySessionEvents,
  startSession,
  submitAttempt,
  type LearningSessionState,
  type SessionEvent,
  type StartSessionCommand,
  type SubmitAttemptCommand,
} from "./session.js";
import type { LessonFlow } from "./types.js";

export interface PersistedSession {
  readonly state: LearningSessionState;
  readonly events: readonly SessionEvent[];
}

export class SessionNotFoundError extends Error {
  constructor(readonly sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

export class LessonSessionService {
  constructor(private readonly eventStore: SessionEventStore) {}

  async start(
    lesson: LessonFlow,
    command: StartSessionCommand,
  ): Promise<PersistedSession> {
    const transition = startSession(lesson, command);
    await this.eventStore.append(command.sessionId, 0, transition.events);
    return transition;
  }

  async load(sessionId: string): Promise<PersistedSession | undefined> {
    const events = await this.eventStore.load(sessionId);
    if (events.length === 0) {
      return undefined;
    }
    return { state: replaySessionEvents(events), events };
  }

  async submit(
    lesson: LessonFlow,
    command: SubmitAttemptCommand,
    sessionId: string,
  ): Promise<PersistedSession> {
    const persisted = await this.load(sessionId);
    if (!persisted) {
      throw new SessionNotFoundError(sessionId);
    }

    const transition = submitAttempt(lesson, persisted.state, command);
    await this.eventStore.append(
      sessionId,
      persisted.state.lastSequence,
      transition.events,
    );

    return {
      state: transition.state,
      events: [...persisted.events, ...transition.events],
    };
  }
}
