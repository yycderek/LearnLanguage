import type { CoursePack, LanguageDefinition } from "@learn-language/protocol";

export const MAX_DRAFT_REVISIONS = 24;

export interface DraftRevisionRecord {
  draftId: string;
  revision: number;
  title: string;
  languageId: string;
  updatedAt: string;
  payload: string;
}

export interface DraftRepository {
  load(): Promise<unknown>;
  save(revisions: readonly DraftRevisionRecord[]): Promise<void>;
}

export interface SaveDraftRevisionCommand {
  draftId: string;
  title: string;
  languageId: string;
  payload: string;
  updatedAt: string;
}

function isDraftRevision(value: unknown): value is DraftRevisionRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DraftRevisionRecord>;
  return typeof item.draftId === "string" && item.draftId.length > 0
    && Number.isInteger(item.revision) && Number(item.revision) > 0
    && typeof item.title === "string" && item.title.length > 0
    && typeof item.languageId === "string" && item.languageId.length > 0
    && typeof item.updatedAt === "string" && Number.isFinite(Date.parse(item.updatedAt))
    && typeof item.payload === "string";
}

export function normalizeDraftRevisions(value: unknown): DraftRevisionRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isDraftRevision)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, MAX_DRAFT_REVISIONS);
}

export class DraftApplicationService {
  private readonly drafts: DraftRepository;
  constructor(drafts: DraftRepository) { this.drafts = drafts; }

  async list(): Promise<DraftRevisionRecord[]> {
    return normalizeDraftRevisions(await this.drafts.load());
  }

  async saveRevision(command: SaveDraftRevisionCommand): Promise<{ revision: DraftRevisionRecord; history: DraftRevisionRecord[] }> {
    const history = await this.list();
    const revisionNumber = history
      .filter((item) => item.draftId === command.draftId)
      .reduce((maximum, item) => Math.max(maximum, item.revision), 0) + 1;
    const revision: DraftRevisionRecord = { ...command, revision: revisionNumber };
    const next = normalizeDraftRevisions([
      revision,
      ...history.filter((item) => item.draftId !== revision.draftId || item.revision !== revision.revision),
    ]);
    await this.drafts.save(next);
    return { revision, history: next };
  }

  async deleteDraft(draftId: string): Promise<DraftRevisionRecord[]> {
    const next = (await this.list()).filter((item) => item.draftId !== draftId);
    await this.drafts.save(next);
    return next;
  }
}

export interface LanguagePackRepository {
  list(): Promise<readonly LanguageDefinition[]>;
  get(languageId: string): Promise<LanguageDefinition | undefined>;
  put(pack: LanguageDefinition): Promise<void>;
  remove(languageId: string): Promise<void>;
}

export interface LanguagePackReferenceUsage {
  activeEditor: boolean;
  draftCount: number;
  installedCourseCount: number;
  canDelete: boolean;
}

export function languagePackReferenceUsage(
  languageId: string,
  activeLanguageId: string | undefined,
  draftLanguageIds: readonly string[],
  installedLanguageIds: readonly string[],
): LanguagePackReferenceUsage {
  const draftCount = draftLanguageIds.filter((id) => id === languageId).length;
  const installedCourseCount = installedLanguageIds.filter((id) => id === languageId).length;
  const activeEditor = activeLanguageId === languageId;
  return { activeEditor, draftCount, installedCourseCount, canDelete: !activeEditor && draftCount === 0 && installedCourseCount === 0 };
}

export class BuiltInLanguagePackMutationError extends Error {
  readonly languageId: string;
  constructor(languageId: string) {
    super(`Built-in Language Pack cannot be changed: ${languageId}`);
    this.languageId = languageId;
    this.name = "BuiltInLanguagePackMutationError";
  }
}

export class LanguagePackAlreadyExistsError extends Error {
  readonly languageId: string;
  constructor(languageId: string) {
    super(`Language Pack already exists: ${languageId}`);
    this.languageId = languageId;
    this.name = "LanguagePackAlreadyExistsError";
  }
}

export class LanguagePackInUseError extends Error {
  readonly languageId: string;
  readonly usage: LanguagePackReferenceUsage;
  constructor(languageId: string, usage: LanguagePackReferenceUsage) {
    super(`Language Pack is still in use: ${languageId}`);
    this.languageId = languageId;
    this.usage = usage;
    this.name = "LanguagePackInUseError";
  }
}

export class LanguagePackApplicationService {
  readonly #builtInIds: ReadonlySet<string>;
  private readonly packs: LanguagePackRepository;

  constructor(packs: LanguagePackRepository, builtInIds: Iterable<string>) {
    this.packs = packs;
    this.#builtInIds = new Set(builtInIds);
  }

  async list(): Promise<readonly LanguageDefinition[]> {
    return this.packs.list();
  }

