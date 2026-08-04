import { replaySessionEvents, type AttemptRecordedEvent, type SessionEvent } from "./session.js";
import type {
  CoursePack,
  LearnerKnowledgeState,
  LessonFlow,
  LessonPhase,
  MasteryLevel,
} from "./types.js";

const MASTERY_RANK: Readonly<Record<MasteryLevel, number>> = {
  encountered: 0,
  comprehended: 1,
  "prompted-output": 2,
  "independent-output": 3,
  "delayed-transfer": 4,
};

function strongerLevel(current: MasteryLevel, candidate: MasteryLevel): MasteryLevel {
  return MASTERY_RANK[candidate] > MASTERY_RANK[current] ? candidate : current;
}

function levelForAttempt(
  phase: LessonPhase,
  attempt: AttemptRecordedEvent,
): MasteryLevel {
  if (attempt.decision === "retry") {
    return "encountered";
  }

  switch (phase) {
    case "supported-input":
    case "comprehension":
      return "comprehended";
    case "guided-output":
      return "prompted-output";
    case "independent-task":
    case "feedback-retry":
      return attempt.promptLevel === 0 && attempt.supportLevelUsed === "none"
        ? "independent-output"
        : "prompted-output";
    case "delayed-transfer":
      return attempt.promptLevel === 0 && attempt.supportLevelUsed === "none"
        ? "delayed-transfer"
        : "prompted-output";
    case "diagnostic":
    case "preteach":
    case "noticing":
      return "encountered";
  }
}

export function projectKnowledgeMastery(
  course: CoursePack,
  lesson: LessonFlow,
  events: readonly SessionEvent[],
): readonly LearnerKnowledgeState[] {
  const session = replaySessionEvents(events);
  if (session.courseId !== course.manifest.id) {
    throw new Error(
      `Session course ${session.courseId} does not match ${course.manifest.id}`,
    );
  }
  if (session.lessonId !== lesson.id) {
    throw new Error(
      `Session lesson ${session.lessonId} does not match ${lesson.id}`,
    );
  }

  const steps = new Map(lesson.steps.map((step) => [step.id, step]));
  const projected = new Map<string, LearnerKnowledgeState>();

  for (const event of events) {
    if (event.type !== "attempt.recorded") {
      continue;
    }

    const step = steps.get(event.stepId);
    if (!step) {
      throw new Error(`Unknown lesson step in event stream: ${event.stepId}`);
    }

    const candidateLevel = levelForAttempt(step.phase, event);
    for (const knowledgeItemId of step.knowledgeRefs) {
      const current = projected.get(knowledgeItemId);
      projected.set(knowledgeItemId, {
        learnerId: session.learnerId,
        languageId: course.manifest.languageId,
        knowledgeItemId,
        level: current
          ? strongerLevel(current.level, candidateLevel)
          : candidateLevel,
        evidenceCount: (current?.evidenceCount ?? 0) + 1,
        lastAttemptAt: event.occurredAt,
      });
    }
  }

  return [...projected.values()].sort((left, right) =>
    left.knowledgeItemId.localeCompare(right.knowledgeItemId),
  );
}
