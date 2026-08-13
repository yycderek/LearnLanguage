import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MemoryDraftRepository,
  MemoryInstalledCourseRepository,
  MemoryLearningProfileRepository,
  MemoryLanguagePackRepository,
  type DraftRepository,
  type InstalledCourseRepository,
  type LanguagePackRepository,
  type LearningProfileRepository,
} from "@learn-language/application/workspace";
import {
  SqliteDraftRepository,
  SqliteInstalledCourseRepository,
  SqliteLearningProfileRepository,
  SqliteLanguagePackRepository,
  japaneseCafeCourse,
  japaneseLanguagePack,
} from "../src/index.js";

type Profile = { courseId: string; updatedAt: string; percent: number };

async function verifyDraft(repository: DraftRepository) {
  expect(await repository.load()).toEqual([]);
  const revisions = [{ draftId: "draft", revision: 1, title: "Title", languageId: "ja", updatedAt: "2026-08-12T00:00:00.000Z", payload: "{}" }];
  await repository.save(revisions);
  expect(await repository.load()).toEqual(revisions);
}

async function verifyLanguagePacks(repository: LanguagePackRepository) {
  await repository.put(japaneseLanguagePack.definition);
  expect((await repository.get("ja"))?.id).toBe("ja");
  expect(await repository.list()).toHaveLength(1);
  await repository.remove("ja");
  expect(await repository.list()).toEqual([]);
}

async function verifyCourses(repository: InstalledCourseRepository) {
  await repository.put(japaneseCafeCourse);
  expect((await repository.get(japaneseCafeCourse.manifest.id))?.manifest.id).toBe(japaneseCafeCourse.manifest.id);
  await repository.remove(japaneseCafeCourse.manifest.id);
  expect(await repository.list()).toEqual([]);
}

async function verifyProfiles(repository: LearningProfileRepository<Profile>) {
  const records = [
    { courseId: "a", updatedAt: "2026-08-12T00:00:00.000Z", percent: 20 },
    { courseId: "b", updatedAt: "2026-08-12T01:00:00.000Z", percent: 80 },
  ];
  await repository.putMany(records);
  expect(await repository.list()).toEqual(records);
}

describe("workspace repository contracts", () => {
  it("keeps memory adapters conformant", async () => {
    await verifyDraft(new MemoryDraftRepository());
    await verifyLanguagePacks(new MemoryLanguagePackRepository());
    await verifyCourses(new MemoryInstalledCourseRepository());
    await verifyProfiles(new MemoryLearningProfileRepository<Profile>());
  });

  it("keeps SQLite adapters conformant across reopen", async () => {
    const directory = mkdtempSync(join(tmpdir(), "learn-language-workspace-"));
    const filename = join(directory, "workspace.sqlite");
    try {
      const draft = new SqliteDraftRepository(filename);
      await verifyDraft(draft);
      draft.close();
      const reopenedDraft = new SqliteDraftRepository(filename);
      expect((await reopenedDraft.load() as unknown[])).toHaveLength(1);
      reopenedDraft.close();

      const packs = new SqliteLanguagePackRepository(filename);
      await verifyLanguagePacks(packs);
      packs.close();
      const courses = new SqliteInstalledCourseRepository(filename);
      await verifyCourses(courses);
      courses.close();
      const profiles = new SqliteLearningProfileRepository<Profile>(filename);
      await verifyProfiles(profiles);
      profiles.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
