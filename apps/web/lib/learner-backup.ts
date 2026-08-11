import type {
  CourseLearningRecord,
  KnowledgeProgress,
  MasteryLevel,
  ReviewEvent,
  ReviewMode,
  ReviewTask,
} from "./learning.ts";

export const LEARNER_BACKUP_SCHEMA_VERSION = 1 as const;
export const MAX_LEARNER_BACKUP_BYTES = 5 * 1024 * 1024;
const BACKUP_KIND = "learn-language-learner-backup" as const;
const masteryLevels: MasteryLevel[] = ["encountered", "comprehended", "prompted-output", "independent-output", "delayed-transfer"];
const reviewModes: ReviewMode[] = ["recognition", "active-recall", "scenario", "transfer", "fluency"];

interface BackupCourseRecord {
  courseId: string;
  courseVersion: string;
  languageId: string;
  completedLessonIds: string[];
  mastery: KnowledgeProgress[];
  reviews: ReviewTask[];
  reviewEvents: ReviewEvent[];
  updatedAt: string;
}

export interface LearnerBackup {
  kind: typeof BACKUP_KIND;
  schemaVersion: typeof LEARNER_BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  records: BackupCourseRecord[];
}

export type LearnerBackupError = "invalid-json" | "invalid-backup" | "unsupported-version";

export interface LearnerBackupMergeResult {
  records: Record<string, CourseLearningRecord>;
  added: number;
  replaced: number;
  skipped: number;
}

const objectValue = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");

function cleanMastery(value: unknown): KnowledgeProgress | undefined {
  if (!objectValue(value)
    || typeof value.knowledgeItemId !== "string"
    || !masteryLevels.includes(value.level as MasteryLevel)
    || typeof value.evidenceCount !== "number"
    || !Number.isInteger(value.evidenceCount)
    || value.evidenceCount < 0
    || !validDate(value.lastAttemptAt)) return undefined;
  return {
    knowledgeItemId: value.knowledgeItemId,
    level: value.level as MasteryLevel,
    evidenceCount: value.evidenceCount,
    lastAttemptAt: value.lastAttemptAt,
  };
}

function cleanReview(value: unknown): ReviewTask | undefined {
  if (!objectValue(value)
    || typeof value.id !== "string"
    || typeof value.knowledgeItemId !== "string"
    || !reviewModes.includes(value.mode as ReviewMode)
    || !validDate(value.dueAt)
    || !masteryLevels.includes(value.basedOnLevel as MasteryLevel)) return undefined;
  return {
    id: value.id,
    knowledgeItemId: value.knowledgeItemId,
    mode: value.mode as ReviewMode,
    dueAt: value.dueAt,
    basedOnLevel: value.basedOnLevel as MasteryLevel,
  };
}

function cleanReviewEvent(value: unknown): ReviewEvent | undefined {
  if (!objectValue(value)
    || typeof value.id !== "string"
    || typeof value.taskId !== "string"
    || typeof value.knowledgeItemId !== "string"
    || (value.result !== "remembered" && value.result !== "retry")
    || !validDate(value.occurredAt)) return undefined;
  return {
    id: value.id,
    taskId: value.taskId,
    knowledgeItemId: value.knowledgeItemId,
    result: value.result,
    occurredAt: value.occurredAt,
  };
}

function cleanBackupRecord(value: unknown): BackupCourseRecord | undefined {
  if (!objectValue(value)
    || typeof value.courseId !== "string"
    || typeof value.courseVersion !== "string"
    || typeof value.languageId !== "string"
    || !stringArray(value.completedLessonIds)
    || !Array.isArray(value.mastery)
    || !Array.isArray(value.reviews)
    || !Array.isArray(value.reviewEvents)
    || !validDate(value.updatedAt)) return undefined;
  const mastery = value.mastery.map(cleanMastery);
  const reviews = value.reviews.map(cleanReview);
  const reviewEvents = value.reviewEvents.map(cleanReviewEvent);
  if (mastery.some((item) => !item) || reviews.some((item) => !item) || reviewEvents.some((item) => !item)) return undefined;
  if (new Set(mastery.map((item) => item!.knowledgeItemId)).size !== mastery.length
    || new Set(reviews.map((item) => item!.id)).size !== reviews.length
    || new Set(reviewEvents.map((item) => item!.id)).size !== reviewEvents.length) return undefined;
  return {
    courseId: value.courseId,
    courseVersion: value.courseVersion,
    languageId: value.languageId,
    completedLessonIds: [...new Set(value.completedLessonIds)],
    mastery: mastery as KnowledgeProgress[],
    reviews: reviews as ReviewTask[],
    reviewEvents: reviewEvents as ReviewEvent[],
    updatedAt: value.updatedAt,
  };
}

