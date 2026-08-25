import type { CoursePack } from "@learn-language/protocol";
import type { EvaluationSource } from "@learn-language/protocol";
import {
  startSession,
  submitAttempt,
  projectKnowledgeMastery,
  scheduleReviews as scheduleEngineReviews,
  type LearningEffect,
  type LearningSessionState,
  type SessionEvent,
} from "@learn-language/engine";

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
  sequence?: number;
  engineVersion?: string;
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
  engineEvents: SessionEvent[];
  pendingEffects: LearningEffect[];
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

function learningEventFromEngine(item: SessionEvent): LearningEvent {
  const stepId = item.type === "session.started"
    ? item.entryStepId
    : item.type === "session.completed"
      ? item.finalStepId
      : "stepId" in item
        ? item.stepId
        : undefined;
  return {
    id: item.id,
    type: item.type,
    occurredAt: item.occurredAt,
    sequence: item.sequence,
    engineVersion: item.engineVersion,
    ...(stepId === undefined ? {} : { stepId }),
    ...(item.type === "attempt.recorded" ? {
      decision: item.decision,
      evaluationSource: item.evaluationSource,
      ...(item.answer === undefined ? {} : { answer: item.answer }),
      ...(item.scores?.["task-completion"] === undefined ? {} : { score: item.scores["task-completion"] }),
    } : {}),
  };
}

