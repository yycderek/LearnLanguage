import {
  SYNC_PROTOCOL_VERSION,
  type SyncAcceptedMutation,
  type SyncConflict,
  type SyncMutation,
  type SyncPullRequest,
  type SyncPullResponse,
  type SyncPushRequest,
  type SyncPushResponse,
  type SyncRecord,
  type SyncResource,
  type SyncServerCapabilities,
  type SyncTransport,
} from "@learn-language/protocol";

export * from "./client.js";

const DEFAULT_RESOURCES: readonly SyncResource[] = [
  "session-events",
  "learning-records",
  "installed-courses",
  "course-drafts",
  "language-packs",
];

export interface ReferenceSyncChange {
  cursor: number;
  record: SyncRecord;
}

export interface ReferenceSyncProfileState {
  records: Map<string, SyncRecord>;
  changes: ReferenceSyncChange[];
  mutations: Map<string, SyncAcceptedMutation>;
  cursor: number;
}

export interface ReferenceSyncStateStore {
  load(profileId: string): Promise<ReferenceSyncProfileState>;
  save(profileId: string, state: ReferenceSyncProfileState): Promise<void>;
}

function emptyProfileState(): ReferenceSyncProfileState {
  return { records: new Map(), changes: [], mutations: new Map(), cursor: 0 };
}

function cloneProfileState(state: ReferenceSyncProfileState): ReferenceSyncProfileState {
  return {
    records: new Map([...state.records].map(([key, value]) => [key, structuredClone(value)])),
    changes: state.changes.map((change) => structuredClone(change)),
    mutations: new Map([...state.mutations].map(([key, value]) => [key, structuredClone(value)])),
    cursor: state.cursor,
  };
}

export class MemoryReferenceSyncStateStore implements ReferenceSyncStateStore {
  readonly #profiles = new Map<string, ReferenceSyncProfileState>();
  async load(profileId: string): Promise<ReferenceSyncProfileState> {
    return cloneProfileState(this.#profiles.get(profileId) ?? emptyProfileState());
  }
  async save(profileId: string, state: ReferenceSyncProfileState): Promise<void> {
    this.#profiles.set(profileId, cloneProfileState(state));
  }
}

export class SyncProtocolError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "SyncProtocolError";
  }
}

export interface ReferenceSyncServiceOptions {
  serverId?: string;
  maxBatchSize?: number;
  now?: () => string;
  store?: ReferenceSyncStateStore;
}

export class ReferenceSyncService implements SyncTransport {
  readonly #serverId: string;
  readonly #maxBatchSize: number;
  readonly #now: () => string;
  readonly #store: ReferenceSyncStateStore;

  constructor(options: ReferenceSyncServiceOptions = {}) {
    this.#serverId = options.serverId ?? "learn-language-reference";
    this.#maxBatchSize = options.maxBatchSize ?? 100;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#store = options.store ?? new MemoryReferenceSyncStateStore();
  }

  async capabilities(): Promise<SyncServerCapabilities> {
    return {
      protocolVersions: [SYNC_PROTOCOL_VERSION],
      serverId: this.#serverId,
      authModes: ["none"],
      accountOptional: true,
      resources: [...DEFAULT_RESOURCES],
      conflictPolicy: "reject-stale",
      maxBatchSize: this.#maxBatchSize,
      serverTime: this.#now(),
    };
  }

