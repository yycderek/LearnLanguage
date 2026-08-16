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
