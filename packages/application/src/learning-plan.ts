import type { CoursePack, Exercise } from "@learn-language/protocol";

export type LearningMotivation = "travel" | "daily-life" | "work-study" | "culture-media";
export type PlacementMode = "skipped" | "completed";

export interface PlacementQuestion {
  lessonId: string;
  lessonIndex: number;
  exerciseRef: string;
}

export interface PlacementLessonResult {
  lessonId: string;
  passed: boolean;
}

export interface PlacementSummary {
  mode: PlacementMode;
  assessedLessonIds: string[];
  placedOutLessonIds: string[];
  correctCount: number;
  total: number;
  recommendedLessonId: string;
  assessedAt: string;
}

export interface LearningPlan {
  schemaVersion: 1;
  courseId: string;
  courseVersion: string;
  languageId: string;
  motivation: LearningMotivation;
  minutesPerDay: number;
  daysPerWeek: number;
  weeklyTargetMinutes: number;
  lessonTargetCount: number;
  reviewTargetMinutes: number;
  placement: PlacementSummary;
  startingLessonId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLearningPlanCommand {
  motivation: LearningMotivation;
  minutesPerDay: number;
  daysPerWeek: number;
  placementMode: PlacementMode;
  placementResults?: readonly PlacementLessonResult[];
  startingLessonId?: string;
  occurredAt: string;
  createdAt?: string;
}

export interface LearningPlanRepository {
  list(): Promise<readonly LearningPlan[]>;
  get(courseId: string): Promise<LearningPlan | undefined>;
  put(plan: LearningPlan): Promise<void>;
}

export interface LearningPlanRestoreResult {
  plans: Record<string, LearningPlan>;
  added: number;
  replaced: number;
  skipped: number;
}

function isDeterministicPlacementExercise(exercise: Exercise | undefined) {
  if (!exercise) return false;
  if (exercise.kind === "single-choice") return Boolean(exercise.options?.length);
  if (exercise.kind === "multiple-choice") return Boolean(exercise.options?.length && exercise.correctOptionIndices?.length);
  if (exercise.kind === "ordering") return Boolean(exercise.options?.length);
  return Boolean(exercise.acceptedAnswers?.length);
}

export function placementQuestions(course: CoursePack): PlacementQuestion[] {
  const questions: PlacementQuestion[] = [];
  course.lessons.forEach((lesson, lessonIndex) => {
    const diagnostic = lesson.steps.find((step) => step.diagnostic && step.exerciseRefs.length === 1);
    const exerciseRef = diagnostic?.exerciseRefs[0];
    const exercise = exerciseRef ? course.exercises.find((item) => item.id === exerciseRef) : undefined;
    if (exerciseRef && isDeterministicPlacementExercise(exercise)) {
      questions.push({ lessonId: lesson.id, lessonIndex, exerciseRef });
    }
  });
  return questions;
}

function placementSummary(
  course: CoursePack,
  mode: PlacementMode,
  results: readonly PlacementLessonResult[],
  assessedAt: string,
): PlacementSummary {
  const questions = placementQuestions(course);
  if (course.lessons.length === 0) throw new Error("course-has-no-lessons");
  if (mode === "skipped" || questions.length === 0) {
    return {
      mode: "skipped",
      assessedLessonIds: [],
      placedOutLessonIds: [],
      correctCount: 0,
      total: 0,
      recommendedLessonId: course.lessons[0]!.id,
      assessedAt,
    };
  }

  const allowed = new Set(questions.map((item) => item.lessonId));
  const resultMap = new Map<string, boolean>();
  for (const result of results) {
    if (!allowed.has(result.lessonId) || resultMap.has(result.lessonId)) throw new Error("placement-results-invalid");
    resultMap.set(result.lessonId, result.passed);
  }
  if (resultMap.size !== questions.length) throw new Error("placement-results-incomplete");

  const firstFailed = questions.findIndex((item) => !resultMap.get(item.lessonId));
  const recommendedIndex = firstFailed >= 0
    ? questions[firstFailed]!.lessonIndex
    : Math.min(course.lessons.length - 1, questions.at(-1)!.lessonIndex + 1);
  const placedOutLessonIds = questions
    .filter((item) => item.lessonIndex < recommendedIndex && resultMap.get(item.lessonId) === true)
    .map((item) => item.lessonId);

  return {
    mode: "completed",
    assessedLessonIds: questions.map((item) => item.lessonId),
    placedOutLessonIds,
    correctCount: [...resultMap.values()].filter(Boolean).length,
    total: questions.length,
    recommendedLessonId: course.lessons[recommendedIndex]!.id,
    assessedAt,
  };
}

export function createLearningPlan(course: CoursePack, command: CreateLearningPlanCommand): LearningPlan {
  if (!Number.isInteger(command.minutesPerDay) || command.minutesPerDay < 5 || command.minutesPerDay > 120) {
    throw new Error("minutes-per-day-invalid");
  }
  if (!Number.isInteger(command.daysPerWeek) || command.daysPerWeek < 1 || command.daysPerWeek > 7) {
    throw new Error("days-per-week-invalid");
  }
  if (!Number.isFinite(Date.parse(command.occurredAt))) throw new Error("occurred-at-invalid");
  const placement = placementSummary(course, command.placementMode, command.placementResults ?? [], command.occurredAt);
  const startingLessonId = command.startingLessonId ?? placement.recommendedLessonId;
  const startingLessonIndex = course.lessons.findIndex((lesson) => lesson.id === startingLessonId);
  if (startingLessonIndex < 0) throw new Error("starting-lesson-invalid");
  const weeklyTargetMinutes = command.minutesPerDay * command.daysPerWeek;
  const remainingLessonCount = Math.max(1, course.lessons.length - startingLessonIndex);
  const lessonTargetCount = Math.max(1, Math.min(remainingLessonCount, Math.floor((weeklyTargetMinutes * 0.75) / 20)));
  const reviewTargetMinutes = Math.max(0, weeklyTargetMinutes - lessonTargetCount * 20);
  return {
    schemaVersion: 1,
    courseId: course.manifest.id,
    courseVersion: course.manifest.version,
    languageId: course.manifest.languageId,
    motivation: command.motivation,
    minutesPerDay: command.minutesPerDay,
    daysPerWeek: command.daysPerWeek,
    weeklyTargetMinutes,
    lessonTargetCount,
    reviewTargetMinutes,
    placement,
    startingLessonId,
    createdAt: command.createdAt ?? command.occurredAt,
    updatedAt: command.occurredAt,
  };
}

export function normalizeLearningPlan(value: unknown): LearningPlan | undefined {
  if (!value || typeof value !== "object") return undefined;
  const plan = value as Partial<LearningPlan>;
  if (plan.schemaVersion !== 1 || !plan.courseId || !plan.courseVersion || !plan.languageId || !plan.startingLessonId) return undefined;
  if (!["travel", "daily-life", "work-study", "culture-media"].includes(plan.motivation ?? "")) return undefined;
  if (!Number.isInteger(plan.minutesPerDay) || Number(plan.minutesPerDay) < 5 || Number(plan.minutesPerDay) > 120) return undefined;
  if (!Number.isInteger(plan.daysPerWeek) || Number(plan.daysPerWeek) < 1 || Number(plan.daysPerWeek) > 7) return undefined;
  if (plan.weeklyTargetMinutes !== Number(plan.minutesPerDay) * Number(plan.daysPerWeek)
    || !Number.isInteger(plan.lessonTargetCount) || Number(plan.lessonTargetCount) < 1
    || !Number.isInteger(plan.reviewTargetMinutes) || Number(plan.reviewTargetMinutes) < 0) return undefined;
  const placement = plan.placement;
  if (!placement || !["skipped", "completed"].includes(placement.mode)
    || !Array.isArray(placement.assessedLessonIds) || !placement.assessedLessonIds.every((id) => typeof id === "string")
    || !Array.isArray(placement.placedOutLessonIds) || !placement.placedOutLessonIds.every((id) => typeof id === "string")
    || !Number.isInteger(placement.correctCount) || placement.correctCount < 0
    || !Number.isInteger(placement.total) || placement.total < placement.correctCount
    || !placement.recommendedLessonId || !Number.isFinite(Date.parse(placement.assessedAt))) return undefined;
  if (!Number.isFinite(Date.parse(plan.createdAt ?? "")) || !Number.isFinite(Date.parse(plan.updatedAt ?? ""))) return undefined;
  return structuredClone(plan as LearningPlan);
}

export class LearningPlanApplicationService {
  private readonly plans: LearningPlanRepository;

