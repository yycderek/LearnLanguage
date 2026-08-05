import type { CoursePack, CourseStep } from "./course";

export type MasteryLevel =
  | "encountered"
  | "comprehended"
  | "prompted-output"
  | "independent-output"
  | "delayed-transfer";

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

const masteryRank: Record<MasteryLevel, number> = {
  encountered: 0,
  comprehended: 1,
  "prompted-output": 2,
  "independent-output": 3,
  "delayed-transfer": 4,
};

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

function masteryForStep(step: CourseStep, decision: "advance" | "retry", usedSupport: boolean): MasteryLevel {
  if (decision === "retry") return "encountered";
  if (step.phase === "supported-input" || step.phase === "comprehension") return "comprehended";
  if (step.phase === "guided-output") return "prompted-output";
  if (step.phase === "delayed-transfer") return usedSupport ? "prompted-output" : "delayed-transfer";
  if (step.phase === "independent-task" || step.phase === "feedback-retry") return usedSupport ? "prompted-output" : "independent-output";
  return "encountered";
}

function scheduleReviews(mastery: Record<string, KnowledgeProgress>, languageId: string): ReviewTask[] {
  return Object.values(mastery)
    .map((item) => {
      const rule = reviewRules[item.level];
      const dueAt = new Date(Date.parse(item.lastAttemptAt) + rule.delayMs).toISOString();
      return {
        id: `${languageId}:${item.knowledgeItemId}:${rule.mode}:${dueAt}`,
        knowledgeItemId: item.knowledgeItemId,
        mode: rule.mode,
        dueAt,
        basedOnLevel: item.level,
      };
    })
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

export function startLearning(course: CoursePack, now = new Date().toISOString()): LearningProgress {
  const lesson = course.lessons[0];
  if (!lesson || !lesson.steps.some((step) => step.id === lesson.entryStepId)) {
    throw new Error("课程缺少可用的入口步骤");
  }
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
    events: [
      event("session.started", now),
      event("step.entered", now, { stepId: lesson.entryStepId }),
    ],
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

export function submitLearningStep(
  course: CoursePack,
  progress: LearningProgress,
  input: { decision: "advance" | "retry"; answer?: string; score?: number; usedSupport?: boolean; now?: string },
): LearningProgress {
  if (progress.status !== "active" || !progress.currentStepId) throw new Error("学习会话已经结束");
  const lesson = course.lessons.find((item) => item.id === progress.lessonId);
  const step = lesson?.steps.find((item) => item.id === progress.currentStepId);
  if (!lesson || !step) throw new Error("找不到当前学习步骤");

  const now = input.now ?? new Date().toISOString();
  const next: LearningProgress = JSON.parse(JSON.stringify(progress)) as LearningProgress;
  next.updatedAt = now;
  next.attemptCounts[step.id] = (next.attemptCounts[step.id] ?? 0) + 1;
  next.events.push(event("attempt.recorded", now, {
    stepId: step.id,
    decision: input.decision,
    ...(input.answer === undefined ? {} : { answer: input.answer }),
    ...(input.score === undefined ? {} : { score: input.score }),
  }));

  const candidateLevel = masteryForStep(step, input.decision, Boolean(input.usedSupport));
  for (const knowledgeItemId of step.knowledgeRefs) {
    const current = next.mastery[knowledgeItemId];
    const level = current && masteryRank[current.level] > masteryRank[candidateLevel] ? current.level : candidateLevel;
    next.mastery[knowledgeItemId] = {
      knowledgeItemId,
      level,
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

export function learningPercent(course: CoursePack, progress?: LearningProgress) {
  if (!progress) return 0;
  const count = course.lessons.find((item) => item.id === progress.lessonId)?.steps.length ?? 0;
  return count === 0 ? 0 : Math.round((progress.completedStepIds.length / count) * 100);
}

export function reviewsDue(progress: LearningProgress, now = Date.now()) {
  return progress.reviews.filter((item) => Date.parse(item.dueAt) <= now);
}
