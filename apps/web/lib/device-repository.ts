import type {
  EffectQueue,
  PersistedEffect,
  SessionEventRepository,
} from "@learn-language/application";
import type {
  DraftRepository,
  DraftRevisionRecord,
  InstalledCourseRepository,
  LearningProfileRepository,
  LanguagePackRepository,
} from "@learn-language/application/workspace";
import type { LearningPlan, LearningPlanRepository } from "@learn-language/application";
import type { LearningEffect, SessionEvent } from "@learn-language/engine";
import type { LanguageDefinition } from "@learn-language/protocol";
import type { CoursePack } from "./course";
import {
  durableDeviceStores,
  type DeviceBackupCollections,
  type DeviceBackupEntry,
  type DurableDeviceStoreName,
} from "./device-backup.ts";
import type { CourseLearningRecord, LearningProgress } from "./learning";

const DATABASE_NAME = "learn-language-device-v1";
const DATABASE_VERSION = 2;

export type DeviceStoreName =
  | "preferences"
  | "drafts"
  | "languagePacks"
  | "installedCourses"
  | "courseRecords"
  | "learningPlans"
  | "sessionEvents"
  | "effects";
export interface DeviceDataInventory {
  readonly counts: Readonly<Record<DeviceStoreName, number>>;
  readonly totalItems: number;
}

export interface CourseDeviceResetPreview {
  readonly courseId: string;
  readonly learningRecordCount: number;
  readonly learningPlanCount: number;
  readonly sessionCount: number;
  readonly effectCount: number;
  readonly totalItems: number;
}

export interface DeviceStorageDiagnostics {
  readonly kind: "learn-language-storage-diagnostics";
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly available: boolean;
  readonly databaseVersion?: number;
  readonly storeCount?: number;
  readonly counts?: Readonly<Record<DeviceStoreName, number>>;
  readonly error?: { readonly name: string; readonly message: string };
}


const stores: readonly DeviceStoreName[] = [
  "preferences",
  "drafts",
  "languagePacks",
  "installedCourses",
  "courseRecords",
  "learningPlans",
  "sessionEvents",
  "effects",
];

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

let databasePromise: Promise<IDBDatabase> | undefined;

export function openDeviceDatabase(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      for (const store of stores) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error ?? new Error("Could not open the device database"));
    };
  });
  return databasePromise;
}


function valueCourseId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const courseId = (value as { courseId?: unknown }).courseId;
  return typeof courseId === "string" ? courseId : undefined;
}

function sessionCourseId(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const event of value) {
    const courseId = valueCourseId(event);
    if (courseId) return courseId;
  }
  return undefined;
}

async function readStoreEntries(transaction: IDBTransaction, storeName: DeviceStoreName): Promise<Array<{ key: IDBValidKey; value: unknown }>> {
  const store = transaction.objectStore(storeName);
  const [keys, values] = await Promise.all([requestResult(store.getAllKeys()), requestResult(store.getAll())]);
  return keys.map((key, index) => ({ key, value: values[index] }));
}

export async function inspectDeviceData(): Promise<DeviceDataInventory> {
  const database = await openDeviceDatabase();
  const transaction = database.transaction([...stores], "readonly");
  const countValues = await Promise.all(stores.map((storeName) => requestResult(transaction.objectStore(storeName).count())));
  const counts = Object.fromEntries(stores.map((storeName, index) => [storeName, countValues[index]])) as Record<DeviceStoreName, number>;
  return { counts, totalItems: countValues.reduce((total, count) => total + count, 0) };
}

export async function previewCourseDeviceReset(courseId: string): Promise<CourseDeviceResetPreview> {
  const database = await openDeviceDatabase();
  const transaction = database.transaction(["courseRecords", "learningPlans", "sessionEvents", "effects"], "readonly");
  const [record, plan, sessions, effects] = await Promise.all([
    requestResult(transaction.objectStore("courseRecords").get(courseId)),
    requestResult(transaction.objectStore("learningPlans").get(courseId)),
    readStoreEntries(transaction, "sessionEvents"),
    readStoreEntries(transaction, "effects"),
  ]);
  const preview = {
    courseId,
    learningRecordCount: record === undefined ? 0 : 1,
    learningPlanCount: plan === undefined ? 0 : 1,
    sessionCount: sessions.filter((entry) => sessionCourseId(entry.value) === courseId).length,
    effectCount: effects.filter((entry) => valueCourseId(entry.value) === courseId).length,
  };
  return { ...preview, totalItems: preview.learningRecordCount + preview.learningPlanCount + preview.sessionCount + preview.effectCount };
}