  constructor(plans: LearningPlanRepository) {
    this.plans = plans;
  }

  async list(): Promise<readonly LearningPlan[]> {
    return (await this.plans.list()).map(normalizeLearningPlan).filter((plan): plan is LearningPlan => Boolean(plan));
  }

  async create(course: CoursePack, command: CreateLearningPlanCommand): Promise<LearningPlan> {
    const existing = await this.plans.get(course.manifest.id);
    const plan = createLearningPlan(course, { ...command, ...(existing ? { createdAt: existing.createdAt } : {}) });
    await this.plans.put(plan);
    return plan;
  }

  async restore(incoming: readonly LearningPlan[]): Promise<LearningPlanRestoreResult> {
    const plans = Object.fromEntries((await this.list()).map((plan) => [plan.courseId, plan]));
    const changed: LearningPlan[] = [];
    let added = 0;
    let replaced = 0;
    let skipped = 0;
    for (const raw of incoming) {
      const plan = normalizeLearningPlan(raw);
      if (!plan) continue;
      const current = plans[plan.courseId];
      if (!current) {
        plans[plan.courseId] = plan;
        changed.push(plan);
        added += 1;
      } else if (Date.parse(plan.updatedAt) > Date.parse(current.updatedAt)) {
        plans[plan.courseId] = plan;
        changed.push(plan);
        replaced += 1;
      } else {
        skipped += 1;
      }
    }
    await Promise.all(changed.map((plan) => this.plans.put(plan)));
    return { plans, added, replaced, skipped };
  }
}

export class MemoryLearningPlanRepository implements LearningPlanRepository {
  readonly #plans = new Map<string, LearningPlan>();
  constructor(plans: readonly LearningPlan[] = []) { for (const plan of plans) this.#plans.set(plan.courseId, structuredClone(plan)); }
  async list(): Promise<readonly LearningPlan[]> { return [...this.#plans.values()].map((plan) => structuredClone(plan)); }
  async get(courseId: string): Promise<LearningPlan | undefined> {
    const plan = this.#plans.get(courseId);
    return plan ? structuredClone(plan) : undefined;
  }
  async put(plan: LearningPlan): Promise<void> { this.#plans.set(plan.courseId, structuredClone(plan)); }
}
