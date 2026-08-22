import type { CoursePack, CourseUnit, LessonFlow } from "@learn-language/protocol";

function uniqueId(prefix: string, values: readonly string[]) {
  let index = values.length + 1;
  while (values.includes(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

export function rewireLinearLesson(lesson: LessonFlow) {
  lesson.steps.forEach((step, index) => {
    delete step.diagnostic;
    step.next = index < lesson.steps.length - 1 ? [lesson.steps[index + 1]!.id] : [];
  });
  lesson.entryStepId = lesson.steps[0]?.id ?? "";
}

export function ensureCourseUnits(course: CoursePack, locale: string): CourseUnit[] {
  if (course.units?.length) return course.units;
  course.units = [{
    id: "unit-1",
    title: { [locale]: locale === "en" ? "Course foundations" : "课程基础" },
    canDoGoalRefs: [...new Set(course.lessons.flatMap((lesson) => lesson.canDoGoalRefs))],
    lessonRefs: course.lessons.map((lesson) => lesson.id),
  }];
  return course.units;
}

export class CourseAuthoringApplicationService {
  appendLesson(course: CoursePack, locale: string, title: string) {
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
        knowledgeRefs: [], utteranceRefs: [], exerciseRefs: [], next: [],
      }],
    };
    const units = ensureCourseUnits(course, locale);
    course.lessons.push(lesson);
    units.at(-1)!.lessonRefs.push(id);
    return id;
  }

  moveLesson(course: CoursePack, lessonId: string, offset: -1 | 1) {
    const from = course.lessons.findIndex((lesson) => lesson.id === lessonId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= course.lessons.length) return false;
    [course.lessons[from], course.lessons[to]] = [course.lessons[to]!, course.lessons[from]!];
    for (const unit of course.units ?? []) {
      unit.lessonRefs.sort((left, right) => course.lessons.findIndex((lesson) => lesson.id === left) - course.lessons.findIndex((lesson) => lesson.id === right));
    }
    return true;
  }

  removeLesson(course: CoursePack, lessonId: string) {
    if (course.lessons.length <= 1) return undefined;
    const index = course.lessons.findIndex((lesson) => lesson.id === lessonId);
    if (index < 0) return undefined;
    course.lessons.splice(index, 1);
    for (const unit of course.units ?? []) unit.lessonRefs = unit.lessonRefs.filter((id) => id !== lessonId);
    if (course.units) course.units = course.units.filter((unit) => unit.lessonRefs.length > 0);
    return course.lessons[Math.min(index, course.lessons.length - 1)]?.id;
  }

  duplicateLesson(course: CoursePack, lessonId: string, locale: string) {
    const sourceIndex = course.lessons.findIndex((lesson) => lesson.id === lessonId);
    if (sourceIndex < 0) return undefined;
    const source = course.lessons[sourceIndex]!;
    const id = uniqueId("lesson", course.lessons.map((lesson) => lesson.id));
    const copy = structuredClone(source);
    copy.id = id;
    copy.title = { ...copy.title, [locale]: `${copy.title[locale] ?? Object.values(copy.title)[0] ?? id} ${locale === "en" ? "(copy)" : "（副本）"}` };
    const stepIds = new Map<string, string>();
    copy.steps.forEach((step, index) => stepIds.set(step.id, `${id}-step-${index + 1}`));
    copy.steps.forEach((step) => {
      const previous = step.id;
      step.id = stepIds.get(previous)!;
      step.next = step.next.map((next) => stepIds.get(next) ?? next);
      if (step.diagnostic) {
        step.diagnostic.learnNextStepId = stepIds.get(step.diagnostic.learnNextStepId) ?? step.diagnostic.learnNextStepId;
        step.diagnostic.passNextStepId = stepIds.get(step.diagnostic.passNextStepId) ?? step.diagnostic.passNextStepId;
      }
    });
    copy.entryStepId = stepIds.get(source.entryStepId) ?? copy.steps[0]?.id ?? "";
    course.lessons.splice(sourceIndex + 1, 0, copy);
    const unit = course.units?.find((item) => item.lessonRefs.includes(source.id));
    if (unit) unit.lessonRefs.splice(unit.lessonRefs.indexOf(source.id) + 1, 0, id);
    return id;
  }

  appendUnit(course: CoursePack, locale: string, title: string) {
    const units = ensureCourseUnits(course, locale);
    const id = uniqueId("unit", units.map((unit) => unit.id));
    units.push({ id, title: { [locale]: title }, canDoGoalRefs: [], lessonRefs: [] });
    return id;
  }

  renameUnit(course: CoursePack, unitId: string, locale: string, title: string) {
    const unit = course.units?.find((item) => item.id === unitId);
    if (!unit) return false;
    unit.title[locale] = title;
    return true;
  }

  moveUnit(course: CoursePack, unitId: string, offset: -1 | 1) {
    const units = course.units ?? [];
    const from = units.findIndex((unit) => unit.id === unitId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= units.length) return false;
    [units[from], units[to]] = [units[to]!, units[from]!];
    return true;
  }

  removeUnit(course: CoursePack, unitId: string) {
    const units = course.units ?? [];
    if (units.length <= 1) return false;
    const index = units.findIndex((unit) => unit.id === unitId);
    if (index < 0) return false;
    const target = units[index === 0 ? 1 : index - 1]!;
    target.lessonRefs.push(...units[index]!.lessonRefs);
    units.splice(index, 1);
    return true;
  }

  assignLessonToUnit(course: CoursePack, lessonId: string, unitId: string) {
    const units = course.units ?? [];
    const target = units.find((unit) => unit.id === unitId);
    if (!target || !course.lessons.some((lesson) => lesson.id === lessonId)) return false;
    for (const unit of units) unit.lessonRefs = unit.lessonRefs.filter((id) => id !== lessonId);
    target.lessonRefs.push(lessonId);
    return true;
  }

  appendLessonStep(lesson: LessonFlow, locale: string, title: string) {
    const id = uniqueId("step", lesson.steps.map((step) => step.id));
    lesson.steps.push({
      id, phase: "supported-input", title: { [locale]: title }, supportLevel: "full",
      knowledgeRefs: [], utteranceRefs: [], exerciseRefs: [], next: [],
    });
    rewireLinearLesson(lesson);
    return id;
  }

  moveLessonStep(lesson: LessonFlow, stepIndex: number, offset: -1 | 1) {
    const to = stepIndex + offset;
    if (stepIndex < 0 || to < 0 || to >= lesson.steps.length) return false;
    [lesson.steps[stepIndex], lesson.steps[to]] = [lesson.steps[to]!, lesson.steps[stepIndex]!];
    rewireLinearLesson(lesson);
    return true;
  }

  removeLessonStep(lesson: LessonFlow, stepIndex: number) {
    if (lesson.steps.length <= 1 || stepIndex < 0 || stepIndex >= lesson.steps.length) return false;
    lesson.steps.splice(stepIndex, 1);
    rewireLinearLesson(lesson);
    return true;
  }
}

const authoring = new CourseAuthoringApplicationService();
export const appendLesson = authoring.appendLesson.bind(authoring);
export const moveLesson = authoring.moveLesson.bind(authoring);
export const removeLesson = authoring.removeLesson.bind(authoring);
export const duplicateLesson = authoring.duplicateLesson.bind(authoring);
export const appendUnit = authoring.appendUnit.bind(authoring);
export const renameUnit = authoring.renameUnit.bind(authoring);
export const moveUnit = authoring.moveUnit.bind(authoring);
export const removeUnit = authoring.removeUnit.bind(authoring);
export const assignLessonToUnit = authoring.assignLessonToUnit.bind(authoring);
export const appendLessonStep = authoring.appendLessonStep.bind(authoring);
export const moveLessonStep = authoring.moveLessonStep.bind(authoring);
export const removeLessonStep = authoring.removeLessonStep.bind(authoring);