export async function resetCourseDeviceData(courseId: string): Promise<CourseDeviceResetPreview> {
  const database = await openDeviceDatabase();
  const transaction = database.transaction(["courseRecords", "learningPlans", "sessionEvents", "effects"], "readwrite");
  const [record, plan, sessions, effects] = await Promise.all([
    requestResult(transaction.objectStore("courseRecords").get(courseId)),
    requestResult(transaction.objectStore("learningPlans").get(courseId)),
    readStoreEntries(transaction, "sessionEvents"),
    readStoreEntries(transaction, "effects"),
  ]);
  transaction.objectStore("courseRecords").delete(courseId);
  transaction.objectStore("learningPlans").delete(courseId);
  const matchingSessions = sessions.filter((entry) => sessionCourseId(entry.value) === courseId);
  const matchingEffects = effects.filter((entry) => valueCourseId(entry.value) === courseId);
  for (const entry of matchingSessions) transaction.objectStore("sessionEvents").delete(entry.key);
  for (const entry of matchingEffects) transaction.objectStore("effects").delete(entry.key);
  await transactionDone(transaction);
  const result = {
    courseId,
    learningRecordCount: record === undefined ? 0 : 1,
    learningPlanCount: plan === undefined ? 0 : 1,
    sessionCount: matchingSessions.length,
    effectCount: matchingEffects.length,
  };
  return { ...result, totalItems: result.learningRecordCount + result.learningPlanCount + result.sessionCount + result.effectCount };
}

export async function clearAllDeviceData(): Promise<DeviceDataInventory> {
  const inventory = await inspectDeviceData();
  const database = await openDeviceDatabase();
  const transaction = database.transaction([...stores], "readwrite");
  for (const storeName of stores) transaction.objectStore(storeName).clear();
  await transactionDone(transaction);
  return inventory;
}

export async function diagnoseDeviceStorage(): Promise<DeviceStorageDiagnostics> {
  try {
    const database = await openDeviceDatabase();
    const inventory = await inspectDeviceData();
    return {
      kind: "learn-language-storage-diagnostics", schemaVersion: 1, generatedAt: new Date().toISOString(),
      available: true, databaseVersion: database.version, storeCount: database.objectStoreNames.length, counts: inventory.counts,
    };
  } catch (error) {
    return {
      kind: "learn-language-storage-diagnostics", schemaVersion: 1, generatedAt: new Date().toISOString(), available: false,
      error: { name: error instanceof Error ? error.name : "StorageError", message: error instanceof Error ? error.message : "Unknown storage error" },
    };
  }
}

export async function rebuildDeviceDatabase(factory: IDBFactory = indexedDB): Promise<void> {
  const current = await databasePromise?.catch(() => undefined);
  current?.close();
  databasePromise = undefined;
  await new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not rebuild the device database"));
    request.onblocked = () => reject(new Error("Close other LearnLanguage tabs before rebuilding local storage"));
  });
  await openDeviceDatabase(factory);
}

export async function getDeviceValue<T>(storeName: DeviceStoreName, key: IDBValidKey): Promise<T | undefined> {
  const database = await openDeviceDatabase();
  const transaction = database.transaction(storeName, "readonly");
  return requestResult(transaction.objectStore(storeName).get(key)) as Promise<T | undefined>;
}

export async function getAllDeviceValues<T>(storeName: DeviceStoreName): Promise<T[]> {
  const database = await openDeviceDatabase();
  const transaction = database.transaction(storeName, "readonly");
  return requestResult(transaction.objectStore(storeName).getAll()) as Promise<T[]>;
}

