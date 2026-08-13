import { DatabaseSync } from "node:sqlite";
import type {
  DraftRepository,
  DraftRevisionRecord,
  InstalledCourseRepository,
  LearningProfileRepository,
  LanguagePackRepository,
  ProfileProjection,
} from "@learn-language/application/workspace";
import type { CoursePack, LanguageDefinition } from "@learn-language/protocol";

interface JsonRow { payload: string }

function openWorkspaceDatabase(filename: string): DatabaseSync {
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS workspace_drafts (
      key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspace_language_packs (
      language_id TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspace_installed_courses (
      course_id TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspace_learning_profiles (
      course_id TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workspace_learning_profiles_updated_at
    ON workspace_learning_profiles(updated_at);
  `);
  database.exec("PRAGMA optimize");
  return database;
}

abstract class SqliteWorkspaceRepository {
  protected readonly database: DatabaseSync;
  constructor(filename: string) { this.database = openWorkspaceDatabase(filename); }
  close(): void { this.database.close(); }
}

export class SqliteDraftRepository extends SqliteWorkspaceRepository implements DraftRepository {
  async load(): Promise<unknown> {
    const row = this.database.prepare("SELECT payload FROM workspace_drafts WHERE key = 'history'").get() as unknown as JsonRow | undefined;
    return row ? JSON.parse(row.payload) : [];
  }

  async save(revisions: readonly DraftRevisionRecord[]): Promise<void> {
    const updatedAt = revisions[0]?.updatedAt ?? new Date(0).toISOString();
    this.database.prepare(`
      INSERT INTO workspace_drafts (key, payload, updated_at) VALUES ('history', ?, ?)
      ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
    `).run(JSON.stringify(revisions), updatedAt);
  }
}

export class SqliteLanguagePackRepository extends SqliteWorkspaceRepository implements LanguagePackRepository {
  async list(): Promise<readonly LanguageDefinition[]> {
    const rows = this.database.prepare("SELECT payload FROM workspace_language_packs ORDER BY language_id").all() as unknown as JsonRow[];
    return rows.map((row) => JSON.parse(row.payload) as LanguageDefinition);
  }

  async get(languageId: string): Promise<LanguageDefinition | undefined> {
    const row = this.database.prepare("SELECT payload FROM workspace_language_packs WHERE language_id = ?").get(languageId) as unknown as JsonRow | undefined;
    return row ? JSON.parse(row.payload) as LanguageDefinition : undefined;
  }

  async put(pack: LanguageDefinition): Promise<void> {
    this.database.prepare(`
      INSERT INTO workspace_language_packs (language_id, payload) VALUES (?, ?)
      ON CONFLICT(language_id) DO UPDATE SET payload = excluded.payload
    `).run(pack.id, JSON.stringify(pack));
  }

  async remove(languageId: string): Promise<void> {
    this.database.prepare("DELETE FROM workspace_language_packs WHERE language_id = ?").run(languageId);
  }
}

export class SqliteInstalledCourseRepository extends SqliteWorkspaceRepository implements InstalledCourseRepository {
  async list(): Promise<readonly CoursePack[]> {
    const rows = this.database.prepare("SELECT payload FROM workspace_installed_courses ORDER BY course_id").all() as unknown as JsonRow[];
    return rows.map((row) => JSON.parse(row.payload) as CoursePack);
  }

  async get(courseId: string): Promise<CoursePack | undefined> {
    const row = this.database.prepare("SELECT payload FROM workspace_installed_courses WHERE course_id = ?").get(courseId) as unknown as JsonRow | undefined;
    return row ? JSON.parse(row.payload) as CoursePack : undefined;
  }

  async put(course: CoursePack): Promise<void> {
    this.database.prepare(`
      INSERT INTO workspace_installed_courses (course_id, payload) VALUES (?, ?)
      ON CONFLICT(course_id) DO UPDATE SET payload = excluded.payload
    `).run(course.manifest.id, JSON.stringify(course));
  }

  async remove(courseId: string): Promise<void> {
    this.database.prepare("DELETE FROM workspace_installed_courses WHERE course_id = ?").run(courseId);
  }
}

export class SqliteLearningProfileRepository<TRecord extends ProfileProjection>
  extends SqliteWorkspaceRepository implements LearningProfileRepository<TRecord> {
  async list(): Promise<readonly TRecord[]> {
    const rows = this.database.prepare("SELECT payload FROM workspace_learning_profiles ORDER BY course_id").all() as unknown as JsonRow[];
    return rows.map((row) => JSON.parse(row.payload) as TRecord);
  }

  async putMany(records: readonly TRecord[]): Promise<void> {
    if (records.length === 0) return;
    const statement = this.database.prepare(`
      INSERT INTO workspace_learning_profiles (course_id, updated_at, payload) VALUES (?, ?, ?)
      ON CONFLICT(course_id) DO UPDATE SET updated_at = excluded.updated_at, payload = excluded.payload
    `);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      for (const record of records) statement.run(record.courseId, record.updatedAt, JSON.stringify(record));
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}
