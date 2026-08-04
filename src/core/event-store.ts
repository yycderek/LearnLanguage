import type { SessionEvent } from "./session.js";

export interface SessionEventStore {
  append(
    sessionId: string,
    expectedLastSequence: number,
    events: readonly SessionEvent[],
  ): Promise<void>;
  load(sessionId: string): Promise<readonly SessionEvent[]>;
}

export class EventStoreConcurrencyError extends Error {
  constructor(
    readonly sessionId: string,
    readonly expectedSequence: number,
    readonly actualSequence: number,
  ) {
    super(
      `Session ${sessionId} expected sequence ${expectedSequence}, actual sequence is ${actualSequence}`,
    );
    this.name = "EventStoreConcurrencyError";
  }
}

export function assertAppendBatch(
  sessionId: string,
  expectedLastSequence: number,
  events: readonly SessionEvent[],
): void {
  let expectedEventSequence = expectedLastSequence + 1;

  for (const event of events) {
    if (event.sessionId !== sessionId) {
      throw new Error(
        `Event ${event.id} belongs to ${event.sessionId}, not ${sessionId}`,
      );
    }
    if (event.sequence !== expectedEventSequence) {
      throw new Error(
        `Event ${event.id} has sequence ${event.sequence}; expected ${expectedEventSequence}`,
      );
    }
    expectedEventSequence += 1;
  }
}

export class MemorySessionEventStore implements SessionEventStore {
  readonly #streams = new Map<string, SessionEvent[]>();

  async append(
    sessionId: string,
    expectedLastSequence: number,
    events: readonly SessionEvent[],
  ): Promise<void> {
    const current = this.#streams.get(sessionId) ?? [];
    const actualSequence = current.at(-1)?.sequence ?? 0;
    if (actualSequence !== expectedLastSequence) {
      throw new EventStoreConcurrencyError(
        sessionId,
        expectedLastSequence,
        actualSequence,
      );
    }

    assertAppendBatch(sessionId, expectedLastSequence, events);
    this.#streams.set(sessionId, [...current, ...events]);
  }

  async load(sessionId: string): Promise<readonly SessionEvent[]> {
    return [...(this.#streams.get(sessionId) ?? [])];
  }
}