export async function getAllDeviceEntries<T = unknown>(storeName: DurableDeviceStoreName): Promise<DeviceBackupEntry[]> {
  const database = await openDeviceDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const store = transaction.objectStore(storeName);
  const [keys, values] = await Promise.all([requestResult(store.getAllKeys()), requestResult(store.getAll()) as Promise<T[]>]);
  return keys.map((key, index) => ({ key: String(key), value: values[index] }));
}

export async function readDurableDeviceData(): Promise<DeviceBackupCollections> {
  const entries = await Promise.all(durableDeviceStores.map((store) => getAllDeviceEntries(store)));
  return Object.fromEntries(durableDeviceStores.map((store, index) => [store, entries[index]])) as unknown as DeviceBackupCollections;
}

export async function restoreDurableDeviceData(collections: DeviceBackupCollections, mode: "merge" | "replace"): Promise<void> {
  const database = await openDeviceDatabase();
  const transaction = database.transaction([...durableDeviceStores], "readwrite");
  for (const storeName of durableDeviceStores) {
    const store = transaction.objectStore(storeName);
    if (mode === "replace") store.clear();
    for (const entry of collections[storeName]) store.put(entry.value, entry.key);
  }
  await transactionDone(transaction);
}

export async function putDeviceValue<T>(storeName: DeviceStoreName, key: IDBValidKey, value: T): Promise<void> {
  const database = await openDeviceDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(value, key);
  await transactionDone(transaction);
}

export async function deleteDeviceValue(storeName: DeviceStoreName, key: IDBValidKey): Promise<void> {
  const database = await openDeviceDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await transactionDone(transaction);
}

export class IndexedDbDraftRepository implements DraftRepository {
  async load(): Promise<unknown> {
    return (await getDeviceValue<unknown>("drafts", "history")) ?? [];
  }

  async save(revisions: readonly DraftRevisionRecord[]): Promise<void> {
    await putDeviceValue("drafts", "history", [...revisions]);
  }
}

export class IndexedDbLanguagePackRepository implements LanguagePackRepository {
  async list(): Promise<readonly LanguageDefinition[]> {
    return getAllDeviceValues<LanguageDefinition>("languagePacks");
  }

  async get(languageId: string): Promise<LanguageDefinition | undefined> {
    return getDeviceValue<LanguageDefinition>("languagePacks", languageId);
  }

  async put(pack: LanguageDefinition): Promise<void> {
    await putDeviceValue("languagePacks", pack.id, pack);
  }

  async remove(languageId: string): Promise<void> {
    await deleteDeviceValue("languagePacks", languageId);
  }
}

export class IndexedDbInstalledCourseRepository implements InstalledCourseRepository {
  async list(): Promise<readonly CoursePack[]> {
    return getAllDeviceValues<CoursePack>("installedCourses");
  }

  async get(courseId: string): Promise<CoursePack | undefined> {
    return getDeviceValue<CoursePack>("installedCourses", courseId);
  }

  async put(course: CoursePack): Promise<void> {
    await putInstalledCourse(course);
  }

  async remove(courseId: string): Promise<void> {
    await deleteDeviceValue("installedCourses", courseId);
  }
}

export class IndexedDbLearningProfileRepository implements LearningProfileRepository<CourseLearningRecord> {
  async list(): Promise<readonly CourseLearningRecord[]> {
    return getAllDeviceValues<CourseLearningRecord>("courseRecords");
  }

  async putMany(records: readonly CourseLearningRecord[]): Promise<void> {
    await putCourseRecords([...records]);
  }
}

export class IndexedDbLearningPlanRepository implements LearningPlanRepository {
  async list(): Promise<readonly LearningPlan[]> {
    return getAllDeviceValues<LearningPlan>("learningPlans");
  }

  async get(courseId: string): Promise<LearningPlan | undefined> {
    return getDeviceValue<LearningPlan>("learningPlans", courseId);
  }

  async put(plan: LearningPlan): Promise<void> {
    await putDeviceValue("learningPlans", plan.courseId, plan);
  }
}

