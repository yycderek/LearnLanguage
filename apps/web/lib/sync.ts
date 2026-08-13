import {
  HttpSyncTransport,
  SyncClient,
  type SyncClientStore,
} from "@learn-language/sync";
import type {
  SyncAcceptedMutation,
  SyncConflict,
  SyncJsonValue,
  SyncMutation,
  SyncRecord,
  SyncResource,
} from "@learn-language/protocol";
import type { SessionEvent } from "@learn-language/engine";
import {
  deleteDeviceValue,
  getAllDeviceValues,
  getDeviceValue,
  IndexedDbDraftRepository,
  putDeviceValue,
} from "./device-repository.ts";
import type { CoursePack } from "./course.ts";
import type { CourseLearningRecord } from "./learning.ts";
import type { LanguagePack } from "./language-pack.ts";

const SYNC_STATE_KEY = "sync-state-v1";
const requiredResources: readonly SyncResource[] = ["session-events", "learning-records", "installed-courses", "course-drafts", "language-packs"];

interface SyncedVersion { version: number; payload: string }
interface DeviceSyncState {
  cursor?: string;
  versions: Record<string, SyncedVersion>;
  pending: SyncMutation[];
}
interface LocalSnapshot { resource: SyncResource; id: string; updatedAt: string; value: unknown }

function emptyState(): DeviceSyncState { return { versions: {}, pending: [] }; }
function keyOf(resource: SyncResource, id: string) { return `${resource}:${id}`; }
function toJsonValue(value: unknown): SyncJsonValue { return JSON.parse(JSON.stringify(value)) as SyncJsonValue; }
function payloadOf(value: unknown) { return JSON.stringify(toJsonValue(value)); }

export class DeviceSyncClientStore implements SyncClientStore {
  readonly #deviceId: string;
  constructor(deviceId: string) { this.#deviceId = deviceId; }

  async #loadState(): Promise<DeviceSyncState> {
    return (await getDeviceValue<DeviceSyncState>("preferences", SYNC_STATE_KEY)) ?? emptyState();
  }
  async #saveState(state: DeviceSyncState) { await putDeviceValue("preferences", SYNC_STATE_KEY, state); }

