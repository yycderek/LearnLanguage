import assert from "node:assert/strict";
import test from "node:test";
import { sampleCourse } from "../lib/course.ts";
import {
  createLearnerBackup,
  learnerBackupFileName,
  LEARNER_BACKUP_SCHEMA_VERSION,
  MAX_LEARNER_BACKUP_BYTES,
  mergeLearnerRecords,
  parseLearnerBackup,
  serializeLearnerBackup,
} from "../lib/learner-backup.ts";
import { createCourseLearningRecord, startLearning, submitLearningStep, updateCourseLearningRecord } from "../lib/learning.ts";

function learningRecord(courseIdSuffix = "", updatedAt = "2026-08-11T10:00:00.000Z") {
  const course = sampleCourse("ja");
  course.manifest.id += courseIdSuffix;
  let record = createCourseLearningRecord(course, updatedAt);
  let progress = startLearning(course, course.lessons[0].id, "2026-08-11T09:00:00.000Z");
  progress = submitLearningStep(course, progress, {
    decision: "advance",
    answer: "private learner answer",
    now: updatedAt,
  });
  record = updateCourseLearningRecord(record, progress);
  record.completedLessonIds = [course.lessons[0].id];
  record.reviewEvents.push({ id: "review-event", taskId: "review-task", knowledgeItemId: course.knowledge[0].id, result: "remembered", occurredAt: updatedAt });
  record.apiKey = "must-not-be-exported";
  return record;
}

test("learner backups include durable learning projections but exclude answers and settings", () => {
  const record = learningRecord();
  const backup = createLearnerBackup([record], "2026-08-11T11:00:00.000Z");
  const serialized = serializeLearnerBackup(backup);
  assert.equal(backup.schemaVersion, LEARNER_BACKUP_SCHEMA_VERSION);
  assert.equal(learnerBackupFileName(backup.exportedAt), "learnlanguage-progress-2026-08-11.json");
  assert.equal(MAX_LEARNER_BACKUP_BYTES, 5 * 1024 * 1024);
  assert.doesNotMatch(serialized, /private learner answer|must-not-be-exported|pendingEffects|lessonProgress/u);

  const parsed = parseLearnerBackup(serialized);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.records.length, 1);
  assert.deepEqual(parsed.records[0].completedLessonIds, record.completedLessonIds);
  assert.deepEqual(parsed.records[0].mastery, record.mastery);
  assert.deepEqual(parsed.records[0].reviews, record.reviews);
  assert.deepEqual(parsed.records[0].reviewEvents, record.reviewEvents);
  assert.deepEqual(parsed.records[0].lessonProgress, {});
});

test("restore keeps newer local records and accepts newer or missing backup records", () => {
  const local = learningRecord(".local", "2026-08-11T12:00:00.000Z");
  const older = structuredClone(local);
  older.updatedAt = "2026-08-11T11:00:00.000Z";
  const replaceLocal = learningRecord(".replace", "2026-08-11T10:00:00.000Z");
  const replacement = structuredClone(replaceLocal);
  replacement.updatedAt = "2026-08-11T13:00:00.000Z";
  const added = learningRecord(".added", "2026-08-11T09:00:00.000Z");

  const merged = mergeLearnerRecords({ [local.courseId]: local, [replaceLocal.courseId]: replaceLocal }, [older, replacement, added]);
  assert.equal(merged.added, 1);
  assert.equal(merged.replaced, 1);
  assert.equal(merged.skipped, 1);
  assert.equal(merged.records[local.courseId].updatedAt, local.updatedAt);
  assert.equal(merged.records[replaceLocal.courseId].updatedAt, replacement.updatedAt);
  assert.equal(merged.records[added.courseId].updatedAt, added.updatedAt);
});

test("damaged, duplicate, and unsupported backup files are rejected", () => {
  assert.equal(parseLearnerBackup("not json").error, "invalid-json");
  assert.equal(parseLearnerBackup(JSON.stringify({ kind: "wrong", schemaVersion: 1, exportedAt: "2026-08-11T10:00:00.000Z", records: [] })).error, "invalid-backup");
  assert.equal(parseLearnerBackup(JSON.stringify({ kind: "learn-language-learner-backup", schemaVersion: 99, exportedAt: "2026-08-11T10:00:00.000Z", records: [] })).error, "unsupported-version");

  const record = learningRecord();
  const backup = createLearnerBackup([record]);
  backup.records.push(structuredClone(backup.records[0]));
  assert.equal(parseLearnerBackup(JSON.stringify(backup)).error, "invalid-backup");

  const invalid = createLearnerBackup([record]);
  invalid.records[0].mastery[0].evidenceCount = -1;
  assert.equal(parseLearnerBackup(JSON.stringify(invalid)).error, "invalid-backup");

  const duplicateKnowledge = createLearnerBackup([record]);
  duplicateKnowledge.records[0].mastery.push(structuredClone(duplicateKnowledge.records[0].mastery[0]));
  assert.equal(parseLearnerBackup(JSON.stringify(duplicateKnowledge)).error, "invalid-backup");
});
