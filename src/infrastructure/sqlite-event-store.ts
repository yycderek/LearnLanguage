import { DatabaseSync } from "node:sqlite";
import {
  EventStoreConcurrencyError,
  assertAppendBatch,
  type SessionEventStore,
} from "../core/event-store.js";
import type { SessionEvent } from "../core/session.js";

interface SequenceRow {
  readonly last_sequence: number;
}

interface EventRow {
  readonly event_json: string;
}

export class SqliteSessionEventStore implements SessionEventStore {
  readonly #database: DatabaseSync;

  constructor(filename: string) {
    this.#database = new DatabaseSync(filename);
    this.#database.exec("PRAGMA journal_mode = WAL");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS session_events (
        session_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        event_id TEXT NOT NULL UNIQUE,
        occurred_at TEXT NOT NULL,
        event_json TEXT NOT NULL,
        PRIMARY KEY (session_id, sequence)
      )
    `);
  }

  async append(
    sessionId: string,
    expectedLastSequence: number,
    events: readonly SessionEvent[],
  ): Promise<void> {
    assertAppendBatch(sessionId, expectedLastSequence, events);
    this.#database.exec("BEGIN IMMEDIATE");

    try {
      const row = this.#database
        .prepare(
          "SELECT COALESCE(MAX(sequence), 0) AS last_sequence FROM session_events WHERE session_id = ?",
        )
        .get(sessionId) as unknown as SequenceRow;

      if (row.last_sequence !== expectedLastSequence) {
        throw new EventStoreConcurrencyError(
          sessionId,
          expectedLastSequence,
          row.last_sequence,
        );
      }

      const insert = this.#database.prepare(`
        INSERT INTO session_events (
          session_id,
          sequence,
          event_id,
          occurred_at,
          event_json
        ) VALUES (?, ?, ?, ?, ?)
      `);
      for (const event of events) {
        insert.run(
          event.sessionId,
          event.sequence,
          event.id,
          event.occurredAt,
          JSON.stringify(event),
        );
      }

      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  async load(sessionId: string): Promise<readonly SessionEvent[]> {
    const rows = this.#database
      .prepare(
        "SELECT event_json FROM session_events WHERE session_id = ? ORDER BY sequence",
      )
      .all(sessionId) as unknown as EventRow[];
    return rows.map((row) => JSON.parse(row.event_json) as SessionEvent);
  }

  close(): void {
    this.#database.close();
  }
}
