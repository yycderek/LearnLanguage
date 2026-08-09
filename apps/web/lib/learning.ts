import type { CoursePack, CourseStep } from "./course";
import type { EvaluationSource } from "@learn-language/protocol";

export type MasteryLevel = "encountered" | "comprehended" | "prompted-output" | "independent-output" | "delayed-transfer";
export type ReviewMode = "recognition" | "active-recall" | "scenario" | "transfer" | "fluency";

export interface KnowledgeProgress {
  knowledgeItemId: string;
  level: MasteryLevel;
  evidenceCount: number;
  lastAttemptAt: string;
}

export interface ReviewTask {
  id: string;
  knowledgeItemId: string;
  mode: ReviewMode;
  dueAt: string;
  basedOnLevel: MasteryLevel;
}

export interface LearningEvent {
  id: string;
  type: "session.started" | "step.entered" | "attempt.recorded" | "step.retry-required" | "step.completed" | "session.completed";
  occurredAt: string;
  stepId?: string;
  decision?: "advance" | "retry";
  answer?: string;
  score?: number;
  evaluationSource?: EvaluationSource;
}

export interface LearningProgress {
  schemaVersion: 1;
  sessionId: string;
  courseId: string;
  courseVersion: string;
  languageId: string;
  lessonId: string;
  status: "active" | "completed";
  currentStepId: string | null;
  completedStepIds: string[];
  attemptCounts: Record<string, number>;
  mastery: Record<string, KnowledgeProgress>;
  reviews: ReviewTask[];
  events: LearningEvent[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ReviewEvent {
  id: string;
  taskId: string;
  knowledgeItemId: string;
  result: "remembered" | "retry";
  occurredAt: string;
}

export interface CourseLearningRecord {
  schemaVersion: 2;
  courseId: string;
  courseVersion: string;
  languageId: string;
  completedLessonIds: string[];
  lessonProgress: Record<string, LearningProgress>;
  mastery: Record<string, KnowledgeProgress>;
  reviews: ReviewTask[];
  reviewEvents: ReviewEvent[];
  updatedAt: string;
}

const masteryLevels: MasteryLevel[] = ["encountered", "comprehended", "prompted-output", "independent-output", "delayed-transfer"];
const masteryRank = Object.fromEntries(masteryLevels.map((level, index) => [level, index])) as Record<MasteryLevel, number>;
const reviewRules: Record<MasteryLevel, { delayMs: number; mode: ReviewMode }> = {
  encountered: { delayMs: 4 * 60 * 60 * 1000, mode: "recognition" },
  comprehended: { delayMs: 24 * 60 * 60 * 1000, mode: "active-recall" },
  "prompted-output": { delayMs: 24 * 60 * 60 * 1000, mode: "scenario" },
  "independent-output": { delayMs: 3 * 24 * 60 * 60 * 1000, mode: "transfer" },
  "delayed-transfer": { delayMs: 14 * 24 * 60 * 60 * 1000, mode: "fluency" },
};

function event(type: LearningEvent["type"], occurredAt: string, detail: Omit<LearningEvent, "id" | "type" | "occurredAt"> = {}): LearningEvent {
  return { id: crypto.randomUUID(), type, occurredAt, ...detail };
}

function strongerLevel(left: MasteryLevel, right: MasteryLevel) {
  return masteryRank[left] >= masteryRank[right] ? left : right;
}

function masteryForStep(step: CourseStep, decision: "advance" | "retry", usedSupport: boolean, evaluationSource: EvaluationSource): MasteryLevel {
  if (decision === "retry") return "encountered";
  if (step.phase === "supported-input" || step.phase === "comprehension") return "comprehended";
  if (step.phase === "guided-output") return "prompted-output";
  if (evaluationSource === "self") return "prompted-output";
  if (step.phase === "delayed-transfer") return usedSupport ? "prompted-output" : "delayed-transfer";
  if (step.phase === "independent-task" || step.phase === "feedback-retry") return usedSupport ? "prompted-output" : "independent-output";
  return "encountered";
}

function taskForMastery(item: KnowledgeProgress, languageId: string, override?: { delayMs: number; mode: ReviewMode }): ReviewTask {
  const rule = override ?? reviewRules[item.level];
  const dueAt = new Date(Date.parse(item.lastAttemptAt) + rule.delayMs).toISOString();
  return {
    id: `${languageId}:${item.knowledgeItemId}:${rule.mode}:${dueAt}`,
    knowledgeItemId: item.knowledgeItemId,
    mode: rule.mode,
    dueAt,
    basedOnLevel: item.level,
  };
}

function scheduleReviews(mastery: Record<string, KnowledgeProgress>, languageId: string): ReviewTask[] {
  return Object.values(mastery).map((item) => taskForMastery(item, languageId)).sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

export function startLearning(course: CoursePack, lessonId = course.lessons[0]?.id, now = new Date().toISOString()): LearningProgress {
  const lesson = course.lessons.find((item) => item.id === lessonId);
  if (!lesson || !lesson.steps.some((step) => step.id === lesson.entryStepId)) throw new Error("课程缺少可用的入口步骤");
  const sessionId = crypto.randomUUID();
  return {
    schemaVersion: 1,
    sessionId,
    courseId: course.manifest.id,
    courseVersion: course.manifest.version,
    languageId: course.manifest.languageId,
    lessonId: lesson.id,
    status: "active",
    currentStepId: lesson.entryStepId,
    completedStepIds: [],
    attemptCounts: {},
    mastery: {},
    reviews: [],
    events: [event("session.started", now), event("step.entered", now, { stepId: lesson.entryStepId })],
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

export function submitLearningStep(
  course: CoursePack,
  progress: LearningProgress,
  input: { decision: "advance" | "retry"; answer?: string; score?: number; evaluationSource?: EvaluationSource; usedSupport?: boolean; now?: string },
): LearningProgress {
  if (progress.status !== "active" || !progress.currentStepId) throw new Error("学习会话已经结束");
  const lesson = course.lessons.find((item) => item.id === progress.lessonId);
  const step = lesson?.steps.find((item) => item.id === progress.currentStepId);
  if (!lesson || !step) throw new Error("找不到当前学习步骤");
  const now = input.now ?? new Date().toISOString();
  const next = JSON.parse(JSON.stringify(progress)) as LearningProgress;
  next.updatedAt = now;
  next.attemptCounts[step.id] = (next.attemptCounts[step.id] ?? 0) + 1;
  next.events.push(event("attempt.recorded", now, {
    stepId: step.id,
    decision: input.decision,
    ...(input.answer === undefined ? {} : { answer: input.answer }),
    ...(input.score === undefined ? {} : { score: input.score }),
    evaluationSource: input.evaluationSource ?? "deterministic",
  }));
  const candidateLevel = masteryForStep(step, input.decision, Boolean(input.usedSupport), input.evaluationSource ?? "deterministic");
  for (const knowledgeItemId of step.knowledgeRefs) {
    const current = next.mastery[knowledgeItemId];
    next.mastery[knowledgeItemId] = {
      knowledgeItemId,
      level: current ? strongerLevel(current.level, candidateLevel) : candidateLevel,
      evidenceCount: (current?.evidenceCount ?? 0) + 1,
      lastAttemptAt: now,
    };
  }
  next.reviews = scheduleReviews(next.mastery, next.languageId);
  if (input.decision === "retry") {
    next.events.push(event("step.retry-required", now, { stepId: step.id }));
    return next;
  }
  if (!next.completedStepIds.includes(step.id)) next.completedStepIds.push(step.id);
  next.events.push(event("step.completed", now, { stepId: step.id }));
  const nextStepId = step.next[0] ?? null;
  if (nextStepId) {
    next.currentStepId = nextStepId;
    next.events.push(event("step.entered", now, { stepId: nextStepId }));
  } else {
    next.status = "completed";
    next.currentStepId = null;
    next.completedAt = now;
    next.events.push(event("session.completed", now, { stepId: step.id }));
  }
  return next;
}

export function createCourseLearningRecord(course: CoursePack, now = new Date().toISOString()): CourseLearningRecord {
  return {
    schemaVersion: 2,
    courseId: course.manifest.id,
    courseVersion: course.manifest.version,
    languageId: course.manifest.languageId,
    completedLessonIds: [],
    lessonProgress: {},
    mastery: {},
    reviews: [],
    reviewEvents: [],
    updatedAt: now,
  };
}

export function normalizeCourseLearningRecord(value: unknown): CourseLearningRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as { schemaVersion?: number; courseId?: string; lessonId?: string; lessonProgress?: unknown };
  if (candidate.schemaVersion === 2 && candidate.courseId && candidate.lessonProgress) {
    const record = value as CourseLearningRecord;
    return { ...record, completedLessonIds: record.completedLessonIds ?? [] };
  }
  if (candidate.schemaVersion === 1 && candidate.courseId && candidate.lessonId) {
    const legacy = value as LearningProgress;
    return {
      schemaVersion: 2,
      courseId: legacy.courseId,
      courseVersion: legacy.courseVersion,
      languageId: legacy.languageId,
      completedLessonIds: legacy.status === "completed" ? [legacy.lessonId] : [],
      lessonProgress: { [legacy.lessonId]: legacy },
      mastery: legacy.mastery,
      reviews: legacy.reviews,
      reviewEvents: [],
      updatedAt: legacy.updatedAt,
    };
  }
  return undefined;
}

export function updateCourseLearningRecord(record: CourseLearningRecord, progress: LearningProgress): CourseLearningRecord {
  const next = JSON.parse(JSON.stringify(record)) as CourseLearningRecord;
  const previous = next.lessonProgress[progress.lessonId];
  next.lessonProgress[progress.lessonId] = progress;
  if (progress.status === "completed" && !next.completedLessonIds.includes(progress.lessonId)) next.completedLessonIds.push(progress.lessonId);
  next.courseVersion = progress.courseVersion;
  next.updatedAt = progress.updatedAt;
  for (const item of Object.values(progress.mastery)) {
    const previousEvidence = previous?.mastery[item.knowledgeItemId]?.evidenceCount ?? 0;
    const delta = Math.max(0, item.evidenceCount - previousEvidence);
    if (delta === 0) continue;
    const current = next.mastery[item.knowledgeItemId];
    next.mastery[item.knowledgeItemId] = {
      knowledgeItemId: item.knowledgeItemId,
      level: current ? strongerLevel(current.level, item.level) : item.level,
      evidenceCount: (current?.evidenceCount ?? 0) + delta,
      lastAttemptAt: item.lastAttemptAt,
    };
  }
  const touchedIds = new Set(Object.keys(progress.mastery));
  const preserved = next.reviews.filter((task) => !touchedIds.has(task.knowledgeItemId));
  const refreshed = Object.values(next.mastery).filter((item) => touchedIds.has(item.knowledgeItemId)).map((item) => taskForMastery(item, next.languageId));
  next.reviews = [...preserved, ...refreshed].sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  return next;
}

export function completeReviewTask(
  record: CourseLearningRecord,
  taskId: string,
  result: "remembered" | "retry",
  now = new Date().toISOString(),
): CourseLearningRecord {
  const task = record.reviews.find((item) => item.id === taskId);
  if (!task) throw new Error("复习任务不存在");
  const next = JSON.parse(JSON.stringify(record)) as CourseLearningRecord;
  const current = next.mastery[task.knowledgeItemId];
  if (!current) throw new Error("复习任务缺少掌握度记录");
  const nextLevel = result === "remembered" ? masteryLevels[Math.min(masteryRank[current.level] + 1, masteryLevels.length - 1)] : current.level;
  next.mastery[task.knowledgeItemId] = { ...current, level: nextLevel, evidenceCount: current.evidenceCount + 1, lastAttemptAt: now };
  const refreshed = result === "retry"
    ? taskForMastery(next.mastery[task.knowledgeItemId], next.languageId, { delayMs: 4 * 60 * 60 * 1000, mode: "recognition" })
    : taskForMastery(next.mastery[task.knowledgeItemId], next.languageId);
  next.reviews = [...next.reviews.filter((item) => item.id !== taskId), refreshed].sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  next.reviewEvents.push({ id: crypto.randomUUID(), taskId, knowledgeItemId: task.knowledgeItemId, result, occurredAt: now });
  next.updatedAt = now;
  return next;
}

export function learningPercent(course: CoursePack, progress?: LearningProgress) {
  if (!progress) return 0;
  const count = course.lessons.find((item) => item.id === progress.lessonId)?.steps.length ?? 0;
  return count === 0 ? 0 : Math.round((progress.completedStepIds.length / count) * 100);
}

export function courseLearningPercent(course: CoursePack, record?: CourseLearningRecord) {
  const total = course.lessons.reduce((count, lesson) => count + lesson.steps.length, 0);
  if (!record || total === 0) return 0;
  const completed = course.lessons.reduce((count, lesson) => {
    if (record.completedLessonIds.includes(lesson.id)) return count + lesson.steps.length;
    return count + (record.lessonProgress[lesson.id]?.completedStepIds.length ?? 0);
  }, 0);
  return Math.round((completed / total) * 100);
}

export function lessonIsUnlocked(course: CoursePack, record: CourseLearningRecord | undefined, lessonIndex: number) {
  if (lessonIndex === 0) return true;
  const previous = course.lessons[lessonIndex - 1];
  return previous ? record?.completedLessonIds.includes(previous.id) === true : false;
}

export function reviewsDue(record: CourseLearningRecord, now = Date.now()) {
  return record.reviews.filter((item) => Date.parse(item.dueAt) <= now);
}