  async #snapshots(): Promise<LocalSnapshot[]> {
    const [events, records, courses, drafts, packs] = await Promise.all([
      getAllDeviceValues<SessionEvent[]>("sessionEvents"),
      getAllDeviceValues<CourseLearningRecord>("courseRecords"),
      getAllDeviceValues<CoursePack>("installedCourses"),
      new IndexedDbDraftRepository().load(),
      getAllDeviceValues<LanguagePack>("languagePacks"),
    ]);
    const now = new Date().toISOString();
    const snapshots: LocalSnapshot[] = [
      ...events.filter((items) => items.length > 0).map((items) => ({ resource: "session-events" as const, id: items[0]!.sessionId, updatedAt: items.at(-1)!.occurredAt, value: items })),
      ...records.map((record) => ({ resource: "learning-records" as const, id: record.courseId, updatedAt: record.updatedAt, value: record })),
      ...courses.map((course) => ({ resource: "installed-courses" as const, id: course.manifest.id, updatedAt: now, value: course })),
      ...packs.map((pack) => ({ resource: "language-packs" as const, id: pack.id, updatedAt: now, value: pack })),
    ];
    if (Array.isArray(drafts) && drafts.length > 0) {
      const updatedAt = drafts.reduce((latest, item) => {
        const candidate = typeof item === "object" && item && "updatedAt" in item ? String(item.updatedAt) : now;
        return Date.parse(candidate) > Date.parse(latest) ? candidate : latest;
      }, "1970-01-01T00:00:00.000Z");
      snapshots.push({ resource: "course-drafts", id: "history", updatedAt, value: drafts });
    }
    return snapshots;
  }

  async pendingMutations(): Promise<readonly SyncMutation[]> {
    const state = await this.#loadState();
    if (state.pending.length > 0) return state.pending;
    const snapshots = await this.#snapshots();
    const liveKeys = new Set(snapshots.map((snapshot) => keyOf(snapshot.resource, snapshot.id)));
    const pending: SyncMutation[] = [];
    for (const snapshot of snapshots) {
      const key = keyOf(snapshot.resource, snapshot.id);
      const payload = payloadOf(snapshot.value);
      const previous = state.versions[key];
      if (previous?.payload === payload) continue;
      pending.push({
        mutationId: crypto.randomUUID(), resource: snapshot.resource, id: snapshot.id,
        baseVersion: previous?.version ?? 0, deviceId: this.#deviceId,
        updatedAt: snapshot.updatedAt, deleted: false, payload: JSON.parse(payload) as SyncJsonValue,
      });
    }
    for (const [key, previous] of Object.entries(state.versions)) {
      if (liveKeys.has(key) || previous.payload === "__deleted__") continue;
      const separator = key.indexOf(":");
      pending.push({
        mutationId: crypto.randomUUID(), resource: key.slice(0, separator) as SyncResource, id: key.slice(separator + 1),
        baseVersion: previous.version, deviceId: this.#deviceId, updatedAt: new Date().toISOString(), deleted: true,
      });
    }
    state.pending = pending;
    await this.#saveState(state);
    return pending;
  }

  async acknowledge(accepted: readonly SyncAcceptedMutation[]): Promise<void> {
    const state = await this.#loadState();
    for (const item of accepted) {
      const mutation = state.pending.find((candidate) => candidate.mutationId === item.mutationId);
      if (!mutation) continue;
      state.versions[keyOf(item.resource, item.id)] = { version: item.version, payload: mutation.deleted ? "__deleted__" : payloadOf(mutation.payload) };
    }
    const acceptedIds = new Set(accepted.map((item) => item.mutationId));
    state.pending = state.pending.filter((mutation) => !acceptedIds.has(mutation.mutationId));
    await this.#saveState(state);
  }

  async applyRemote(records: readonly SyncRecord[]): Promise<void> {
    const state = await this.#loadState();
    for (const record of records) {
      const key = keyOf(record.resource, record.id);
      if ((state.versions[key]?.version ?? 0) >= record.version) continue;
      await this.#apply(record);
      state.versions[key] = { version: record.version, payload: record.deleted ? "__deleted__" : payloadOf(record.payload) };
    }
    await this.#saveState(state);
  }

  async #apply(record: SyncRecord) {
    const remove = async () => {
      if (record.resource === "course-drafts") await new IndexedDbDraftRepository().save([]);
      else if (record.resource === "session-events") await deleteDeviceValue("sessionEvents", record.id);
      else if (record.resource === "learning-records") await deleteDeviceValue("courseRecords", record.id);
      else if (record.resource === "installed-courses") await deleteDeviceValue("installedCourses", record.id);
      else await deleteDeviceValue("languagePacks", record.id);
    };
    if (record.deleted) return remove();
    if (record.resource === "course-drafts") await new IndexedDbDraftRepository().save(record.payload as never[]);
    else if (record.resource === "session-events") await putDeviceValue("sessionEvents", record.id, record.payload as unknown as SessionEvent[]);
    else if (record.resource === "learning-records") await putDeviceValue("courseRecords", record.id, record.payload as unknown as CourseLearningRecord);
    else if (record.resource === "installed-courses") await putDeviceValue("installedCourses", record.id, record.payload as unknown as CoursePack);
    else await putDeviceValue("languagePacks", record.id, record.payload as unknown as LanguagePack);
  }

  async resolveConflicts(conflicts: readonly SyncConflict[], resolution: "keep-local" | "use-remote"): Promise<void> {
    const state = await this.#loadState();
    for (const conflict of conflicts) {
      const index = state.pending.findIndex((mutation) => mutation.mutationId === conflict.mutationId);
      if (index < 0) continue;
      const mutation = state.pending[index]!;
      if (resolution === "keep-local") {
        state.pending[index] = { ...mutation, mutationId: crypto.randomUUID(), baseVersion: conflict.current?.version ?? 0 };
      } else {
        state.pending.splice(index, 1);
        if (conflict.current) {
          await this.#apply(conflict.current);
          state.versions[keyOf(conflict.current.resource, conflict.current.id)] = {
            version: conflict.current.version,
            payload: conflict.current.deleted ? "__deleted__" : payloadOf(conflict.current.payload),
          };
        }
      }
    }
    await this.#saveState(state);
  }

  async getCursor() { return (await this.#loadState()).cursor; }
  async setCursor(cursor: string) { const state = await this.#loadState(); state.cursor = cursor; await this.#saveState(state); }
}

export interface DeviceSyncSettings { endpoint: string; profileId: string; deviceId: string }

export async function runDeviceSync(settings: DeviceSyncSettings, bearer?: string, conflicts?: readonly SyncConflict[], resolution?: "keep-local" | "use-remote") {
  const store = new DeviceSyncClientStore(settings.deviceId);
  const client = new SyncClient(new HttpSyncTransport(settings.endpoint, { bearer }), store, settings.profileId);
  return conflicts && resolution ? client.resolve(conflicts, resolution, requiredResources) : client.run(requiredResources);
}
