import { describe, expect, it } from "vitest";
import type { Exercise, ExerciseKind } from "@learn-language/protocol";
import {
  createExerciseResponse,
  evaluateExerciseResponse,
  serializeExerciseResponse,
  textExerciseResponse,
  type ExerciseResponse,
} from "@learn-language/application";

function exercise(kind: ExerciseKind, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: `test-${kind}`,
    kind,
    prompt: { en: "Test prompt" },
    knowledgeRefs: [],
    utteranceRefs: [],
    ...overrides,
  };
}

describe("client-neutral exercise responses", () => {
  it("creates empty selection responses without depending on a UI toolkit", () => {
    expect(createExerciseResponse(exercise("single-choice"))).toEqual({ kind: "selection", selected: [] });
    expect(createExerciseResponse(exercise("multiple-choice"))).toEqual({ kind: "selection", selected: [] });
  });

  it("evaluates single choice and serializes the structured selection", () => {
    const task = exercise("single-choice", { correctOptionIndex: 1 });
    const response: ExerciseResponse = { kind: "selection", selected: [1] };
    expect(evaluateExerciseResponse(task, response)).toEqual({ status: "pass", score: 1 });
    expect(evaluateExerciseResponse(task, { kind: "selection", selected: [0] })).toEqual({ status: "retry", score: 0 });
    expect(evaluateExerciseResponse(task, { kind: "selection", selected: [] })).toEqual({ status: "empty" });
    expect(serializeExerciseResponse(response)).toBe("[1]");
  });

  it("compares multiple-choice answers as sets", () => {
    const task = exercise("multiple-choice", { correctOptionIndices: [0, 2] });
    expect(evaluateExerciseResponse(task, { kind: "selection", selected: [2, 0] })).toEqual({ status: "pass", score: 1 });
    expect(evaluateExerciseResponse(task, { kind: "selection", selected: [0, 1, 2] })).toEqual({ status: "retry", score: 0 });
  });

  it("starts ordering tasks in a deterministic non-answer order", () => {
    const task = exercise("ordering", {
      options: [{ en: "one" }, { en: "two" }, { en: "three" }],
      correctOrder: [0, 1, 2],
    });
    expect(createExerciseResponse(task)).toEqual({ kind: "ordering", order: [2, 1, 0] });
    expect(evaluateExerciseResponse(task, { kind: "ordering", order: [0, 1, 2] })).toEqual({ status: "pass", score: 1 });
    expect(evaluateExerciseResponse(task, { kind: "ordering", order: [2, 1, 0] })).toEqual({ status: "retry", score: 0 });
    expect(serializeExerciseResponse({ kind: "ordering", order: [0, 1, 2] })).toBe("[0,1,2]");
  });

  it("supports an explicit non-identity correct order", () => {
    const task = exercise("ordering", {
      options: [{ en: "two" }, { en: "three" }, { en: "one" }],
      correctOrder: [2, 0, 1],
    });
    expect(createExerciseResponse(task)).toEqual({ kind: "ordering", order: [1, 0, 2] });
    expect(evaluateExerciseResponse(task, { kind: "ordering", order: [2, 0, 1] })).toEqual({ status: "pass", score: 1 });
  });

  it("normalizes deterministic text answers across width, case, and whitespace", () => {
    const task = exercise("short-input", { acceptedAnswers: ["Coffee Please"] });
    const response: ExerciseResponse = { kind: "text", value: "  ＣＯＦＦＥＥ   PLEASE  " };
    expect(evaluateExerciseResponse(task, response)).toEqual({ status: "pass", score: 1 });
    expect(textExerciseResponse(response)).toBe("ＣＯＦＦＥＥ   PLEASE");
  });

  it("returns manual evaluation for open tasks without an answer key", () => {
    const task = exercise("role-play");
    expect(evaluateExerciseResponse(task, { kind: "text", value: "コーヒーをお願いします。" })).toEqual({ status: "manual" });
    expect(evaluateExerciseResponse(task, { kind: "text", value: "   " })).toEqual({ status: "empty" });
  });

  it("does not confuse a response shape from another renderer with a valid answer", () => {
    const task = exercise("ordering", { options: [{ en: "a" }, { en: "b" }] });
    expect(evaluateExerciseResponse(task, { kind: "text", value: "0,1" })).toEqual({ status: "empty" });
  });
});
