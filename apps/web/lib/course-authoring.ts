import type { CoursePack, LessonFlow } from "@learn-language/protocol";
import type { AppLocale } from "./i18n.ts";

function uniqueId(prefix: string, values: readonly string[]) {
  let index = values.length + 1;
  while (values.includes(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

export function rewireLinearLesson(lesson: LessonFlow) {
  lesson.steps.forEach((step, index) => {
    step.next = index < lesson.steps.length - 1 ? [lesson.steps[index + 1]!.id] : [];
  });
  lesson.entryStepId = lesson.steps[0]?.id ?? "";
}

export function appendLesson(course: CoursePack, locale: AppLocale, title: string) {
  const id = uniqueId("lesson", course.lessons.map((lesson) => lesson.id));
  const lesson: LessonFlow = {
    id,
    title: { [locale]: title },
    canDoGoalRefs: course.goals[0] ? [course.goals[0].id] : [],
    entryStepId: "start",
    steps: [{
      id: "start",
      phase: "preteach",
      title: { [locale]: locale === "en" ? "Start the lesson" : "开始学习" },
      supportLevel: "full",
      knowledgeRefs: [],
      utteranceRefs: [],
      exerciseRefs: [],
      next: [],
    }],
  };
  course.lessons.push(lesson);
  return id;
}

export function moveLesson(course: CoursePack, lessonId: string, offset: -1 | 1) {
  const from = course.lessons.findIndex((lesson) => lesson.id === lessonId);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= course.lessons.length) return false;
  [course.lessons[from], course.lessons[to]] = [course.lessons[to]!, course.lessons[from]!];
  return true;
}

export function removeLesson(course: CoursePack, lessonId: string) {
  if (course.lessons.length <= 1) return undefined;
  const index = course.lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return undefined;
  course.lessons.splice(index, 1);
  return course.lessons[Math.min(index, course.lessons.length - 1)]?.id;
}

export function appendLessonStep(lesson: LessonFlow, locale: AppLocale, title: string) {
  const id = uniqueId("step", lesson.steps.map((step) => step.id));
  lesson.steps.push({
    id,
    phase: "supported-input",
    title: { [locale]: title },
    supportLevel: "full",
    knowledgeRefs: [],
    utteranceRefs: [],
    exerciseRefs: [],
    next: [],
  });
  rewireLinearLesson(lesson);
  return id;
}

export function moveLessonStep(lesson: LessonFlow, stepIndex: number, offset: -1 | 1) {
  const to = stepIndex + offset;
  if (stepIndex < 0 || to < 0 || to >= lesson.steps.length) return false;
  [lesson.steps[stepIndex], lesson.steps[to]] = [lesson.steps[to]!, lesson.steps[stepIndex]!];
  rewireLinearLesson(lesson);
  return true;
}

export function removeLessonStep(lesson: LessonFlow, stepIndex: number) {
  if (lesson.steps.length <= 1 || stepIndex < 0 || stepIndex >= lesson.steps.length) return false;
  lesson.steps.splice(stepIndex, 1);
  rewireLinearLesson(lesson);
  return true;
}
