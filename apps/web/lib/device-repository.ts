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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开设备数据库"));
  });
  return databasePromise;
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
