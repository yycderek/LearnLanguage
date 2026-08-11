import { describe, expect, it } from "vitest";
import {
  BuiltInLanguagePackMutationError,
  CourseLanguageCompatibilityError,
  CourseLibraryApplicationService,
  CourseNotPublishedError,
  DraftApplicationService,
  LanguagePackApplicationService,
  LanguagePackInUseError,
  MemoryDraftRepository,
  MemoryInstalledCourseRepository,
  MemoryLearningProfileRepository,
  MemoryLanguagePackRepository,
  ProfileBackupApplicationService,
  languagePackReferenceUsage,
} from "@learn-language/application";
import { japaneseCafeCourse, japaneseLanguagePack } from "../src/index.js";

describe("client-independent workspace services", () => {
  it("owns draft revision numbering, retention, and deletion", async () => {
    const repository = new MemoryDraftRepository();
    const service = new DraftApplicationService(repository);
    const first = await service.saveRevision({
      draftId: "draft-1", title: "Course", languageId: "ja", payload: "{}", updatedAt: "2026-08-11T10:00:00.000Z",
    });
    const second = await service.saveRevision({
      draftId: "draft-1", title: "Course", languageId: "ja", payload: "{}", updatedAt: "2026-08-11T11:00:00.000Z",
    });
    expect(first.revision.revision).toBe(1);
    expect(second.revision.revision).toBe(2);
    expect((await service.list()).map((item) => item.revision)).toEqual([2, 1]);
    expect(await service.deleteDraft("draft-1")).toEqual([]);
  });

  it("protects built-in and referenced Language Packs in the service layer", async () => {
    const repository = new MemoryLanguagePackRepository();
    const service = new LanguagePackApplicationService(repository, ["ja"]);
    await expect(service.import(japaneseLanguagePack.definition)).rejects.toBeInstanceOf(BuiltInLanguagePackMutationError);

    const custom = { ...japaneseLanguagePack.definition, id: "custom-ja" };
    await service.import(custom);
    expect((await repository.get(custom.id))?.id).toBe(custom.id);
    const usage = languagePackReferenceUsage(custom.id, custom.id, [custom.id], []);
    await expect(service.remove(custom.id, usage)).rejects.toBeInstanceOf(LanguagePackInUseError);
    await service.remove(custom.id, languagePackReferenceUsage(custom.id, undefined, [], []));
    expect(await repository.get(custom.id)).toBeUndefined();
  });

  it("refuses course installation when the injected runtime policy blocks it", async () => {
    const repository = new MemoryInstalledCourseRepository();
    const publishedCourse = structuredClone(japaneseCafeCourse);
    publishedCourse.manifest.status = "published";
    const blocked = new CourseLibraryApplicationService(repository, { assess: () => ({ status: "blocked", issues: ["missing-runtime"] }) });
    await expect(blocked.install(publishedCourse)).rejects.toBeInstanceOf(CourseLanguageCompatibilityError);
    expect(await repository.get(publishedCourse.manifest.id)).toBeUndefined();

    const degraded = new CourseLibraryApplicationService(repository, { assess: () => ({ status: "degraded", issues: ["fallback"] }) });
    expect((await degraded.install(publishedCourse)).status).toBe("degraded");
    expect(await repository.get(publishedCourse.manifest.id)).toBe(publishedCourse);

    const draft = structuredClone(japaneseCafeCourse);
    draft.manifest.status = "draft";
    await expect(degraded.install(draft)).rejects.toBeInstanceOf(CourseNotPublishedError);
  });

  it("restores profile projections with newer-wins semantics through one repository boundary", async () => {
    type Record = { courseId: string; updatedAt: string; value: number };
    const repository = new MemoryLearningProfileRepository<Record>([
      { courseId: "a", updatedAt: "2026-08-11T11:00:00.000Z", value: 2 },
    ]);
    const service = new ProfileBackupApplicationService(repository);
    const result = await service.restore([
      { courseId: "a", updatedAt: "2026-08-11T10:00:00.000Z", value: 1 },
      { courseId: "b", updatedAt: "2026-08-11T12:00:00.000Z", value: 3 },
    ]);
    expect(result).toMatchObject({ added: 1, replaced: 0, skipped: 1 });
    expect(result.records.a?.value).toBe(2);
    expect(result.records.b?.value).toBe(3);
  });
});
