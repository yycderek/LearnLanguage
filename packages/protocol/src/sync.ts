export const SYNC_PROTOCOL_VERSION = 1 as const;

export type SyncResource =
  | "session-events"
  | "learning-records"
  | "installed-courses"
  | "course-drafts"
  | "language-packs";

export type SyncAuthMode = "none" | "bearer";

export type SyncJsonValue =
  | null
  | boolean
  | number
  | string
  | SyncJsonValue[]
  | { [key: string]: SyncJsonValue };

export interface SyncServerCapabilities {
  protocolVersions: readonly number[];
  serverId: string;
  authModes: readonly SyncAuthMode[];
  accountOptional: boolean;
  resources: readonly SyncResource[];
  conflictPolicy: "reject-stale";
  maxBatchSize: number;
  serverTime: string;
}

export interface SyncRecord {
  resource: SyncResource;
  id: string;
  version: number;
  deviceId: string;
  updatedAt: string;
  deleted: boolean;
  payload?: SyncJsonValue;
}

export interface SyncMutation {
  mutationId: string;
  resource: SyncResource;
  id: string;
  baseVersion: number;
  deviceId: string;
  updatedAt: string;
  deleted: boolean;
  payload?: SyncJsonValue;
}

export interface SyncPushRequest {
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  profileId: string;
  mutations: readonly SyncMutation[];
}

export interface SyncAcceptedMutation {
  mutationId: string;
  resource: SyncResource;
  id: string;
  version: number;
}

export interface SyncConflict {
  mutationId: string;
  current?: SyncRecord;
}

export interface SyncPushResponse {
  accepted: readonly SyncAcceptedMutation[];
  conflicts: readonly SyncConflict[];
  cursor: string;
}

export interface SyncPullRequest {
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  profileId: string;
  cursor?: string;
  limit?: number;
}

export interface SyncPullResponse {
  records: readonly SyncRecord[];
  cursor: string;
  hasMore: boolean;
}

export interface SyncTransport {
  capabilities(): Promise<SyncServerCapabilities>;
  push(request: SyncPushRequest): Promise<SyncPushResponse>;
  pull(request: SyncPullRequest): Promise<SyncPullResponse>;
}
