import assert from "node:assert/strict";
import test from "node:test";
import {
  forkPublishedCourse,
  publishCourseDraft,
  sampleCourse,
  validateCourse,
} from "../lib/course.ts";

test("publishing creates a stable immutable identity and forking returns a draft", async () => {
  const draft = sampleCourse("ja");
  const first = await publishCourseDraft(draft);
  const second = await publishCourseDraft(draft);

  assert.equal(first.schemaVersion, 2);
  assert.equal(first.manifest.status, "published");
  assert.match(first.manifest.contentHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.manifest.contentHash, second.manifest.contentHash);
  assert.equal(validateCourse(JSON.stringify(first)).issues.length, 0);

  const fork = forkPublishedCourse(first);
  assert.equal(fork.manifest.status, "draft");
  assert.equal(fork.manifest.visibility, "private");
  assert.equal(fork.manifest.contentHash, undefined);
  assert.equal(fork.manifest.source.kind, "forked");
  assert.equal(fork.manifest.source.derivedFromCourseId, first.manifest.id);
});

test("Course Pack v1 is rejected after the explicit prototype reset", () => {
  const legacy = sampleCourse("ja");
  legacy.schemaVersion = 1;
  const result = validateCourse(JSON.stringify(legacy));
  assert.ok(result.issues.some((issue) => issue.path === "/schemaVersion"));
});