function recordForBackup(record: CourseLearningRecord): BackupCourseRecord {
  return {
    courseId: record.courseId,
    courseVersion: record.courseVersion,
    languageId: record.languageId,
    completedLessonIds: [...record.completedLessonIds],
    mastery: Object.values(record.mastery).map((item) => ({ ...item })),
    reviews: record.reviews.map((item) => ({ ...item })),
    reviewEvents: record.reviewEvents.map((item) => ({ ...item })),
    updatedAt: record.updatedAt,
  };
}

function restoredRecord(record: BackupCourseRecord): CourseLearningRecord {
  return {
    schemaVersion: 2,
    courseId: record.courseId,
    courseVersion: record.courseVersion,
    languageId: record.languageId,
    completedLessonIds: [...record.completedLessonIds],
    lessonProgress: {},
    mastery: Object.fromEntries(record.mastery.map((item) => [item.knowledgeItemId, { ...item }])),
    reviews: record.reviews.map((item) => ({ ...item })),
    reviewEvents: record.reviewEvents.map((item) => ({ ...item })),
    updatedAt: record.updatedAt,
  };
}

export function createLearnerBackup(records: CourseLearningRecord[], exportedAt = new Date().toISOString()): LearnerBackup {
  return {
    kind: BACKUP_KIND,
    schemaVersion: LEARNER_BACKUP_SCHEMA_VERSION,
    exportedAt,
    records: records.map(recordForBackup).sort((left, right) => left.courseId.localeCompare(right.courseId)),
  };
}

export function serializeLearnerBackup(backup: LearnerBackup) {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function learnerBackupFileName(exportedAt: string) {
  const date = validDate(exportedAt) ? exportedAt.slice(0, 10) : "backup";
  return `learnlanguage-progress-${date}.json`;
}

export function parseLearnerBackup(text: string): { records?: CourseLearningRecord[]; exportedAt?: string; error?: LearnerBackupError } {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return { error: "invalid-json" }; }
  if (!objectValue(value) || value.kind !== BACKUP_KIND || !Array.isArray(value.records) || !validDate(value.exportedAt)) return { error: "invalid-backup" };
  if (value.schemaVersion !== LEARNER_BACKUP_SCHEMA_VERSION) return { error: "unsupported-version" };
  if (value.records.length > 1_000) return { error: "invalid-backup" };
  const cleaned = value.records.map(cleanBackupRecord);
  if (cleaned.some((item) => !item)) return { error: "invalid-backup" };
  const records = (cleaned as BackupCourseRecord[]).map(restoredRecord);
  if (new Set(records.map((record) => record.courseId)).size !== records.length) return { error: "invalid-backup" };
  return { records, exportedAt: value.exportedAt };
}

export function mergeLearnerRecords(
  local: Record<string, CourseLearningRecord>,
  incoming: CourseLearningRecord[],
): LearnerBackupMergeResult {
  const records = { ...local };
  let added = 0;
  let replaced = 0;
  let skipped = 0;
  for (const record of incoming) {
    const current = records[record.courseId];
    if (!current) {
      records[record.courseId] = record;
      added += 1;
    } else if (Date.parse(record.updatedAt) > Date.parse(current.updatedAt)) {
      records[record.courseId] = record;
      replaced += 1;
    } else {
      skipped += 1;
    }
  }
  return { records, added, replaced, skipped };
}