  async push(request: SyncPushRequest): Promise<SyncPushResponse> {
    if (!request || typeof request !== "object") throw new SyncProtocolError(400, "request body is required");
    this.#validateRequest(request.protocolVersion, request.profileId);
    if (!Array.isArray(request.mutations) || request.mutations.length > this.#maxBatchSize) {
      throw new SyncProtocolError(400, `mutations must contain at most ${this.#maxBatchSize} items`);
    }

    const state = await this.#store.load(request.profileId);
    const accepted: SyncAcceptedMutation[] = [];
    const conflicts: SyncConflict[] = [];
    for (const mutation of request.mutations) {
      this.#validateMutation(mutation);
      const previousAcceptance = state.mutations.get(mutation.mutationId);
      if (previousAcceptance) {
        accepted.push(structuredClone(previousAcceptance));
        continue;
      }

      const key = `${mutation.resource}:${mutation.id}`;
      const current = state.records.get(key);
      if ((current?.version ?? 0) !== mutation.baseVersion) {
        conflicts.push({ mutationId: mutation.mutationId, ...(current ? { current: structuredClone(current) } : {}) });
        continue;
      }

      const record: SyncRecord = {
        resource: mutation.resource,
        id: mutation.id,
        version: mutation.baseVersion + 1,
        deviceId: mutation.deviceId,
        updatedAt: mutation.updatedAt,
        deleted: mutation.deleted,
        ...(!mutation.deleted && mutation.payload !== undefined ? { payload: structuredClone(mutation.payload) } : {}),
      };
      const acceptance: SyncAcceptedMutation = {
        mutationId: mutation.mutationId,
        resource: mutation.resource,
        id: mutation.id,
        version: record.version,
      };
      state.cursor += 1;
      state.records.set(key, record);
      state.changes.push({ cursor: state.cursor, record });
      state.mutations.set(mutation.mutationId, acceptance);
      accepted.push(acceptance);
    }
    if (accepted.length > 0) await this.#store.save(request.profileId, state);
    return { accepted, conflicts, cursor: String(state.cursor) };
  }

  async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
    if (!request || typeof request !== "object") throw new SyncProtocolError(400, "request body is required");
    this.#validateRequest(request.protocolVersion, request.profileId);
    const state = await this.#store.load(request.profileId);
    const cursor = this.#parseCursor(request.cursor);
    if (cursor > state.cursor) throw new SyncProtocolError(409, "cursor is ahead of the server state");
    const limit = Math.min(Math.max(request.limit ?? this.#maxBatchSize, 1), this.#maxBatchSize);
    const changes = state.changes.filter((change) => change.cursor > cursor).slice(0, limit);
    const nextCursor = changes.at(-1)?.cursor ?? cursor;
    return {
      records: changes.map((change) => structuredClone(change.record)),
      cursor: String(nextCursor),
      hasMore: state.changes.some((change) => change.cursor > nextCursor),
    };
  }

  #validateRequest(protocolVersion: number, profileId: string): void {
    if (protocolVersion !== SYNC_PROTOCOL_VERSION) throw new SyncProtocolError(409, "unsupported sync protocol version");
    if (typeof profileId !== "string" || profileId.trim().length === 0) throw new SyncProtocolError(400, "profileId is required");
  }

  #validateMutation(mutation: SyncMutation): void {
    if (!mutation || typeof mutation !== "object") throw new SyncProtocolError(400, "mutation must be an object");
    if (!mutation.mutationId || !mutation.id || !mutation.deviceId) throw new SyncProtocolError(400, "mutationId, id, and deviceId are required");
    if (!DEFAULT_RESOURCES.includes(mutation.resource)) throw new SyncProtocolError(400, "unsupported sync resource");
    if (!Number.isInteger(mutation.baseVersion) || mutation.baseVersion < 0) throw new SyncProtocolError(400, "baseVersion must be a non-negative integer");
    if (Number.isNaN(Date.parse(mutation.updatedAt))) throw new SyncProtocolError(400, "updatedAt must be an ISO date-time");
  }

  #parseCursor(value?: string): number {
    if (value === undefined) return 0;
    const cursor = Number(value);
    if (!Number.isSafeInteger(cursor) || cursor < 0) throw new SyncProtocolError(400, "cursor is invalid");
    return cursor;
  }
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

export function createReferenceSyncHandler(service: SyncTransport = new ReferenceSyncService()) {
  return async function handle(request: Request): Promise<Response> {
    try {
      const path = new URL(request.url).pathname;
      if (request.method === "GET" && path === "/.well-known/learn-language-sync") return json(await service.capabilities());
      if (request.method === "POST" && path === "/v1/sync/push") return json(await service.push(await request.json() as SyncPushRequest));
      if (request.method === "POST" && path === "/v1/sync/pull") return json(await service.pull(await request.json() as SyncPullRequest));
      return json({ error: "not_found" }, 404);
    } catch (error) {
      if (error instanceof SyncProtocolError) return json({ error: error.message }, error.status);
      if (error instanceof SyntaxError) return json({ error: "invalid_json" }, 400);
      return json({ error: "internal_error" }, 500);
    }
  };
}
