import type { LearningPlan } from "./learning-plan.js";

export interface CompletedLessonActivity {
  lessonId: string;
  startedAt?: string;
  completedAt: string;
}

export interface ReviewActivity {
  occurredAt: string;
}

export interface LearningActivitySnapshot {
  lessonIds: readonly string[];
  completedLessons: readonly CompletedLessonActivity[];
  activeLessonId?: string;
  dueReviewCount: number;
  reviewEvents: readonly ReviewActivity[];
}

export interface AgendaProgress {
  targetMinutes: number;
  completedMinutes: number;
  remainingMinutes: number;
  completedLessonCount: number;
  completedReviewCount: number;
  percent: number;
}

export type AdaptiveAgendaItem =
  | { kind: "review"; taskCount: number; estimatedMinutes: number }
  | { kind: "continue-lesson" | "start-lesson"; lessonId: string; estimatedMinutes: number };

export interface AdaptiveLearningAgenda {
  generatedAt: string;
  dayStartAt: string;
  weekStartAt: string;
  weekEndAt: string;
  status: "active" | "target-met" | "course-complete";
  today: AgendaProgress;
  week: AgendaProgress & { targetLessonCount: number };
  items: AdaptiveAgendaItem[];
}

export interface BuildAdaptiveAgendaCommand {
  occurredAt: string;
  timezoneOffsetMinutes: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function validDate(value: string | undefined) {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

function boundaries(occurredAt: string, timezoneOffsetMinutes: number) {
  const now = Date.parse(occurredAt);
  if (!Number.isFinite(now)) throw new Error("occurred-at-invalid");
  if (!Number.isInteger(timezoneOffsetMinutes) || timezoneOffsetMinutes < -840 || timezoneOffsetMinutes > 840) {
    throw new Error("timezone-offset-invalid");
  }
  const local = new Date(now - timezoneOffsetMinutes * 60_000);
  const localDayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const dayStart = localDayStart + timezoneOffsetMinutes * 60_000;
  const mondayIndex = (local.getUTCDay() + 6) % 7;
  const weekStart = dayStart - mondayIndex * DAY_MS;
  return { now, dayStart, weekStart, weekEnd: weekStart + 7 * DAY_MS };
}

function within(value: string, start: number, end: number) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= start && timestamp < end;
}

function lessonMinutes(activity: CompletedLessonActivity) {
  if (!validDate(activity.startedAt)) return 20;
  const duration = Math.ceil((Date.parse(activity.completedAt) - Date.parse(activity.startedAt!)) / 60_000);
  return Math.max(5, Math.min(45, duration));
}

function progress(targetMinutes: number, lessons: readonly CompletedLessonActivity[], reviews: readonly ReviewActivity[]): AgendaProgress {
  const completedMinutes = lessons.reduce((total, lesson) => total + lessonMinutes(lesson), 0) + reviews.length * 2;
  return {
    targetMinutes,
    completedMinutes,
    remainingMinutes: Math.max(0, targetMinutes - completedMinutes),
    completedLessonCount: lessons.length,
    completedReviewCount: reviews.length,
    percent: targetMinutes === 0 ? 100 : Math.min(100, Math.round((completedMinutes / targetMinutes) * 100)),
  };
}

export function buildAdaptiveLearningAgenda(
  plan: LearningPlan,
  activity: LearningActivitySnapshot,
  command: BuildAdaptiveAgendaCommand,
): AdaptiveLearningAgenda {
  if (activity.lessonIds.length === 0) throw new Error("course-has-no-lessons");
  if (!Number.isInteger(activity.dueReviewCount) || activity.dueReviewCount < 0) throw new Error("due-review-count-invalid");
  const window = boundaries(command.occurredAt, command.timezoneOffsetMinutes);
  const todayLessons = activity.completedLessons.filter((item) => within(item.completedAt, window.dayStart, window.dayStart + DAY_MS));
  const weekLessons = activity.completedLessons.filter((item) => within(item.completedAt, window.weekStart, window.weekEnd));
  const todayReviews = activity.reviewEvents.filter((item) => within(item.occurredAt, window.dayStart, window.dayStart + DAY_MS));
  const weekReviews = activity.reviewEvents.filter((item) => within(item.occurredAt, window.weekStart, window.weekEnd));
  const week = progress(plan.weeklyTargetMinutes, weekLessons, weekReviews);
  const weeklyTargetMet = week.completedMinutes >= plan.weeklyTargetMinutes || week.completedLessonCount >= plan.lessonTargetCount;
  const todayTarget = weeklyTargetMet ? 0 : Math.min(plan.minutesPerDay, week.remainingMinutes);
  const today = progress(todayTarget, todayLessons, todayReviews);
  const completedIds = new Set(activity.completedLessons.map((item) => item.lessonId));
  const courseComplete = activity.lessonIds.every((lessonId) => completedIds.has(lessonId));
  const startingIndex = Math.max(0, activity.lessonIds.indexOf(plan.startingLessonId));
  const activeLessonId = activity.activeLessonId && activity.lessonIds.includes(activity.activeLessonId)
    ? activity.activeLessonId
    : undefined;
  const nextLessonId = activeLessonId ?? activity.lessonIds.slice(startingIndex).find((lessonId) => !completedIds.has(lessonId));
  const items: AdaptiveAgendaItem[] = [];
  const planningMinutes = weeklyTargetMet ? plan.minutesPerDay : Math.max(2, today.remainingMinutes);
  if (activity.dueReviewCount > 0) {
    const reviewBudget = Math.max(2, Math.floor(planningMinutes * 0.4));
    const taskCount = Math.min(activity.dueReviewCount, Math.max(1, Math.floor(reviewBudget / 2)));
    items.push({ kind: "review", taskCount, estimatedMinutes: taskCount * 2 });
  }
  const reviewMinutes = items[0]?.kind === "review" ? items[0].estimatedMinutes : 0;
  const remainingAfterReview = Math.max(0, today.remainingMinutes - reviewMinutes);
  if (!courseComplete && !weeklyTargetMet && nextLessonId && (activeLessonId || reviewMinutes === 0 || remainingAfterReview >= 10)) {
    items.push({
      kind: activeLessonId ? "continue-lesson" : "start-lesson",
      lessonId: nextLessonId,
      estimatedMinutes: Math.max(10, Math.min(20, remainingAfterReview || plan.minutesPerDay)),
    });
  }
  return {
    generatedAt: command.occurredAt,
    dayStartAt: new Date(window.dayStart).toISOString(),
    weekStartAt: new Date(window.weekStart).toISOString(),
    weekEndAt: new Date(window.weekEnd).toISOString(),
    status: courseComplete ? "course-complete" : weeklyTargetMet ? "target-met" : "active",
    today,
    week: { ...week, targetLessonCount: plan.lessonTargetCount },
    items,
  };
}
