import type {
  InstalledCourseRepository,
  LanguagePackRepository,
  LearningProfileRepository,
} from "@learn-language/application/workspace";
import type { CourseLearningRecord } from "@learn-language/application/learning-record";
import type { LearningPlan, LearningPlanRepository } from "@learn-language/application/learning-plan";
import type { CoursePack, LanguageDefinition } from "@learn-language/protocol";
import type { SQLiteDatabase } from "expo-sqlite";
import type { MobileLocale } from "./model";

const DATABASE_VERSION = 3;

export async function migrateMobileDatabase(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const version = row?.user_version ?? 0;
  if (version > DATABASE_VERSION) throw new Error("移动端数据库版本高于当前应用支持范围");
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS learning_profiles (
      course_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS learning_profiles_updated_at_idx ON learning_profiles(updated_at);
    CREATE TABLE IF NOT EXISTS learning_plans (
      course_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS learning_plans_updated_at_idx ON learning_plans(updated_at);
    CREATE TABLE IF NOT EXISTS app_preferences (
      preference_key TEXT PRIMARY KEY NOT NULL,
      preference_value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS installed_language_packs (
      language_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS installed_courses (
      course_id TEXT PRIMARY KEY NOT NULL,
      language_id TEXT NOT NULL,
      version TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS installed_courses_language_id_idx ON installed_courses(language_id);
  `);
  if (version < DATABASE_VERSION) await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

function parsedRows<T>(rows: readonly { payload: string }[]): T[] {
  return rows.flatMap((row) => {
    try { return [JSON.parse(row.payload) as T]; }
    catch { return []; }
  });
}

export class SQLiteLearningProfileRepository implements LearningProfileRepository<CourseLearningRecord> {
  constructor(private readonly db: SQLiteDatabase) {}

  async list(): Promise<readonly CourseLearningRecord[]> {
    const rows = await this.db.getAllAsync<{ payload: string }>("SELECT payload FROM learning_profiles ORDER BY updated_at DESC");
    return parsedRows<CourseLearningRecord>(rows);
  }

  async putMany(records: readonly CourseLearningRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.db.withTransactionAsync(async () => {
      for (const record of records) {
        await this.db.runAsync(
          `INSERT INTO learning_profiles(course_id, payload, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(course_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
          record.courseId,
          JSON.stringify(record),
          record.updatedAt,
        );
      }
    });
  }

  async clear(): Promise<void> { await this.db.runAsync("DELETE FROM learning_profiles"); }
}

export class SQLiteLearningPlanRepository implements LearningPlanRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async list(): Promise<readonly LearningPlan[]> {
    const rows = await this.db.getAllAsync<{ payload: string }>("SELECT payload FROM learning_plans ORDER BY updated_at DESC");
    return parsedRows<LearningPlan>(rows);
  }

  async get(courseId: string): Promise<LearningPlan | undefined> {
    const row = await this.db.getFirstAsync<{ payload: string }>("SELECT payload FROM learning_plans WHERE course_id = ?", courseId);
    if (!row) return undefined;
    try { return JSON.parse(row.payload) as LearningPlan; }
    catch { return undefined; }
  }

  async put(plan: LearningPlan): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO learning_plans(course_id, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(course_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      plan.courseId,
      JSON.stringify(plan),
      plan.updatedAt,
    );
  }

  async clear(): Promise<void> { await this.db.runAsync("DELETE FROM learning_plans"); }
}
export class SQLiteLanguagePackRepository implements LanguagePackRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async list(): Promise<readonly LanguageDefinition[]> {
    const rows = await this.db.getAllAsync<{ payload: string }>("SELECT payload FROM installed_language_packs ORDER BY language_id");
    return parsedRows<LanguageDefinition>(rows);
  }

  async get(languageId: string): Promise<LanguageDefinition | undefined> {
    const row = await this.db.getFirstAsync<{ payload: string }>("SELECT payload FROM installed_language_packs WHERE language_id = ?", languageId);
    if (!row) return undefined;
    try { return JSON.parse(row.payload) as LanguageDefinition; }
    catch { return undefined; }
  }

  async put(pack: LanguageDefinition): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO installed_language_packs(language_id, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(language_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      pack.id,
      JSON.stringify(pack),
      new Date().toISOString(),
    );
  }

  async remove(languageId: string): Promise<void> {
    await this.db.runAsync("DELETE FROM installed_language_packs WHERE language_id = ?", languageId);
  }
}

export class SQLiteInstalledCourseRepository implements InstalledCourseRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async list(): Promise<readonly CoursePack[]> {
    const rows = await this.db.getAllAsync<{ payload: string }>("SELECT payload FROM installed_courses ORDER BY updated_at DESC");
    return parsedRows<CoursePack>(rows);
  }

  async get(courseId: string): Promise<CoursePack | undefined> {
    const row = await this.db.getFirstAsync<{ payload: string }>("SELECT payload FROM installed_courses WHERE course_id = ?", courseId);
    if (!row) return undefined;
    try { return JSON.parse(row.payload) as CoursePack; }
    catch { return undefined; }
  }

  async put(course: CoursePack): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO installed_courses(course_id, language_id, version, payload, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(course_id) DO UPDATE SET language_id = excluded.language_id, version = excluded.version, payload = excluded.payload, updated_at = excluded.updated_at`,
      course.manifest.id,
      course.manifest.languageId,
      course.manifest.version,
      JSON.stringify(course),
      new Date().toISOString(),
    );
  }

  async remove(courseId: string): Promise<void> {
    await this.db.runAsync("DELETE FROM installed_courses WHERE course_id = ?", courseId);
  }
}

export class SQLitePreferenceRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async locale(): Promise<MobileLocale> {
    const row = await this.db.getFirstAsync<{ preference_value: string }>("SELECT preference_value FROM app_preferences WHERE preference_key = ?", "locale");
    return row?.preference_value === "en" ? "en" : "zh-CN";
  }

  async setLocale(locale: MobileLocale): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO app_preferences(preference_key, preference_value) VALUES (?, ?)
       ON CONFLICT(preference_key) DO UPDATE SET preference_value = excluded.preference_value`,
      "locale",
      locale,
    );
  }
  async onboardingComplete(): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ preference_value: string }>("SELECT preference_value FROM app_preferences WHERE preference_key = ?", "onboarding-complete");
    return row?.preference_value === "true";
  }

  async setOnboardingComplete(): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO app_preferences(preference_key, preference_value) VALUES (?, ?)
       ON CONFLICT(preference_key) DO UPDATE SET preference_value = excluded.preference_value`,
      "onboarding-complete",
      "true",
    );
  }
}