  async import(pack: LanguageDefinition, allowReplace = false): Promise<void> {
    if (this.#builtInIds.has(pack.id)) throw new BuiltInLanguagePackMutationError(pack.id);
    if (!allowReplace && await this.packs.get(pack.id)) throw new LanguagePackAlreadyExistsError(pack.id);
    await this.packs.put(pack);
  }

  async remove(languageId: string, usage: LanguagePackReferenceUsage): Promise<void> {
    if (this.#builtInIds.has(languageId)) throw new BuiltInLanguagePackMutationError(languageId);
    if (!usage.canDelete) throw new LanguagePackInUseError(languageId, usage);
    await this.packs.remove(languageId);
  }
}

export type CourseCompatibilityStatus = "compatible" | "degraded" | "blocked";

export interface CourseCompatibilityReportLike {
  status: CourseCompatibilityStatus;
  issues: readonly unknown[];
}

export interface CourseCompatibilityPolicy {
  assess(course: CoursePack): CourseCompatibilityReportLike;
}

export interface InstalledCourseRepository {
  list(): Promise<readonly CoursePack[]>;
  get(courseId: string): Promise<CoursePack | undefined>;
  put(course: CoursePack): Promise<void>;
  remove(courseId: string): Promise<void>;
}

export class CourseLanguageCompatibilityError extends Error {
  readonly courseId: string;
  readonly report: CourseCompatibilityReportLike;
  constructor(courseId: string, report: CourseCompatibilityReportLike) {
    super(`Course language runtime is incompatible: ${courseId}`);
    this.courseId = courseId;
    this.report = report;
    this.name = "CourseLanguageCompatibilityError";
  }
}

export class CourseNotPublishedError extends Error {
  readonly courseId: string;
  constructor(courseId: string) {
    super(`Only published courses can be installed: ${courseId}`);
    this.courseId = courseId;
    this.name = "CourseNotPublishedError";
  }
}

export class CourseLibraryApplicationService {
  private readonly courses: InstalledCourseRepository;
  private readonly compatibility: CourseCompatibilityPolicy;
  constructor(
    courses: InstalledCourseRepository,
    compatibility: CourseCompatibilityPolicy,
  ) {
    this.courses = courses;
    this.compatibility = compatibility;
  }

  assess(course: CoursePack): CourseCompatibilityReportLike {
    return this.compatibility.assess(course);
  }

  async list(): Promise<readonly CoursePack[]> {
    return this.courses.list();
  }

  async install(course: CoursePack): Promise<CourseCompatibilityReportLike> {
    if (course.manifest.status !== "published") throw new CourseNotPublishedError(course.manifest.id);
    const report = this.assess(course);
    if (report.status === "blocked") throw new CourseLanguageCompatibilityError(course.manifest.id, report);
    await this.courses.put(course);
    return report;
  }

  async remove(courseId: string): Promise<void> {
    await this.courses.remove(courseId);
  }
}

export interface ProfileProjection {
  courseId: string;
  updatedAt: string;
}

export interface LearningProfileRepository<TRecord extends ProfileProjection> {
  list(): Promise<readonly TRecord[]>;
  putMany(records: readonly TRecord[]): Promise<void>;
}

export interface ProfileRestoreResult<TRecord extends ProfileProjection> {
  records: Record<string, TRecord>;
  added: number;
  replaced: number;
  skipped: number;
}

export class ProfileBackupApplicationService<TRecord extends ProfileProjection> {
  private readonly profiles: LearningProfileRepository<TRecord>;
  constructor(profiles: LearningProfileRepository<TRecord>) { this.profiles = profiles; }

  async snapshot(): Promise<readonly TRecord[]> {
    return this.profiles.list();
  }

  async restore(incoming: readonly TRecord[]): Promise<ProfileRestoreResult<TRecord>> {
    const records = Object.fromEntries((await this.profiles.list()).map((record) => [record.courseId, record])) as Record<string, TRecord>;
    const changed: TRecord[] = [];
    let added = 0;
    let replaced = 0;
    let skipped = 0;
    for (const record of incoming) {
      const current = records[record.courseId];
      if (!current) {
        records[record.courseId] = record;
        changed.push(record);
        added += 1;
      } else if (Date.parse(record.updatedAt) > Date.parse(current.updatedAt)) {
        records[record.courseId] = record;
        changed.push(record);
        replaced += 1;
      } else {
        skipped += 1;
      }
    }
    await this.profiles.putMany(changed);
    return { records, added, replaced, skipped };
  }
}

export class MemoryDraftRepository implements DraftRepository {
  #revisions: unknown;
  constructor(initial: unknown = []) { this.#revisions = initial; }
  async load(): Promise<unknown> { return structuredClone(this.#revisions); }
  async save(revisions: readonly DraftRevisionRecord[]): Promise<void> { this.#revisions = structuredClone(revisions); }
}

export class MemoryLanguagePackRepository implements LanguagePackRepository {
  readonly #packs = new Map<string, LanguageDefinition>();
  constructor(packs: readonly LanguageDefinition[] = []) { for (const pack of packs) this.#packs.set(pack.id, pack); }
  async list(): Promise<readonly LanguageDefinition[]> { return [...this.#packs.values()]; }
  async get(languageId: string): Promise<LanguageDefinition | undefined> { return this.#packs.get(languageId); }
  async put(pack: LanguageDefinition): Promise<void> { this.#packs.set(pack.id, pack); }
  async remove(languageId: string): Promise<void> { this.#packs.delete(languageId); }
}

export class MemoryInstalledCourseRepository implements InstalledCourseRepository {
  readonly #courses = new Map<string, CoursePack>();
  constructor(courses: readonly CoursePack[] = []) { for (const course of courses) this.#courses.set(course.manifest.id, course); }
  async list(): Promise<readonly CoursePack[]> { return [...this.#courses.values()]; }
  async get(courseId: string): Promise<CoursePack | undefined> { return this.#courses.get(courseId); }
  async put(course: CoursePack): Promise<void> { this.#courses.set(course.manifest.id, course); }
  async remove(courseId: string): Promise<void> { this.#courses.delete(courseId); }
}

export class MemoryLearningProfileRepository<TRecord extends ProfileProjection> implements LearningProfileRepository<TRecord> {
  readonly #records = new Map<string, TRecord>();
  constructor(records: readonly TRecord[] = []) { for (const record of records) this.#records.set(record.courseId, record); }
  async list(): Promise<readonly TRecord[]> { return [...this.#records.values()]; }
  async putMany(records: readonly TRecord[]): Promise<void> { for (const record of records) this.#records.set(record.courseId, record); }
}
