import assert from "node:assert/strict";
import test from "node:test";
import { createCourseLearningRecord } from "../lib/learning.ts";
import { bundledCatalogCourses } from "../lib/course-library.ts";
import {
  buildDeviceBackupPreview,
  createDeviceBackup,
  deviceBackupFileName,
  parseDeviceBackup,
  serializeDeviceBackup,
} from "../lib/device-backup.ts";

const emptyCollections = () => ({
  preferences: [],
  drafts: [],
  languagePacks: [],
  installedCourses: [],
  courseRecords: [],
  learningPlans: [],
});

test("complete device backups round-trip durable product data without credentials", () => {
  const course = bundledCatalogCourses()[0];
  const record = createCourseLearningRecord(course, "2026-08-22T10:00:00.000Z");
  const collections = emptyCollections();
  collections.preferences.push({ key: "ai", value: { provider: "openai", model: "gpt", apiKey: "must-not-leave-device" } });
  collections.drafts.push({ key: "history", value: [] });
  collections.installedCourses.push({ key: course.manifest.id, value: course });
  collections.courseRecords.push({ key: record.courseId, value: record });

  const backup = createDeviceBackup(collections, "2026-08-22T12:00:00.000Z");
  const serialized = serializeDeviceBackup(backup);
  assert.doesNotMatch(serialized, /must-not-leave-device|apiKey/);
  assert.equal(deviceBackupFileName(backup.exportedAt), "learnlanguage-device-2026-08-22.json");

  const parsed = parseDeviceBackup(serialized);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.backup.collections.installedCourses[0].key, course.manifest.id);
  assert.equal(parsed.backup.collections.courseRecords[0].key, record.courseId);
});

test("restore preview reports additions and matching local identities before writes", () => {
  const course = bundledCatalogCourses()[0];
  const incoming = emptyCollections();
  incoming.preferences.push({ key: "app-locale", value: "en" });
  incoming.installedCourses.push({ key: course.manifest.id, value: course });
  incoming.courseRecords.push({ key: course.manifest.id, value: createCourseLearningRecord(course, "2026-08-22T10:00:00.000Z") });
  const local = emptyCollections();
  local.installedCourses.push({ key: course.manifest.id, value: course });

  const preview = buildDeviceBackupPreview(createDeviceBackup(incoming), local);
  assert.equal(preview.totalItems, 3);
  assert.equal(preview.addedItems, 2);
  assert.equal(preview.replacedItems, 1);
  assert.equal(preview.counts.installedCourses, 1);
});

test("complete device backups reject unsupported, duplicate, and mismatched content", () => {
  const course = bundledCatalogCourses()[0];
  const valid = createDeviceBackup(emptyCollections());
  assert.equal(parseDeviceBackup(JSON.stringify({ ...valid, schemaVersion: 99 })).error, "unsupported-version");

  const duplicates = structuredClone(valid);
  duplicates.collections.preferences = [{ key: "locale", value: "en" }, { key: "locale", value: "zh-CN" }];
  assert.equal(parseDeviceBackup(JSON.stringify(duplicates)).error, "invalid-backup");

  const mismatch = structuredClone(valid);
  mismatch.collections.installedCourses = [{ key: "wrong-id", value: course }];
  assert.equal(parseDeviceBackup(JSON.stringify(mismatch)).error, "invalid-backup");
});
