import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SYNC_PROTOCOL_VERSION, type SyncMutation } from "@learn-language/protocol";
import {
  MemorySyncClientStore,
  ReferenceSyncService,
  SyncClient,
  createReferenceSyncHandler,
} from "../packages/sync/src/index.js";
import { SqliteReferenceSyncStateStore } from "../packages/sync/src/sqlite.js";

const firstMutation: SyncMutation = {
  mutationId: "mutation-1",
  resource: "learning-records",
  id: "course-1",
  baseVersion: 0,
  deviceId: "device-a",
  updatedAt: "2026-08-09T12:00:00.000Z",
  deleted: false,
  payload: { percent: 25 },
};

describe("public sync protocol reference service", () => {
  it("discovers account-optional capabilities", async () => {
    const service = new ReferenceSyncService({ now: () => "2026-08-09T12:00:00.000Z" });
    await expect(service.capabilities()).resolves.toEqual(expect.objectContaining({
      protocolVersions: [1],
      authModes: ["none"],
      accountOptional: true,
      conflictPolicy: "reject-stale",
    }));
  });

  it("pushes, pulls, and deduplicates mutations", async () => {
    const service = new ReferenceSyncService();
    const request = { protocolVersion: SYNC_PROTOCOL_VERSION, profileId: "local-profile", mutations: [firstMutation] };
    const first = await service.push(request);
    const replay = await service.push(request);
    expect(first.accepted).toEqual(replay.accepted);
    expect(first.cursor).toBe("1");
    expect(replay.cursor).toBe("1");

    const pulled = await service.pull({ protocolVersion: SYNC_PROTOCOL_VERSION, profileId: "local-profile" });
    expect(pulled.records).toEqual([expect.objectContaining({ id: "course-1", version: 1, payload: { percent: 25 } })]);
  });

  it("rejects stale writes and returns the current record", async () => {
    const service = new ReferenceSyncService();
    await service.push({ protocolVersion: SYNC_PROTOCOL_VERSION, profileId: "profile", mutations: [firstMutation] });
    const stale = await service.push({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      profileId: "profile",
      mutations: [{ ...firstMutation, mutationId: "mutation-2", deviceId: "device-b", payload: { percent: 10 } }],
    });
    expect(stale.accepted).toEqual([]);
    expect(stale.conflicts[0]?.current).toEqual(expect.objectContaining({ version: 1, payload: { percent: 25 } }));
  });

  it("exposes capability, push, and pull HTTP endpoints", async () => {
    const handle = createReferenceSyncHandler(new ReferenceSyncService());
    const capabilityResponse = await handle(new Request("https://sync.example/.well-known/learn-language-sync"));
    expect(capabilityResponse.status).toBe(200);
    expect(await capabilityResponse.json()).toEqual(expect.objectContaining({ accountOptional: true }));

    const invalidVersion = await handle(new Request("https://sync.example/v1/sync/pull", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ protocolVersion: 99, profileId: "profile" }),
    }));
    expect(invalidVersion.status).toBe(409);

    const invalidBody = await handle(new Request("https://sync.example/v1/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
    }));
    expect(invalidBody.status).toBe(400);
  });

  it("rejects a cursor ahead of server state to avoid silent data loss", async () => {
    const service = new ReferenceSyncService();
    await expect(service.pull({ protocolVersion: SYNC_PROTOCOL_VERSION, profileId: "profile", cursor: "10" }))
      .rejects.toThrow("cursor is ahead");
  });

  it("runs discovery, batched push, pull, and acknowledgement through the client", async () => {
    const service = new ReferenceSyncService({ maxBatchSize: 1 });
    const local = new MemorySyncClientStore([firstMutation, {
      ...firstMutation,
      mutationId: "mutation-2",
      id: "course-2",
    }]);
    const result = await new SyncClient(service, local, "profile").run(["learning-records"]);
    expect(result).toMatchObject({ pushed: 2, conflicts: [], cursor: "2" });
    expect(local.pending.size).toBe(0);
    expect(local.records.size).toBe(2);

    const secondDevice = new MemorySyncClientStore();
    const pulled = await new SyncClient(service, secondDevice, "profile").run(["learning-records"]);
    expect(pulled.pulled).toBe(2);
    expect(secondDevice.records.size).toBe(2);
  });

  it("persists reference sync state in SQLite across service restarts", async () => {
    const directory = mkdtempSync(join(tmpdir(), "learn-language-sync-"));
    const filename = join(directory, "sync.sqlite");
    try {
      const firstStore = new SqliteReferenceSyncStateStore(filename);
      const firstService = new ReferenceSyncService({ store: firstStore });
      await firstService.push({ protocolVersion: SYNC_PROTOCOL_VERSION, profileId: "profile", mutations: [firstMutation] });
      firstStore.close();

      const reopenedStore = new SqliteReferenceSyncStateStore(filename);
      const reopenedService = new ReferenceSyncService({ store: reopenedStore });
      expect((await reopenedService.pull({ protocolVersion: SYNC_PROTOCOL_VERSION, profileId: "profile" })).records)
        .toEqual([expect.objectContaining({ id: "course-1", version: 1 })]);
      reopenedStore.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("requires an explicit conflict resolution before rebasing a local change", async () => {
    const service = new ReferenceSyncService();
    await service.push({ protocolVersion: SYNC_PROTOCOL_VERSION, profileId: "profile", mutations: [firstMutation] });
    const local = new MemorySyncClientStore([{ ...firstMutation, mutationId: "stale-local", deviceId: "device-b", payload: { percent: 90 } }]);
    const client = new SyncClient(service, local, "profile");
    const conflicted = await client.run(["learning-records"]);
    expect(conflicted.conflicts).toHaveLength(1);
    expect(conflicted.pulled).toBe(0);
    expect(local.pending.size).toBe(1);

    const resolved = await client.resolve(conflicted.conflicts, "keep-local", ["learning-records"]);
    expect(resolved.conflicts).toEqual([]);
    expect(resolved.pushed).toBe(1);
    expect((await service.pull({ protocolVersion: SYNC_PROTOCOL_VERSION, profileId: "profile" })).records.at(-1))
      .toEqual(expect.objectContaining({ version: 2, payload: { percent: 90 } }));
  });
});
