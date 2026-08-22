import {
  buildAdaptiveLearningAgenda,
  type AdaptiveLearningAgenda,
} from "@learn-language/application/adaptive-agenda";
import type { LearningPlan } from "@learn-language/application/learning-plan";
import type { CoursePack } from "./course.ts";
import { reviewsDue, type CourseLearningRecord } from "./learning.ts";

export function courseAdaptiveAgenda(
  course: CoursePack,
  record: CourseLearningRecord | undefined,
  plan: LearningPlan,
  occurredAt = new Date().toISOString(),
  timezoneOffsetMinutes = new Date().getTimezoneOffset(),
): AdaptiveLearningAgenda {
  const completedLessons = Object.values(record?.lessonProgress ?? {})
    .filter((progress) => progress.status === "completed" && progress.completedAt)
    .map((progress) => ({
      lessonId: progress.lessonId,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt!,
    }));
  const activeLessonId = course.lessons
    .find((lesson) => record?.lessonProgress[lesson.id]?.status === "active")
    ?.id;

  return buildAdaptiveLearningAgenda(
    plan,
    {
      lessonIds: course.lessons.map((lesson) => lesson.id),
      completedLessons,
      activeLessonId,
      dueReviewCount: record ? reviewsDue(record, Date.parse(occurredAt)).length : 0,
      reviewEvents: record?.reviewEvents.map(({ occurredAt: reviewAt }) => ({ occurredAt: reviewAt })) ?? [],
    },
    { occurredAt, timezoneOffsetMinutes },
  );
}
