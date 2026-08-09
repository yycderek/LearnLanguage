import type { Exercise } from "@learn-language/protocol";

export type ExerciseResponse =
  | { readonly kind: "selection"; readonly selected: readonly number[] }
  | { readonly kind: "ordering"; readonly order: readonly number[] }
  | { readonly kind: "text"; readonly value: string };

export type ExerciseEvaluationStatus = "empty" | "pass" | "retry" | "manual";

export interface ExerciseEvaluation {
  readonly status: ExerciseEvaluationStatus;
  readonly score?: 0 | 1;
}

const selectionKinds = new Set(["single-choice", "multiple-choice"]);

export function createExerciseResponse(exercise: Exercise): ExerciseResponse {
  if (selectionKinds.has(exercise.kind)) return { kind: "selection", selected: [] };
  if (exercise.kind === "ordering") {
    const correct = exercise.correctOrder ?? exercise.options?.map((_, index) => index) ?? [];
    return { kind: "ordering", order: correct.length > 1 ? [...correct].reverse() : [...correct] };
  }
  return { kind: "text", value: "" };
}

export function serializeExerciseResponse(response: ExerciseResponse | undefined): string {
  if (!response) return "";
  if (response.kind === "selection") return JSON.stringify(response.selected);
  if (response.kind === "ordering") return JSON.stringify(response.order);
  return response.value.trim();
}

export function textExerciseResponse(response: ExerciseResponse | undefined): string {
  return response?.kind === "text" ? response.value.trim() : "";
}

function normalizedText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function sameNumbers(left: readonly number[], right: readonly number[], unordered = false) {
  const normalize = (values: readonly number[]) => unordered ? [...values].sort((a, b) => a - b) : [...values];
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

export function evaluateExerciseResponse(exercise: Exercise, response: ExerciseResponse): ExerciseEvaluation {
  if (exercise.kind === "single-choice") {
    if (response.kind !== "selection" || response.selected.length === 0) return { status: "empty" };
    const correct = exercise.correctOptionIndex ?? 0;
    return response.selected.length === 1 && response.selected[0] === correct
      ? { status: "pass", score: 1 }
      : { status: "retry", score: 0 };
  }

  if (exercise.kind === "multiple-choice") {
    if (response.kind !== "selection" || response.selected.length === 0) return { status: "empty" };
    if (!exercise.correctOptionIndices?.length) return { status: "manual" };
    return sameNumbers(response.selected, exercise.correctOptionIndices, true)
      ? { status: "pass", score: 1 }
      : { status: "retry", score: 0 };
  }

  if (exercise.kind === "ordering") {
    if (response.kind !== "ordering" || response.order.length === 0) return { status: "empty" };
    const correct = exercise.correctOrder ?? exercise.options?.map((_, index) => index) ?? [];
    return sameNumbers(response.order, correct)
      ? { status: "pass", score: 1 }
      : { status: "retry", score: 0 };
  }

  if (response.kind !== "text" || normalizedText(response.value).length === 0) return { status: "empty" };
  if (!exercise.acceptedAnswers?.length) return { status: "manual" };
  const submitted = normalizedText(response.value);
  return exercise.acceptedAnswers.some((answer) => normalizedText(answer) === submitted)
    ? { status: "pass", score: 1 }
    : { status: "retry", score: 0 };
}
