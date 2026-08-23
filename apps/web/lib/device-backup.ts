import { normalizeLearningPlan, type LearningPlan } from "@learn-language/application/learning-plan";
import type { LanguageDefinition } from "@learn-language/protocol";
import { validateCourse, type CoursePack } from "./course.ts";
import { normalizeDraftHistory } from "./draft-library.ts";
import { parseLanguagePackFile } from "./language-pack-file.ts";
import { normalizeCourseLearningRecord, type CourseLearningRecord } from "./learning.ts";

export const DEVICE_BACKUP_SCHEMA_VERSION = 1 as const;
export const MAX_DEVICE_BACKUP_BYTES = 25 * 1024 * 1024;
const DEVICE_BACKUP_KIND = "learn-language-device-backup" as const;

export const durableDeviceStores = [
  "preferences",
  "drafts",
  "languagePacks",
  "installedCourses",
  "courseRecords",
  "learningPlans",
] as const;

export type DurableDeviceStoreName = (typeof durableDeviceStores)[number];
export interface DeviceBackupEntry { key: string; value: unknown }
export type DeviceBackupCollections = Record<DurableDeviceStoreName, DeviceBackupEntry[]>;

export interface DeviceBackup {
  kind: typeof DEVICE_BACKUP_KIND;
  schemaVersion: typeof DEVICE_BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  collections: DeviceBackupCollections;
}

export interface DeviceBackupPreview {
  exportedAt: string;
  totalItems: number;
  addedItems: number;
  replacedItems: number;
  counts: Record<DurableDeviceStoreName, number>;
}

export type DeviceBackupError = "invalid-json" | "invalid-backup" | "unsupported-version";

const objectValue = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const sensitiveKey = (key: string) => /(?:api.?key|password|secret|token|credential)/iu.test(key);

function sanitizedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizedJson);
  if (objectValue(value)) return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitiveKey(key)).map(([key, item]) => [key, sanitizedJson(item)]));
  return value;
}

function cleanEntry(store: DurableDeviceStoreName, value: unknown): DeviceBackupEntry | undefined {
  if (!objectValue(value) || typeof value.key !== "string" || !value.key || value.key.length > 300 || sensitiveKey(value.key)) return undefined;
  const entry = { key: value.key, value: sanitizedJson(value.value) };
  try { JSON.stringify(entry.value); }
  catch { return undefined; }

  if (store === "preferences") return entry;
  if (store === "drafts") {
    if (entry.key === "history") {
      if (!Array.isArray(entry.value) || normalizeDraftHistory(entry.value).length !== entry.value.length) return undefined;
      return entry;
    }
    if (entry.key === "studio-working-copy-v1" && objectValue(entry.value)) {
      const course = validateCourse(JSON.stringify(entry.value.course));
      return course.course?.manifest.status === "draft" ? entry : undefined;
    }
    return undefined;
  }
  if (store === "languagePacks") {
    const parsed = parseLanguagePackFile(JSON.stringify(entry.value));
    return parsed.pack?.id === entry.key ? { key: entry.key, value: parsed.pack satisfies LanguageDefinition } : undefined;
  }
  if (store === "installedCourses") {
    const parsed = validateCourse(JSON.stringify(entry.value));
    return parsed.course?.manifest.id === entry.key && parsed.course.manifest.status === "published"
      ? { key: entry.key, value: parsed.course satisfies CoursePack }
      : undefined;
  }
  if (store === "courseRecords") {
    const record = normalizeCourseLearningRecord(entry.value);
    return record?.courseId === entry.key ? { key: entry.key, value: record satisfies CourseLearningRecord } : undefined;
  }
  const plan = normalizeLearningPlan(entry.value);
  return plan?.courseId === entry.key ? { key: entry.key, value: plan satisfies LearningPlan } : undefined;
}

function cleanCollections(value: unknown): DeviceBackupCollections | undefined {
  if (!objectValue(value)) return undefined;
  const collections = {} as DeviceBackupCollections;
  let total = 0;
  for (const store of durableDeviceStores) {
    const items = value[store];
    if (!Array.isArray(items) || items.length > 10_000) return undefined;
    total += items.length;
    if (total > 25_000) return undefined;
    const cleaned = items.map((item) => cleanEntry(store, item));
    if (cleaned.some((item) => !item)) return undefined;
    const entries = cleaned as DeviceBackupEntry[];
    if (new Set(entries.map((item) => item.key)).size !== entries.length) return undefined;
    collections[store] = entries;
  }
  return collections;
}

export function createDeviceBackup(collections: DeviceBackupCollections, exportedAt = new Date().toISOString()): DeviceBackup {
  if (!validDate(exportedAt)) throw new Error("Invalid device backup date");
  const cleaned = cleanCollections(collections);
  if (!cleaned) throw new Error("Invalid device backup collections");
  return { kind: DEVICE_BACKUP_KIND, schemaVersion: DEVICE_BACKUP_SCHEMA_VERSION, exportedAt, collections: cleaned };
}

export function serializeDeviceBackup(backup: DeviceBackup) {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function deviceBackupFileName(exportedAt: string) {
  const date = validDate(exportedAt) ? exportedAt.slice(0, 10) : "backup";
  return `learnlanguage-device-${date}.json`;
}

export function parseDeviceBackup(text: string): { backup?: DeviceBackup; error?: DeviceBackupError } {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return { error: "invalid-json" }; }
  if (!objectValue(value) || value.kind !== DEVICE_BACKUP_KIND || !validDate(value.exportedAt)) return { error: "invalid-backup" };
  if (value.schemaVersion !== DEVICE_BACKUP_SCHEMA_VERSION) return { error: "unsupported-version" };
  const collections = cleanCollections(value.collections);
  if (!collections) return { error: "invalid-backup" };
  return { backup: { kind: DEVICE_BACKUP_KIND, schemaVersion: DEVICE_BACKUP_SCHEMA_VERSION, exportedAt: value.exportedAt, collections } };
}

export function buildDeviceBackupPreview(backup: DeviceBackup, local: DeviceBackupCollections): DeviceBackupPreview {
  const counts = {} as Record<DurableDeviceStoreName, number>;
  let totalItems = 0;
  let addedItems = 0;
  let replacedItems = 0;
  for (const store of durableDeviceStores) {
    const localKeys = new Set(local[store].map((item) => item.key));
    counts[store] = backup.collections[store].length;
    totalItems += counts[store];
    for (const entry of backup.collections[store]) {
      if (localKeys.has(entry.key)) replacedItems += 1;
      else addedItems += 1;
    }
  }
  return { exportedAt: backup.exportedAt, totalItems, addedItems, replacedItems, counts };
}
