import {
  SYNC_PROTOCOL_VERSION,
  type SyncConflict,
  type SyncAcceptedMutation,
  type SyncMutation,
  type SyncRecord,
  type SyncResource,
  type SyncServerCapabilities,
  type SyncTransport,
} from "@learn-language/protocol";

export type SyncFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class HttpSyncTransport implements SyncTransport {
  readonly #baseUrl: string;
  readonly #bearer: string | undefined;
  readonly #fetcher: SyncFetcher;

  constructor(baseUrl: string, options: { bearer?: string; fetcher?: SyncFetcher } = {}) {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Sync endpoint must use HTTP or HTTPS");
    this.#baseUrl = url.toString().replace(/\/$/u, "");
    this.#bearer = options.bearer;
    this.#fetcher = options.fetcher ?? fetch;
  }

  async capabilities() {
    return this.#request<SyncServerCapabilities>("/.well-known/learn-language-sync", { method: "GET" });
  }

  async push(request: Parameters<SyncTransport["push"]>[0]) {
    return this.#request<Awaited<ReturnType<SyncTransport["push"]>>>("/v1/sync/push", { method: "POST", body: JSON.stringify(request) });
  }

  async pull(request: Parameters<SyncTransport["pull"]>[0]) {
    return this.#request<Awaited<ReturnType<SyncTransport["pull"]>>>("/v1/sync/pull", { method: "POST", body: JSON.stringify(request) });
  }

  async #request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body) headers.set("content-type", "application/json");
    if (this.#bearer) headers.set("authorization", `Bearer ${this.#bearer}`);
    const response = await this.#fetcher(`${this.#baseUrl}${path}`, { ...init, headers });
    const data = await response.json() as T | { error?: string };
    if (!response.ok) throw new Error((data as { error?: string }).error ?? `Sync request failed (${response.status})`);
    return data as T;
  }
}

export interface SyncClientStore {
  pendingMutations(): Promise<readonly SyncMutation[]>;
  acknowledge(accepted: readonly SyncAcceptedMutation[]): Promise<void>;
  applyRemote(records: readonly SyncRecord[]): Promise<void>;
  resolveConflicts(conflicts: readonly SyncConflict[], resolution: "keep-local" | "use-remote"): Promise<void>;
  getCursor(): Promise<string | undefined>;
  setCursor(cursor: string): Promise<void>;
}

export interface SyncRunResult {
  pushed: number;
  pulled: number;
  conflicts: readonly SyncConflict[];
  cursor: string;
}

export class SyncCapabilityError extends Error {
  constructor(message: string) { super(message); this.name = "SyncCapabilityError"; }
}

export class SyncClient {
  readonly #transport: SyncTransport;
  readonly #store: SyncClientStore;
  readonly #profileId: string;

  constructor(transport: SyncTransport, store: SyncClientStore, profileId: string) {
    if (!profileId.trim()) throw new Error("profileId is required");
    this.#transport = transport;
    this.#store = store;
    this.#profileId = profileId;
  }

  async discover(requiredResources: readonly SyncResource[] = []): Promise<SyncServerCapabilities> {
    const capabilities = await this.#transport.capabilities();
    if (!capabilities.protocolVersions.includes(SYNC_PROTOCOL_VERSION)) throw new SyncCapabilityError("Sync protocol version is not supported");
    const missing = requiredResources.filter((resource) => !capabilities.resources.includes(resource));
    if (missing.length) throw new SyncCapabilityError(`Sync resources are not supported: ${missing.join(", ")}`);
    return capabilities;
  }

  async run(requiredResources: readonly SyncResource[] = []): Promise<SyncRunResult> {
    const capabilities = await this.discover(requiredResources);
    const pending = [...await this.#store.pendingMutations()];
    const conflicts: SyncConflict[] = [];
    let pushed = 0;
    const cursor = await this.#store.getCursor();
    for (let index = 0; index < pending.length; index += capabilities.maxBatchSize) {
      const batch = pending.slice(index, index + capabilities.maxBatchSize);
      const response = await this.#transport.push({ protocolVersion: SYNC_PROTOCOL_VERSION, profileId: this.#profileId, mutations: batch });
      await this.#store.acknowledge(response.accepted);
      pushed += response.accepted.length;
      conflicts.push(...response.conflicts);
    }

    if (conflicts.length > 0) return { pushed, pulled: 0, conflicts, cursor: cursor ?? "0" };

    let pulled = 0;
    let hasMore = true;
    let nextCursor = cursor;
    while (hasMore) {
      const response = await this.#transport.pull({ protocolVersion: SYNC_PROTOCOL_VERSION, profileId: this.#profileId, ...(nextCursor ? { cursor: nextCursor } : {}), limit: capabilities.maxBatchSize });
      await this.#store.applyRemote(response.records);
      pulled += response.records.length;
      nextCursor = response.cursor;
      hasMore = response.hasMore;
    }
    await this.#store.setCursor(nextCursor ?? "0");
    return { pushed, pulled, conflicts, cursor: nextCursor ?? "0" };
  }

  async resolve(conflicts: readonly SyncConflict[], resolution: "keep-local" | "use-remote", requiredResources: readonly SyncResource[] = []) {
    await this.#store.resolveConflicts(conflicts, resolution);
    return this.run(requiredResources);
  }
}

export class MemorySyncClientStore implements SyncClientStore {
  readonly pending = new Map<string, SyncMutation>();
  readonly records = new Map<string, SyncRecord>();
  cursor?: string;
  constructor(mutations: readonly SyncMutation[] = []) { for (const mutation of mutations) this.pending.set(mutation.mutationId, structuredClone(mutation)); }
  async pendingMutations() { return [...this.pending.values()].map((item) => structuredClone(item)); }
  async acknowledge(accepted: readonly SyncAcceptedMutation[]) { for (const item of accepted) this.pending.delete(item.mutationId); }
  async applyRemote(records: readonly SyncRecord[]) { for (const record of records) this.records.set(`${record.resource}:${record.id}`, structuredClone(record)); }
  async resolveConflicts(conflicts: readonly SyncConflict[], resolution: "keep-local" | "use-remote") {
    for (const conflict of conflicts) {
      const mutation = this.pending.get(conflict.mutationId);
      if (!mutation) continue;
      if (resolution === "use-remote") {
        this.pending.delete(conflict.mutationId);
        if (conflict.current) this.records.set(`${conflict.current.resource}:${conflict.current.id}`, structuredClone(conflict.current));
      } else {
        this.pending.delete(conflict.mutationId);
        const baseVersion = conflict.current?.version ?? 0;
        const rebased = { ...mutation, mutationId: `${mutation.mutationId}-r${baseVersion}`, baseVersion };
        this.pending.set(rebased.mutationId, rebased);
      }
    }
  }
  async getCursor() { return this.cursor; }
  async setCursor(cursor: string) { this.cursor = cursor; }
}
