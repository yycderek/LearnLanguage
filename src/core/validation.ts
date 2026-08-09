import type {
  CoursePack,
  LanguageDefinition,
  LessonFlow,
} from "./types.js";

export interface ValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

const LANGUAGE_ID_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function duplicateIds(
  values: readonly { readonly id: string }[],
  path: string,
): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];

  for (const value of values) {
    if (seen.has(value.id)) {
      issues.push({
        code: "duplicate-id",
        path,
        message: `Duplicate id: ${value.id}`,
      });
    }
    seen.add(value.id);
  }

  return issues;
}

function missingReferences(
  references: readonly string[],
  available: ReadonlySet<string>,
  path: string,
): ValidationIssue[] {
  return references
    .filter((reference) => !available.has(reference))
    .map((reference) => ({
      code: "missing-reference",
      path,
      message: `Unknown reference: ${reference}`,
    }));
}

function validateLesson(
  lesson: LessonFlow,
  goalIds: ReadonlySet<string>,
  knowledgeIds: ReadonlySet<string>,
  utteranceIds: ReadonlySet<string>,
  exerciseIds: ReadonlySet<string>,
): ValidationIssue[] {
  const issues = duplicateIds(lesson.steps, `lessons.${lesson.id}.steps`);
  const stepIds = new Set(lesson.steps.map((step) => step.id));

  if (!stepIds.has(lesson.entryStepId)) {
    issues.push({
      code: "missing-entry-step",
      path: `lessons.${lesson.id}.entryStepId`,
      message: `Unknown entry step: ${lesson.entryStepId}`,
    });
  }

  issues.push(
    ...missingReferences(
      lesson.canDoGoalRefs,
      goalIds,
      `lessons.${lesson.id}.canDoGoalRefs`,
    ),
  );

  for (const step of lesson.steps) {
    const stepPath = `lessons.${lesson.id}.steps.${step.id}`;
    issues.push(
      ...missingReferences(step.next, stepIds, `${stepPath}.next`),
      ...missingReferences(
        step.knowledgeRefs,
        knowledgeIds,
        `${stepPath}.knowledgeRefs`,
      ),
      ...missingReferences(
        step.utteranceRefs,
        utteranceIds,
        `${stepPath}.utteranceRefs`,
      ),
      ...missingReferences(
        step.exerciseRefs,
        exerciseIds,
        `${stepPath}.exerciseRefs`,
      ),
    );
  }

  if (!lesson.steps.some((step) => step.next.length === 0)) {
    issues.push({
      code: "missing-terminal-step",
      path: `lessons.${lesson.id}.steps`,
      message: "Lesson flow must contain a terminal step",
    });
  }

  return issues;
}

export function validateLanguageDefinition(
  definition: LanguageDefinition,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!LANGUAGE_ID_PATTERN.test(definition.id)) {
    issues.push({
      code: "invalid-language-id",
      path: "id",
      message: "Language id must resemble a BCP 47 language tag",
    });
  }

  issues.push(
    ...duplicateIds(definition.readingSystems, "readingSystems"),
  );

  const primaryScripts = definition.scripts.filter((script) => script.primary);
  if (primaryScripts.length === 0) {
    issues.push({
      code: "missing-primary-script",
      path: "scripts",
      message: "At least one script must be marked as primary",
    });
  }

  return { valid: issues.length === 0, issues };
}

export function validateCoursePack(course: CoursePack): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!LANGUAGE_ID_PATTERN.test(course.manifest.languageId)) {
    issues.push({
      code: "invalid-language-id",
      path: "manifest.languageId",
      message: "Course language id must resemble a BCP 47 language tag",
    });
  }

  if (!SEMVER_PATTERN.test(course.manifest.version)) {
    issues.push({
      code: "invalid-version",
      path: "manifest.version",
      message: "Course version must use semantic versioning",
    });
  }

  issues.push(
    ...duplicateIds(course.goals, "goals"),
    ...duplicateIds(course.knowledge, "knowledge"),
    ...duplicateIds(course.utterances, "utterances"),
    ...duplicateIds(course.exercises, "exercises"),
    ...duplicateIds(course.rubrics, "rubrics"),
    ...duplicateIds(course.lessons, "lessons"),
  );

  const goalIds = new Set(course.goals.map((goal) => goal.id));
  const knowledgeIds = new Set(course.knowledge.map((item) => item.id));
  const utteranceIds = new Set(course.utterances.map((item) => item.id));
  const exerciseIds = new Set(course.exercises.map((item) => item.id));
  const rubricIds = new Set(course.rubrics.map((item) => item.id));

  for (const utterance of course.utterances) {
    issues.push(
      ...missingReferences(
        utterance.knowledgeRefs,
        knowledgeIds,
        `utterances.${utterance.id}.knowledgeRefs`,
      ),
    );
  }

  for (const exercise of course.exercises) {
    issues.push(
      ...missingReferences(
        exercise.knowledgeRefs,
        knowledgeIds,
        `exercises.${exercise.id}.knowledgeRefs`,
      ),
      ...missingReferences(
        exercise.utteranceRefs,
        utteranceIds,
        `exercises.${exercise.id}.utteranceRefs`,
      ),
    );

    if (exercise.rubricRef) {
      issues.push(
        ...missingReferences(
          [exercise.rubricRef],
          rubricIds,
          `exercises.${exercise.id}.rubricRef`,
        ),
      );
    }
  }

  for (const lesson of course.lessons) {
    issues.push(
      ...validateLesson(
        lesson,
        goalIds,
        knowledgeIds,
        utteranceIds,
        exerciseIds,
      ),
    );
  }

  return { valid: issues.length === 0, issues };
}
