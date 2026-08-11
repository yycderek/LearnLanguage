import { MAX_DRAFT_REVISIONS, normalizeDraftRevisions, type DraftRevisionRecord } from "@learn-language/application/workspace";
import type { CoursePack, ImportIssue } from "@learn-language/protocol";
import { displayText, validateCourse } from "./course.ts";

export const MAX_DRAFT_FILE_BYTES = 5 * 1024 * 1024;
export { MAX_DRAFT_REVISIONS };

export type DraftRevision = DraftRevisionRecord;

export type DraftGroup = {
  draftId: string;
  latest: DraftRevision;
  revisions: DraftRevision[];
};

export type DraftFileError = "invalid-course" | "not-editable";

export type DraftFileImportResult = {
  course?: CoursePack;
  payload?: string;
  error?: DraftFileError;
  issues?: ImportIssue[];
};

export function normalizeDraftHistory(value: unknown): DraftRevision[] {
  return normalizeDraftRevisions(value).filter((item) => Boolean(parseDraftFile(item.payload).course));
}

export function groupDraftRevisions(history: DraftRevision[]): DraftGroup[] {
  const groups = new Map<string, DraftRevision[]>();
  for (const item of normalizeDraftHistory(history)) {
    const revisions = groups.get(item.draftId) ?? [];
    revisions.push(item);
    groups.set(item.draftId, revisions);
  }
  return [...groups.entries()].map(([draftId, revisions]) => {
    revisions.sort((left, right) => right.revision - left.revision || Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
    return { draftId, latest: revisions[0], revisions };
  }).sort((left, right) => Date.parse(right.latest.updatedAt) - Date.parse(left.latest.updatedAt));
}

export function addDraftRevision(history: DraftRevision[], item: DraftRevision): DraftRevision[] {
  return normalizeDraftHistory([item, ...history.filter((candidate) =>
    candidate.draftId !== item.draftId || candidate.revision !== item.revision)]);
}

export function removeDraft(history: DraftRevision[], draftId: string): DraftRevision[] {
  return history.filter((item) => item.draftId !== draftId);
}

export function nextDraftRevision(
  history: DraftRevision[],
  course: CoursePack,
  payload: string,
  draftId: string,
  updatedAt = new Date().toISOString(),
): DraftRevision {
  const revision = history
    .filter((item) => item.draftId === draftId)
    .reduce((maximum, item) => Math.max(maximum, item.revision), 0) + 1;
  return {
    draftId,
    revision,
    title: displayText(course.manifest.title),
    languageId: course.manifest.languageId,
    updatedAt,
    payload,
  };
}

export function parseDraftFile(text: string): DraftFileImportResult {
  const validated = validateCourse(text);
  if (!validated.course) return { error: "invalid-course", issues: validated.issues };
  if (validated.course.manifest.status !== "draft" && validated.course.manifest.status !== "validated") {
    return { error: "not-editable" };
  }
  return {
    course: validated.course,
    payload: serializeDraftFile(validated.course),
  };
}

export function draftFileName(item: DraftRevision) {
  const safeTitle = item.title.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^[.-]+|[.-]+$/gu, "") || "course-draft";
  return `${safeTitle}-v${item.revision}.draft.json`;
}

export function serializeDraftFile(course: CoursePack) {
  return `${JSON.stringify(course, null, 2)}\n`;
}
