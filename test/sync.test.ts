import { describe, expect, it } from "vitest";
import { SYNC_PROTOCOL_VERSION, type SyncMutation } from "@learn-language/protocol";
import { ReferenceSyncService, createReferenceSyncHandler } from "../packages/sync/src/index.js";

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
});