function strongerLevel(left: MasteryLevel, right: MasteryLevel) {
  return masteryRank[left] >= masteryRank[right] ? left : right;
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

export function startLearning(course: CoursePack, lessonId = course.lessons[0]?.id, now = new Date().toISOString()): LearningProgress {
  const lesson = course.lessons.find((item) => item.id === lessonId);
  if (!lesson || !lesson.steps.some((step) => step.id === lesson.entryStepId)) throw new Error("课程缺少可用的入口步骤");
  const sessionId = crypto.randomUUID();
  const transition = startSession(lesson, {
    sessionId,
    learnerId: "local-anonymous",
    courseId: course.manifest.id,
    lessonId: lesson.id,
    occurredAt: now,
  });
  return {
    schemaVersion: 1,
    sessionId,
    courseId: course.manifest.id,
    courseVersion: course.manifest.version,
    languageId: course.manifest.languageId,
    lessonId: lesson.id,
    status: transition.state.status,
    currentStepId: transition.state.currentStepId,
    completedStepIds: [],
    attemptCounts: {},
    mastery: {},
    reviews: [],
    events: transition.events.map(learningEventFromEngine),
    engineEvents: [...transition.events],
    pendingEffects: [],
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

export function submitLearningStep(
  course: CoursePack,
  progress: LearningProgress,
  input: { decision: "advance" | "retry"; answer?: string; score?: number; evaluationSource?: EvaluationSource; evidenceEligible?: boolean; usedSupport?: boolean; nextStepId?: string; now?: string },
): LearningProgress {
  if (progress.status !== "active" || !progress.currentStepId) throw new Error("学习会话已经结束");
  const lesson = course.lessons.find((item) => item.id === progress.lessonId);
  const step = lesson?.steps.find((item) => item.id === progress.currentStepId);
  if (!lesson || !step) throw new Error("找不到当前学习步骤");
  const now = input.now ?? new Date().toISOString();
  const state: LearningSessionState = {
    sessionId: progress.sessionId,
    learnerId: "local-anonymous",
    courseId: progress.courseId,
    lessonId: progress.lessonId,
    status: progress.status,
    currentStepId: progress.currentStepId,
    attemptCounts: progress.attemptCounts,
    startedAt: progress.startedAt,
    completedAt: progress.completedAt,
    lastSequence: progress.events.at(-1)?.sequence ?? progress.events.length,
  };
  const evaluationSource = input.evaluationSource ?? "deterministic";
  const transition = submitAttempt(lesson, state, {
    sessionId: progress.sessionId,
    attemptId: crypto.randomUUID(),
    expectedStepId: step.id,
    expectedSequence: state.lastSequence,
    occurredAt: now,
    decision: input.decision,
    evaluationSource,
    evidenceEligible: input.evidenceEligible ?? true,
    supportLevelUsed: input.usedSupport ? "full" : "none",
    promptLevel: input.usedSupport ? 1 : 0,
    ...(input.answer === undefined ? {} : { answer: input.answer }),
    ...(input.score === undefined ? {} : { scores: { "task-completion": input.score } }),
    ...(input.nextStepId ? { nextStepId: input.nextStepId } : step.next.length > 1 && step.next[0] ? { nextStepId: step.next[0] } : {}),
  });
  const next = JSON.parse(JSON.stringify(progress)) as LearningProgress;
  next.updatedAt = now;
  next.status = transition.state.status;
  next.currentStepId = transition.state.currentStepId;
  next.attemptCounts = { ...transition.state.attemptCounts };
  next.completedAt = transition.state.completedAt;
  next.events.push(...transition.events.map(learningEventFromEngine));
  next.engineEvents = [...(next.engineEvents ?? []), ...transition.events];
  next.pendingEffects = [...transition.effects];
  const projected = projectKnowledgeMastery(course, lesson, next.engineEvents);
  next.mastery = Object.fromEntries(projected.map((item) => [item.knowledgeItemId, {
    knowledgeItemId: item.knowledgeItemId,
    level: item.level,
    evidenceCount: item.evidenceCount,
    lastAttemptAt: item.lastAttemptAt,
  }]));
  next.reviews = scheduleEngineReviews(projected).map((item) => ({
    id: item.id,
    knowledgeItemId: item.knowledgeItemId,
    mode: item.mode,
    dueAt: item.dueAt,
    basedOnLevel: item.basedOnLevel,
  }));
  if (transition.events.some((item) => item.type === "step.completed") && !next.completedStepIds.includes(step.id)) next.completedStepIds.push(step.id);
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
    return {
      ...record,
      completedLessonIds: record.completedLessonIds ?? [],
      lessonProgress: Object.fromEntries(Object.entries(record.lessonProgress).map(([lessonId, progress]) => [lessonId, {
        ...progress,
        engineEvents: progress.engineEvents ?? [],
        pendingEffects: progress.pendingEffects ?? [],
      }])),
    };
  }
  if (candidate.schemaVersion === 1 && candidate.courseId && candidate.lessonId) {
    const legacy = value as LearningProgress;
    return {
      schemaVersion: 2,
      courseId: legacy.courseId,
      courseVersion: legacy.courseVersion,
      languageId: legacy.languageId,
      completedLessonIds: legacy.status === "completed" ? [legacy.lessonId] : [],
      lessonProgress: { [legacy.lessonId]: { ...legacy, engineEvents: legacy.engineEvents ?? [], pendingEffects: legacy.pendingEffects ?? [] } },
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
  const nextLevel = result === "remembered"
    ? masteryLevels[Math.min(masteryRank[current.level] + 1, masteryLevels.length - 1)] ?? current.level
    : current.level;
  const updated: KnowledgeProgress = { ...current, level: nextLevel, evidenceCount: current.evidenceCount + 1, lastAttemptAt: now };
  next.mastery[task.knowledgeItemId] = updated;
  const refreshed = result === "retry"
    ? taskForMastery(updated, next.languageId, { delayMs: 4 * 60 * 60 * 1000, mode: "recognition" })
    : taskForMastery(updated, next.languageId);
  next.reviews = [...next.reviews.filter((item) => item.id !== taskId), refreshed].sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  next.reviewEvents.push({ id: crypto.randomUUID(), taskId, knowledgeItemId: task.knowledgeItemId, result, occurredAt: now });
  next.updatedAt = now;
  return next;
}

export function learningPercent(course: CoursePack, progress?: LearningProgress) {
  if (!progress) return 0;
  if (progress.status === "completed") return 100;
  const count = course.lessons.find((item) => item.id === progress.lessonId)?.steps.length ?? 0;
  return count === 0 ? 0 : Math.round((progress.completedStepIds.length / count) * 100);
}

export function courseLearningPercent(course: CoursePack, record?: CourseLearningRecord) {
  if (!record || course.lessons.length === 0) return 0;
  const completed = course.lessons.reduce((sum, lesson) => {
    if (record.completedLessonIds.includes(lesson.id)) return sum + 1;
    return sum + learningPercent(course, record.lessonProgress[lesson.id]) / 100;
  }, 0);
  return Math.round((completed / course.lessons.length) * 100);
}

export function lessonIsUnlocked(course: CoursePack, record: CourseLearningRecord | undefined, lessonIndex: number) {
  if (lessonIndex === 0) return true;
  const lesson = course.lessons[lessonIndex];
  if (lesson && (record?.lessonProgress[lesson.id] || record?.completedLessonIds.includes(lesson.id))) return true;
  const previous = course.lessons[lessonIndex - 1];
  return previous ? record?.completedLessonIds.includes(previous.id) === true : false;
}

export function reviewsDue(record: CourseLearningRecord, now = Date.now()) {
  return record.reviews.filter((item) => Date.parse(item.dueAt) <= now);
}
