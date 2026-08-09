import assert from "node:assert/strict";
import test from "node:test";
import {
  forkPublishedCourse,
  publishCourseDraft,
  sampleCourse,
  validateCourse,
  verifyPublishedCourseIntegrity,
} from "../lib/course.ts";

test("publishing creates a stable immutable identity and forking returns a draft", async () => {
  const draft = sampleCourse("ja");
  draft.manifest.license = { id: "CC-BY-4.0", url: "https://creativecommons.org/licenses/by/4.0/" };
  const first = await publishCourseDraft(draft);
  const second = await publishCourseDraft(draft);

  assert.equal(first.schemaVersion, 2);
  assert.equal(first.manifest.status, "published");
  assert.equal(first.manifest.license.id, "CC-BY-4.0");
  assert.match(first.manifest.contentHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.manifest.contentHash, second.manifest.contentHash);
  assert.equal(validateCourse(JSON.stringify(first)).issues.length, 0);
  assert.equal((await verifyPublishedCourseIntegrity(first)).valid, true);

  const tampered = structuredClone(first);
  tampered.manifest.title["zh-CN"] = "被篡改的标题";
  assert.equal((await verifyPublishedCourseIntegrity(tampered)).valid, false);

  const fork = forkPublishedCourse(first);
  assert.equal(fork.manifest.status, "draft");
  assert.equal(fork.manifest.visibility, "private");
  assert.equal(fork.manifest.contentHash, undefined);
  assert.equal(fork.manifest.source.kind, "forked");
  assert.equal(fork.manifest.source.derivedFromCourseId, first.manifest.id);
});

test("publishing rejects a draft without an explicit content license", async () => {
  const draft = sampleCourse("ja");
  delete draft.manifest.license;
  await assert.rejects(() => publishCourseDraft(draft), /许可证/);
});

test("Course Pack v1 is rejected after the explicit prototype reset", () => {
  const legacy = sampleCourse("ja");
  legacy.schemaVersion = 1;
  const result = validateCourse(JSON.stringify(legacy));
  assert.ok(result.issues.some((issue) => issue.path === "/schemaVersion"));
});
