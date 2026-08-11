import type { CoursePack, ImportIssue } from "@learn-language/protocol";
import { displayText, validateCourse } from "./course.ts";

export const MAX_DRAFT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_DRAFT_REVISIONS = 24;

export type DraftRevision = {
  draftId: string;
  revision: number;
  title: string;
  languageId: string;
  updatedAt: string;
  payload: string;
};

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

function isDraftRevision(value: unknown): value is DraftRevision {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DraftRevision>;
  return typeof item.draftId === "string" && item.draftId.length > 0
    && Number.isInteger(item.revision) && Number(item.revision) > 0
    && typeof item.title === "string" && item.title.length > 0
    && typeof item.languageId === "string" && item.languageId.length > 0
    && typeof item.updatedAt === "string" && Number.isFinite(Date.parse(item.updatedAt))
    && typeof item.payload === "string"
    && Boolean(parseDraftFile(item.payload).course);
}

export function normalizeDraftHistory(value: unknown): DraftRevision[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isDraftRevision)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, MAX_DRAFT_REVISIONS);
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
