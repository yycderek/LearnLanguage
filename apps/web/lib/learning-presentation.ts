import type { CourseLearningRecord } from "./learning.ts";
import type { CoursePack, LessonPhase } from "./course.ts";

export type LearnerStageId = "learn" | "practice" | "use";

export type LearnerStage = {
  id: LearnerStageId;
  stepIds: string[];
  completedSteps: number;
  status: "completed" | "active" | "upcoming";
};

const stageByPhase: Record<LessonPhase, LearnerStageId> = {
  diagnostic: "learn",
  preteach: "learn",
  "supported-input": "learn",
  noticing: "learn",
  comprehension: "practice",
  "guided-output": "practice",
  "independent-task": "use",
  "feedback-retry": "use",
  "delayed-transfer": "use",
};

const stageOrder: LearnerStageId[] = ["learn", "practice", "use"];

export function learnerStageForPhase(phase: LessonPhase): LearnerStageId {
  return stageByPhase[phase];
}

export function buildLearnerStages(
  lesson: CoursePack["lessons"][number],
  currentStepId: string,
  completedStepIds: string[],
): LearnerStage[] {
  const completed = new Set(completedStepIds);
  const stages = stageOrder.map((id) => {
    const stepIds = lesson.steps.filter((step) => learnerStageForPhase(step.phase) === id).map((step) => step.id);
    return {
      id,
      stepIds,
      completedSteps: stepIds.filter((stepId) => completed.has(stepId)).length,
      status: "upcoming" as LearnerStage["status"],
    };
  }).filter((stage) => stage.stepIds.length > 0);
  const activeIndex = stages.findIndex((stage) => stage.stepIds.includes(currentStepId));
  return stages.map((stage, index) => ({
    ...stage,
    status: stage.completedSteps === stage.stepIds.length || (activeIndex >= 0 && index < activeIndex)
      ? "completed"
      : index === activeIndex ? "active" : "upcoming",
  }));
}

export function mostRecentActiveLesson(course: CoursePack, record?: CourseLearningRecord) {
  return course.lessons.filter((lesson) => {
    const progress = record?.lessonProgress[lesson.id];
    return progress?.status === "active" && progress.courseVersion === course.manifest.version
      && lesson.steps.some((step) => step.id === progress.currentStepId);
  }).sort((a, b) => (Date.parse(record!.lessonProgress[b.id].updatedAt) || 0) - (Date.parse(record!.lessonProgress[a.id].updatedAt) || 0))[0];
}
