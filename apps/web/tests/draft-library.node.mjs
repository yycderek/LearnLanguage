import assert from "node:assert/strict";
import test from "node:test";
import { sampleCourse } from "../lib/course.ts";
import {
  addDraftRevision,
  draftFileName,
  groupDraftRevisions,
  MAX_DRAFT_FILE_BYTES,
  MAX_DRAFT_REVISIONS,
  nextDraftRevision,
  normalizeDraftHistory,
  parseDraftFile,
  removeDraft,
  serializeDraftFile,
} from "../lib/draft-library.ts";

test("an editable Course Pack survives a draft file round trip", () => {
  const course = sampleCourse("ja");
  const serialized = serializeDraftFile(course);
  const parsed = parseDraftFile(serialized);
  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.course, course);
  assert.equal(parsed.payload, serialized);
  assert.equal(MAX_DRAFT_FILE_BYTES, 5 * 1024 * 1024);
});

test("published, archived, and malformed Course Packs are not imported as editable drafts", () => {
  const published = sampleCourse("ja");
  published.manifest.status = "published";
  published.manifest.contentHash = "sha256:test";
  published.manifest.languageAdapter = { id: "builtin.ja", version: "1" };
  published.manifest.license = { id: "CC-BY-4.0" };
  assert.equal(parseDraftFile(JSON.stringify(published)).error, "not-editable");

  const archived = sampleCourse("ja");
  archived.manifest.status = "archived";
  assert.equal(parseDraftFile(JSON.stringify(archived)).error, "not-editable");

  const unknown = sampleCourse("ja");
  unknown.manifest.status = "unknown";
  assert.equal(parseDraftFile(JSON.stringify(unknown)).error, "not-editable");

  const malformed = parseDraftFile("not json");
  assert.equal(malformed.error, "invalid-course");
  assert.ok(malformed.issues.length > 0);
});

test("draft revisions are normalized, grouped, and ordered deterministically", () => {
  const course = sampleCourse("ja");
  const payload = serializeDraftFile(course);
  const a1 = nextDraftRevision([], course, payload, "draft-a", "2026-08-10T10:00:00.000Z");
  const b1 = nextDraftRevision([], course, payload, "draft-b", "2026-08-11T09:00:00.000Z");
  const a2 = nextDraftRevision([a1], course, payload, "draft-a", "2026-08-11T11:00:00.000Z");
  const normalized = normalizeDraftHistory([a1, { ...a1, draftId: "damaged", payload: "not json" }, { broken: true }, b1, a2]);
  assert.deepEqual(normalized.map((item) => `${item.draftId}:${item.revision}`), ["draft-a:2", "draft-b:1", "draft-a:1"]);

  const groups = groupDraftRevisions(normalized);
  assert.deepEqual(groups.map((group) => group.draftId), ["draft-a", "draft-b"]);
  assert.deepEqual(groups[0].revisions.map((item) => item.revision), [2, 1]);
  assert.equal(groups[0].latest, a2);
});

test("adding, replacing, limiting, and removing revisions keeps draft identities isolated", () => {
  const course = sampleCourse("ja");
  const payload = serializeDraftFile(course);
  let history = [];
  for (let index = 0; index < MAX_DRAFT_REVISIONS + 4; index += 1) {
    const item = nextDraftRevision(history, course, payload, "draft-a", new Date(Date.UTC(2026, 7, 1, 0, index)).toISOString());
    history = addDraftRevision(history, item);
  }
  assert.equal(history.length, MAX_DRAFT_REVISIONS);
  assert.equal(history[0].revision, MAX_DRAFT_REVISIONS + 4);

  const replacement = { ...history[0], title: "Replacement" };
  history = addDraftRevision(history, replacement);
  assert.equal(history.filter((item) => item.revision === replacement.revision).length, 1);
  assert.equal(history[0].title, "Replacement");
  assert.deepEqual(removeDraft(history, "draft-a"), []);
});

test("draft export filenames remove unsafe path characters", () => {
  const course = sampleCourse("ja");
  const item = nextDraftRevision([], course, serializeDraftFile(course), "draft-a");
  item.title = "../../unsafe course / 日本語";
  assert.equal(draftFileName(item), "unsafe-course-日本語-v1.draft.json");
  assert.doesNotMatch(draftFileName(item), /[\\/ ]/u);
});