export async function putInstalledCourse(course: CoursePack): Promise<void> {
  await putDeviceValue("installedCourses", course.manifest.id, course);
}

export async function putInstalledCourseVersion(course: CoursePack, record?: CourseLearningRecord): Promise<void> {
  const storeNames: DeviceStoreName[] = record ? ["installedCourses", "courseRecords"] : ["installedCourses"];
  const database = await openDeviceDatabase();
  const transaction = database.transaction(storeNames, "readwrite");
  transaction.objectStore("installedCourses").put(course, course.manifest.id);
  if (record) transaction.objectStore("courseRecords").put(record, record.courseId);
  await transactionDone(transaction);
}

export async function removeInstalledCourse(courseId: string): Promise<void> {
  await deleteDeviceValue("installedCourses", courseId);
}

export async function putCourseRecord(record: CourseLearningRecord): Promise<void> {
  await putDeviceValue("courseRecords", record.courseId, record);
}

export async function putCourseRecords(records: CourseLearningRecord[]): Promise<void> {
  if (records.length === 0) return;
  const database = await openDeviceDatabase();
  const transaction = database.transaction("courseRecords", "readwrite");
  const store = transaction.objectStore("courseRecords");
  for (const record of records) store.put(record, record.courseId);
  await transactionDone(transaction);
}

export async function persistLearningState(
  record: CourseLearningRecord,
  progress: LearningProgress,
): Promise<void> {
  const database = await openDeviceDatabase();
  const transaction = database.transaction(["courseRecords", "sessionEvents", "effects"], "readwrite");
  transaction.objectStore("courseRecords").put(record, record.courseId);
  transaction.objectStore("sessionEvents").put(progress.engineEvents, progress.sessionId);
  const effectStore = transaction.objectStore("effects");
  for (const effect of progress.pendingEffects) {
    const persisted: PersistedEffect = {
      ...effect,
      status: "pending",
      attempts: 0,
      createdAt: progress.updatedAt,
    };
    effectStore.put(persisted, effect.id);
  }
  await transactionDone(transaction);
}

export class IndexedDbSessionEventRepository implements SessionEventRepository {
  async load(sessionId: string): Promise<readonly SessionEvent[]> {
    return (await getDeviceValue<SessionEvent[]>("sessionEvents", sessionId)) ?? [];
  }

  async append(sessionId: string, expectedLastSequence: number, events: readonly SessionEvent[]): Promise<void> {
    const database = await openDeviceDatabase();
    const transaction = database.transaction("sessionEvents", "readwrite");
    const store = transaction.objectStore("sessionEvents");
    const current = (await requestResult(store.get(sessionId)) as SessionEvent[] | undefined) ?? [];
    const actual = current.at(-1)?.sequence ?? 0;
    if (actual !== expectedLastSequence) {
      throw new Error(`Session ${sessionId} expected sequence ${expectedLastSequence}, actual sequence is ${actual}`);
    }
    store.put([...current, ...events], sessionId);
    await transactionDone(transaction);
  }
}

export class IndexedDbEffectQueue implements EffectQueue {
  async enqueue(effects: readonly LearningEffect[], createdAt: string): Promise<void> {
    const database = await openDeviceDatabase();
    const transaction = database.transaction("effects", "readwrite");
    const store = transaction.objectStore("effects");
    for (const effect of effects) {
      store.put({ ...effect, status: "pending", attempts: 0, createdAt } satisfies PersistedEffect, effect.id);
    }
    await transactionDone(transaction);
  }

  async pending(): Promise<readonly PersistedEffect[]> {
    const effects = await getAllDeviceValues<PersistedEffect>("effects");
    return effects.filter((effect) => effect.status === "pending");
  }

  async markCompleted(effectId: string): Promise<void> {
    const effect = await getDeviceValue<PersistedEffect>("effects", effectId);
    if (!effect) throw new Error(`Effect not found: ${effectId}`);
    await putDeviceValue("effects", effectId, {
      ...effect,
      status: "completed",
      attempts: effect.attempts + 1,
    } satisfies PersistedEffect);
  }
}
