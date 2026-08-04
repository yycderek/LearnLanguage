import { DatabaseSync } from "node:sqlite";
import {
  DraftConcurrencyError,
  DraftOwnershipError,
  type CourseDraftStore,
  type CourseDraftVersion,
} from "../core/course-draft.js";
import type { CoursePack } from "../core/types.js";

interface DraftHeadRow {
  readonly owner_id: string;
  readonly current_revision: number;
}

interface DraftVersionRow {
  readonly draft_id: string;
  readonly owner_id: string;
  readonly revision: number;
  readonly course_json: string;
  readonly created_at: string;
  readonly change_summary: string;
}

function mapVersion(row: DraftVersionRow): CourseDraftVersion {
  return {
    draftId: row.draft_id,
    ownerId: row.owner_id,
    revision: row.revision,
    course: JSON.parse(row.course_json) as CoursePack,
    createdAt: row.created_at,
    changeSummary: row.change_summary,
  };
}

export class SqliteCourseDraftStore implements CourseDraftStore {
  readonly #database: DatabaseSync;

  constructor(filename: string) {
    this.#database = new DatabaseSync(filename);
    this.#database.exec("PRAGMA foreign_keys = ON");
    this.#database.exec("PRAGMA journal_mode = WAL");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS course_drafts (
        draft_id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        current_revision INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS course_draft_versions (
        draft_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        course_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        change_summary TEXT NOT NULL,
        PRIMARY KEY (draft_id, revision),
        FOREIGN KEY (draft_id) REFERENCES course_drafts(draft_id)
      );
    `);
  }

  async append(
    version: CourseDraftVersion,
    expectedRevision: number,
  ): Promise<void> {
    this.#database.exec("BEGIN IMMEDIATE");

    try {
      const head = this.#database
        .prepare(
          "SELECT owner_id, current_revision FROM course_drafts WHERE draft_id = ?",
        )
        .get(version.draftId) as unknown as DraftHeadRow | undefined;
      const actualRevision = head?.current_revision ?? 0;

      if (actualRevision !== expectedRevision) {
        throw new DraftConcurrencyError(
          version.draftId,
          expectedRevision,
          actualRevision,
        );
      }
      if (version.revision !== expectedRevision + 1) {
        throw new Error(
          `New draft revision must be ${expectedRevision + 1}, received ${version.revision}`,
        );
      }
      if (head && head.owner_id !== version.ownerId) {
        throw new DraftOwnershipError(version.draftId);
      }

      if (!head) {
        this.#database
          .prepare(`
            INSERT INTO course_drafts (
              draft_id, owner_id, current_revision, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?)
          `)
          .run(
            version.draftId,
            version.ownerId,
            version.revision,
            version.createdAt,
            version.createdAt,
          );
      } else {
        this.#database
          .prepare(`
            UPDATE course_drafts
            SET current_revision = ?, updated_at = ?
            WHERE draft_id = ?
          `)
          .run(version.revision, version.createdAt, version.draftId);
      }

      this.#database
        .prepare(`
          INSERT INTO course_draft_versions (
            draft_id,
            owner_id,
            revision,
            course_json,
            created_at,
            change_summary
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          version.draftId,
          version.ownerId,
          version.revision,
          JSON.stringify(version.course),
          version.createdAt,
          version.changeSummary,
        );

      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  async loadLatest(draftId: string): Promise<CourseDraftVersion | undefined> {
    const row = this.#database
      .prepare(`
        SELECT
          v.draft_id,
          v.owner_id,
          v.revision,
          v.course_json,
          v.created_at,
          v.change_summary
        FROM course_draft_versions v
        JOIN course_drafts d ON d.draft_id = v.draft_id
        WHERE v.draft_id = ? AND v.revision = d.current_revision
      `)
      .get(draftId) as unknown as DraftVersionRow | undefined;
    return row ? mapVersion(row) : undefined;
  }

  async loadHistory(
    draftId: string,
  ): Promise<readonly CourseDraftVersion[]> {
    const rows = this.#database
      .prepare(`
        SELECT draft_id, owner_id, revision, course_json, created_at, change_summary
        FROM course_draft_versions
        WHERE draft_id = ?
        ORDER BY revision
      `)
      .all(draftId) as unknown as DraftVersionRow[];
    return rows.map(mapVersion);
  }

  async listByOwner(
    ownerId: string,
  ): Promise<readonly CourseDraftVersion[]> {
    const rows = this.#database
      .prepare(`
        SELECT
          v.draft_id,
          v.owner_id,
          v.revision,
          v.course_json,
          v.created_at,
          v.change_summary
        FROM course_draft_versions v
        JOIN course_drafts d
          ON d.draft_id = v.draft_id AND d.current_revision = v.revision
        WHERE d.owner_id = ?
        ORDER BY d.updated_at DESC
      `)
      .all(ownerId) as unknown as DraftVersionRow[];
    return rows.map(mapVersion);
  }

  close(): void {
    this.#database.close();
  }
}
