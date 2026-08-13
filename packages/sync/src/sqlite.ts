import { DatabaseSync } from "node:sqlite";
import type { SyncAcceptedMutation, SyncRecord } from "@learn-language/protocol";
import type { ReferenceSyncProfileState, ReferenceSyncStateStore } from "./index.js";

interface StateRow { payload: string }
interface StoredState {
  records: Array<[string, SyncRecord]>;
  changes: ReferenceSyncProfileState["changes"];
  mutations: Array<[string, SyncAcceptedMutation]>;
  cursor: number;
}

export class SqliteReferenceSyncStateStore implements ReferenceSyncStateStore {
  readonly #database: DatabaseSync;
  constructor(filename: string) {
    this.#database = new DatabaseSync(filename);
    this.#database.exec("PRAGMA journal_mode = WAL");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS sync_profiles (
        profile_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sync_profiles_updated_at ON sync_profiles(updated_at);
    `);
    this.#database.exec("PRAGMA optimize");
  }

  async load(profileId: string): Promise<ReferenceSyncProfileState> {
    const row = this.#database.prepare("SELECT payload FROM sync_profiles WHERE profile_id = ?").get(profileId) as unknown as StateRow | undefined;
    if (!row) return { records: new Map(), changes: [], mutations: new Map(), cursor: 0 };
    const value = JSON.parse(row.payload) as StoredState;
    return { records: new Map(value.records), changes: value.changes, mutations: new Map(value.mutations), cursor: value.cursor };
  }

  async save(profileId: string, state: ReferenceSyncProfileState): Promise<void> {
    const payload: StoredState = {
      records: [...state.records],
      changes: [...state.changes],
      mutations: [...state.mutations],
      cursor: state.cursor,
    };
    this.#database.prepare(`
      INSERT INTO sync_profiles (profile_id, payload, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(profile_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
    `).run(profileId, JSON.stringify(payload), new Date().toISOString());
  }

  close(): void { this.#database.close(); }
}
