import type { CoursePack } from "@learn-language/protocol";

export type LearningMasteryLevel = "encountered" | "comprehended" | "prompted-output" | "independent-output" | "delayed-transfer";
export interface LearningRecordProjection {
  readonly courseId: string;
  readonly completedLessonIds: readonly string[];
  readonly lessonProgress: Readonly<Record<string, { readonly attemptCounts?: Readonly<Record<string, number>> }>>;
  readonly mastery: Readonly<Record<string, { readonly level: LearningMasteryLevel }>>;
  readonly reviews: readonly { readonly id: string; readonly knowledgeItemId: string; readonly dueAt: string }[];
  readonly reviewEvents: readonly { readonly knowledgeItemId: string; readonly result: "remembered" | "retry" }[];
}
export interface WeakKnowledgeItem {
  readonly knowledgeItemId: string;
  readonly form: string;
  readonly priority: number;
  readonly masteryLevel: LearningMasteryLevel | undefined;
  readonly retryCount: number;
  readonly failedReviewCount: number;
  readonly due: boolean;
  readonly reviewTaskIds: readonly string[];
  readonly reasons: readonly ("lesson-retries" | "review-retries" | "due-review" | "early-mastery")[];
}
export interface CourseCompletionSummary {
  readonly complete: boolean;
  readonly completedLessonCount: number;
  readonly totalLessonCount: number;
  readonly achievedGoalIds: readonly string[];
  readonly masteryCounts: Readonly<Record<LearningMasteryLevel, number>>;
  readonly dueReviewCount: number;
  readonly weakKnowledge: readonly WeakKnowledgeItem[];
  readonly nextActions: readonly ("targeted-practice" | "due-review" | "revisit-course" | "choose-course")[];
}

const masteryRank: Record<LearningMasteryLevel, number> = {
  encountered: 0, comprehended: 1, "prompted-output": 2, "independent-output": 3, "delayed-transfer": 4,
};

function knowledgeRefsForStep(course: CoursePack, stepId: string): readonly string[] {
  for (const lesson of course.lessons) {
    const step = lesson.steps.find((candidate) => candidate.id === stepId);
    if (step) return step.knowledgeRefs ?? [];
  }
  return [];
}

export function deriveWeakKnowledge(course: CoursePack, record: LearningRecordProjection | undefined, now = new Date().toISOString(), limit = 6): WeakKnowledgeItem[] {
  if (!record) return [];
  const retries = new Map<string, number>();
  for (const progress of Object.values(record.lessonProgress)) {
    for (const [stepId, attempts] of Object.entries(progress.attemptCounts ?? {})) {
      const retryCount = Math.max(0, attempts - 1);
      if (retryCount === 0) continue;
      for (const knowledgeItemId of knowledgeRefsForStep(course, stepId)) retries.set(knowledgeItemId, (retries.get(knowledgeItemId) ?? 0) + retryCount);
    }
  }
  const failedReviews = new Map<string, number>();
  for (const event of record.reviewEvents) if (event.result === "retry") failedReviews.set(event.knowledgeItemId, (failedReviews.get(event.knowledgeItemId) ?? 0) + 1);
  const nowMs = Date.parse(now);
  return course.knowledge.map((knowledge) => {
    const masteryLevel = record.mastery[knowledge.id]?.level;
    const reviewTasks = record.reviews.filter((task) => task.knowledgeItemId === knowledge.id);
    const due = reviewTasks.some((task) => Date.parse(task.dueAt) <= nowMs);
    const retryCount = retries.get(knowledge.id) ?? 0;
    const failedReviewCount = failedReviews.get(knowledge.id) ?? 0;
    const earlyMastery = masteryLevel !== undefined && masteryRank[masteryLevel] <= 1;
    const reasons: WeakKnowledgeItem["reasons"][number][] = [];
    if (retryCount > 0) reasons.push("lesson-retries");
    if (failedReviewCount > 0) reasons.push("review-retries");
    if (due) reasons.push("due-review");
    if (earlyMastery) reasons.push("early-mastery");
    return {
      knowledgeItemId: knowledge.id, form: knowledge.form,
      priority: retryCount * 3 + failedReviewCount * 4 + (due ? 2 : 0) + (earlyMastery ? 1 : 0),
      masteryLevel, retryCount, failedReviewCount, due,
      reviewTaskIds: reviewTasks.map((task) => task.id), reasons,
    } satisfies WeakKnowledgeItem;
  }).filter((item) => item.priority > 0)
    .sort((left, right) => right.priority - left.priority || left.form.localeCompare(right.form))
    .slice(0, Math.max(0, limit));
}

export function summarizeCourseCompletion(course: CoursePack, record: LearningRecordProjection | undefined, now = new Date().toISOString()): CourseCompletionSummary {
  const completed = new Set(record?.completedLessonIds ?? []);
  const complete = course.lessons.length > 0 && course.lessons.every((lesson) => completed.has(lesson.id));
  const achievedGoalIds = course.goals.filter((goal) => {
    const linkedLessons = course.lessons.filter((lesson) => lesson.canDoGoalRefs.includes(goal.id));
    return complete || (linkedLessons.length > 0 && linkedLessons.every((lesson) => completed.has(lesson.id)));
  }).map((goal) => goal.id);
  const masteryCounts: Record<LearningMasteryLevel, number> = {
    encountered: 0, comprehended: 0, "prompted-output": 0, "independent-output": 0, "delayed-transfer": 0,
  };
  for (const mastery of Object.values(record?.mastery ?? {})) masteryCounts[mastery.level] += 1;
  const weakKnowledge = deriveWeakKnowledge(course, record, now);
  const dueReviewCount = record?.reviews.filter((task) => Date.parse(task.dueAt) <= Date.parse(now)).length ?? 0;
  const nextActions: CourseCompletionSummary["nextActions"][number][] = [];
  if (weakKnowledge.length > 0) nextActions.push("targeted-practice");
  if (dueReviewCount > 0) nextActions.push("due-review");
  if (complete) nextActions.push("revisit-course", "choose-course");
  return { complete, completedLessonCount: completed.size, totalLessonCount: course.lessons.length, achievedGoalIds, masteryCounts, dueReviewCount, weakKnowledge, nextActions };
}
