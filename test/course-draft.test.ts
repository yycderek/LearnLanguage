import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CourseDraftService,
  DraftConcurrencyError,
  DraftOwnershipError,
  DraftPolicyError,
  MemoryCourseDraftStore,
  SqliteCourseDraftStore,
  japaneseCafeCourse,
  type CoursePack,
} from "../src/index.js";

function privateCourse(ownerId = "owner-1"): CoursePack {
  return {
    ...japaneseCafeCourse,
    manifest: {
      ...japaneseCafeCourse.manifest,
      id: `user.${ownerId}.cafe-request`,
      author: { id: ownerId, displayName: "Course owner" },
      visibility: "private",
      status: "draft",
      source: { kind: "original" },
    },
  };
}

describe("private course drafts", () => {
  it("creates immutable revisions and returns their history", async () => {
    const service = new CourseDraftService(new MemoryCourseDraftStore());
    const created = await service.create({
      draftId: "draft-1",
      ownerId: "owner-1",
      course: privateCourse(),
      occurredAt: "2026-08-04T10:00:00.000Z",
    });
    const updatedCourse = {
      ...created.course,
      manifest: {
        ...created.course.manifest,
        title: { "zh-CN": "更新后的咖啡店课程" },
      },
    };
    const updated = await service.update({
      draftId: "draft-1",
      ownerId: "owner-1",
      expectedRevision: 1,
      course: updatedCourse,
      occurredAt: "2026-08-04T10:05:00.000Z",
      changeSummary: "Update course title",
    });

    expect(created.revision).toBe(1);
    expect(updated.revision).toBe(2);
    expect(await service.history("draft-1", "owner-1")).toEqual([
      created,
      updated,
    ]);
    expect((await service.list("owner-1"))[0]).toEqual(updated);
  });

  it("rejects stale updates and access by another owner", async () => {
    const service = new CourseDraftService(new MemoryCourseDraftStore());
    await service.create({
      draftId: "draft-1",
      ownerId: "owner-1",
      course: privateCourse(),
      occurredAt: "2026-08-04T10:00:00.000Z",
    });

    await expect(
      service.update({
        draftId: "draft-1",
        ownerId: "owner-1",
        expectedRevision: 0,
        course: privateCourse(),
        occurredAt: "2026-08-04T10:01:00.000Z",
        changeSummary: "Stale update",
      }),
    ).rejects.toBeInstanceOf(DraftConcurrencyError);
    await expect(service.get("draft-1", "owner-2")).rejects.toBeInstanceOf(
      DraftOwnershipError,
    );
  });

  it("requires user-authored courses to start as private drafts", async () => {
    const service = new CourseDraftService(new MemoryCourseDraftStore());

    await expect(
      service.create({
        draftId: "draft-1",
        ownerId: "learn-language",
        course: japaneseCafeCourse,
        occurredAt: "2026-08-04T10:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(DraftPolicyError);
  });

  it("keeps course identity and target language stable across revisions", async () => {
    const service = new CourseDraftService(new MemoryCourseDraftStore());
    const created = await service.create({
      draftId: "draft-1",
      ownerId: "owner-1",
      course: privateCourse(),
      occurredAt: "2026-08-04T10:00:00.000Z",
    });
    const changedIdentity = {
      ...created.course,
      manifest: { ...created.course.manifest, id: "user.owner-1.renamed" },
    };

    await expect(
      service.update({
        draftId: "draft-1",
        ownerId: "owner-1",
        expectedRevision: 1,
        course: changedIdentity,
        occurredAt: "2026-08-04T10:01:00.000Z",
        changeSummary: "Rename course id",
      }),
    ).rejects.toThrow("Course id cannot change between revisions");
  });

  it("restores the latest draft and history after reopening SQLite", async () => {
    const directory = mkdtempSync(join(tmpdir(), "learn-language-drafts-"));
    const filename = join(directory, "drafts.sqlite");

    try {
      const firstStore = new SqliteCourseDraftStore(filename);
      const firstService = new CourseDraftService(firstStore);
      const created = await firstService.create({
        draftId: "persistent-draft",
        ownerId: "owner-1",
        course: privateCourse(),
        occurredAt: "2026-08-04T11:00:00.000Z",
      });
      firstStore.close();

      const reopenedStore = new SqliteCourseDraftStore(filename);
      const reopenedService = new CourseDraftService(reopenedStore);
      expect(await reopenedService.get("persistent-draft", "owner-1")).toEqual(
        created,
      );
      expect(
        await reopenedService.history("persistent-draft", "owner-1"),
      ).toEqual([created]);
      reopenedStore.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
