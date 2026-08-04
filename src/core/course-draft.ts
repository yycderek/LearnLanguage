import { importCoursePack } from "./course-import.js";
import type { CoursePack } from "./types.js";

export interface CourseDraftVersion {
  readonly draftId: string;
  readonly ownerId: string;
  readonly revision: number;
  readonly course: CoursePack;
  readonly createdAt: string;
  readonly changeSummary: string;
}

export interface CourseDraftStore {
  append(
    version: CourseDraftVersion,
    expectedRevision: number,
  ): Promise<void>;
  loadLatest(draftId: string): Promise<CourseDraftVersion | undefined>;
  loadHistory(draftId: string): Promise<readonly CourseDraftVersion[]>;
  listByOwner(ownerId: string): Promise<readonly CourseDraftVersion[]>;
}

export class DraftConcurrencyError extends Error {
  constructor(
    readonly draftId: string,
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      `Draft ${draftId} expected revision ${expectedRevision}, actual revision is ${actualRevision}`,
    );
    this.name = "DraftConcurrencyError";
  }
}

export class DraftNotFoundError extends Error {
  constructor(readonly draftId: string) {
    super(`Draft not found: ${draftId}`);
    this.name = "DraftNotFoundError";
  }
}

export class DraftOwnershipError extends Error {
  constructor(readonly draftId: string) {
    super(`The caller does not own draft: ${draftId}`);
    this.name = "DraftOwnershipError";
  }
}

export class DraftPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftPolicyError";
  }
}

function cloneVersion(version: CourseDraftVersion): CourseDraftVersion {
  return structuredClone(version);
}

function assertPrivateDraft(ownerId: string, course: CoursePack): void {
  if (course.manifest.visibility !== "private") {
    throw new DraftPolicyError("User-authored drafts must be private");
  }
  if (course.manifest.status !== "draft") {
    throw new DraftPolicyError("User-authored courses must start as drafts");
  }
  if (course.manifest.author.id !== ownerId) {
    throw new DraftPolicyError(
      "Course manifest author must match the draft owner",
    );
  }
}

function assertCommandMetadata(
  draftId: string,
  ownerId: string,
  occurredAt: string,
  changeSummary?: string,
): void {
  if (!draftId.trim()) {
    throw new DraftPolicyError("Draft id is required");
  }
  if (!ownerId.trim()) {
    throw new DraftPolicyError("Draft owner is required");
  }
  if (!Number.isFinite(Date.parse(occurredAt))) {
    throw new DraftPolicyError("Draft timestamp must be a valid ISO date");
  }
  if (changeSummary !== undefined && !changeSummary.trim()) {
    throw new DraftPolicyError("Change summary cannot be empty");
  }
}

function assertStableIdentity(current: CoursePack, next: CoursePack): void {
  if (current.manifest.id !== next.manifest.id) {
    throw new DraftPolicyError("Course id cannot change between revisions");
  }
  if (current.manifest.languageId !== next.manifest.languageId) {
    throw new DraftPolicyError(
      "Course language cannot change between revisions",
    );
  }
}

export class MemoryCourseDraftStore implements CourseDraftStore {
  readonly #versions = new Map<string, CourseDraftVersion[]>();

  async append(
    version: CourseDraftVersion,
    expectedRevision: number,
  ): Promise<void> {
    const history = this.#versions.get(version.draftId) ?? [];
    const actualRevision = history.at(-1)?.revision ?? 0;
    if (actualRevision !== expectedRevision) {
      throw new DraftConcurrencyError(
        version.draftId,
        expectedRevision,
        actualRevision,
      );
    }
    if (version.revision !== expectedRevision + 1) {
      throw new Error(
        `New draft revision must be ${expectedRevision + 1}, received ${version.revision}`,
      );
    }
    if (history[0] && history[0].ownerId !== version.ownerId) {
      throw new DraftOwnershipError(version.draftId);
    }

    this.#versions.set(version.draftId, [...history, cloneVersion(version)]);
  }

  async loadLatest(draftId: string): Promise<CourseDraftVersion | undefined> {
    const latest = this.#versions.get(draftId)?.at(-1);
    return latest ? cloneVersion(latest) : undefined;
  }

  async loadHistory(draftId: string): Promise<readonly CourseDraftVersion[]> {
    return (this.#versions.get(draftId) ?? []).map(cloneVersion);
  }

  async listByOwner(ownerId: string): Promise<readonly CourseDraftVersion[]> {
    return [...this.#versions.values()]
      .map((history) => history.at(-1))
      .filter(
        (version): version is CourseDraftVersion =>
          version !== undefined && version.ownerId === ownerId,
      )
      .map(cloneVersion)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}

export interface CreateCourseDraftCommand {
  readonly draftId: string;
  readonly ownerId: string;
  readonly course: string | unknown;
  readonly occurredAt: string;
  readonly changeSummary?: string;
}

export interface UpdateCourseDraftCommand {
  readonly draftId: string;
  readonly ownerId: string;
  readonly expectedRevision: number;
  readonly course: string | unknown;
  readonly occurredAt: string;
  readonly changeSummary: string;
}

export class CourseDraftService {
  constructor(private readonly store: CourseDraftStore) {}

  async create(
    command: CreateCourseDraftCommand,
  ): Promise<CourseDraftVersion> {
    assertCommandMetadata(
      command.draftId,
      command.ownerId,
      command.occurredAt,
      command.changeSummary,
    );
    const course = importCoursePack(command.course);
    assertPrivateDraft(command.ownerId, course);

    const version: CourseDraftVersion = {
      draftId: command.draftId,
      ownerId: command.ownerId,
      revision: 1,
      course,
      createdAt: command.occurredAt,
      changeSummary: command.changeSummary ?? "Create course draft",
    };
    await this.store.append(version, 0);
    return cloneVersion(version);
  }

  async update(
    command: UpdateCourseDraftCommand,
  ): Promise<CourseDraftVersion> {
    assertCommandMetadata(
      command.draftId,
      command.ownerId,
      command.occurredAt,
      command.changeSummary,
    );
    const current = await this.get(command.draftId, command.ownerId);
    if (current.revision !== command.expectedRevision) {
      throw new DraftConcurrencyError(
        command.draftId,
        command.expectedRevision,
        current.revision,
      );
    }

    const course = importCoursePack(command.course);
    assertPrivateDraft(command.ownerId, course);
    assertStableIdentity(current.course, course);
    const version: CourseDraftVersion = {
      draftId: command.draftId,
      ownerId: command.ownerId,
      revision: current.revision + 1,
      course,
      createdAt: command.occurredAt,
      changeSummary: command.changeSummary,
    };
    await this.store.append(version, command.expectedRevision);
    return cloneVersion(version);
  }

  async get(draftId: string, ownerId: string): Promise<CourseDraftVersion> {
    const draft = await this.store.loadLatest(draftId);
    if (!draft) {
      throw new DraftNotFoundError(draftId);
    }
    if (draft.ownerId !== ownerId) {
      throw new DraftOwnershipError(draftId);
    }
    return draft;
  }

  async history(
    draftId: string,
    ownerId: string,
  ): Promise<readonly CourseDraftVersion[]> {
    await this.get(draftId, ownerId);
    return this.store.loadHistory(draftId);
  }

  async list(ownerId: string): Promise<readonly CourseDraftVersion[]> {
    return this.store.listByOwner(ownerId);
  }
}
