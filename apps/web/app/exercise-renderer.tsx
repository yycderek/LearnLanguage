"use client";

import { ArrowDown, ArrowUp, Check, MessagesSquare } from "lucide-react";
import type { Exercise, ExerciseKind } from "@learn-language/protocol";
import type { ExerciseResponse } from "@learn-language/application";
import { displayText } from "@/lib/course";
import { uiText, type TeachingLocale, type UiLocale } from "@/lib/i18n";

export type ExerciseRendererKind = "single-choice" | "multiple-choice" | "ordering" | "text" | "open-task";

const rendererRegistry: Record<ExerciseKind, ExerciseRendererKind> = {
  "single-choice": "single-choice",
  "multiple-choice": "multiple-choice",
  matching: "text",
  ordering: "ordering",
  "fill-blank": "text",
  "short-input": "text",
  cloze: "text",
  substitution: "text",
  reconstruction: "text",
  "role-play": "open-task",
  "free-response": "open-task",
};

export function exerciseRendererKind(kind: ExerciseKind) {
  return rendererRegistry[kind];
}

const textLabels: Partial<Record<ExerciseKind, [string, string]>> = {
  matching: ["写下匹配结果", "Write the matching pairs"],
  "fill-blank": ["填写空缺内容", "Fill in the missing text"],
  "short-input": ["你的答案", "Your answer"],
  cloze: ["完成这段内容", "Complete the passage"],
  substitution: ["改写后的表达", "Your substituted expression"],
  reconstruction: ["重组后的表达", "Your reconstructed expression"],
};

export function ExerciseRenderer({
  exercise,
  response,
  teachingLocale,
  uiLocale,
  onChange,
  onInteraction,
}: {
  exercise: Exercise;
  response: ExerciseResponse;
  teachingLocale: TeachingLocale;
  uiLocale: UiLocale;
  onChange: (response: ExerciseResponse) => void;
  onInteraction?: () => void;
}) {
  const c = (chinese: string, english: string) => uiText(uiLocale, chinese, english);
  const renderer = exerciseRendererKind(exercise.kind);

  if ((renderer === "single-choice" || renderer === "multiple-choice") && response.kind === "selection") {
    const multiple = renderer === "multiple-choice";
    const selected = response.selected;
    return (
      <div className="choice-list" role={multiple ? "group" : "radiogroup"} aria-label={c(multiple ? "选择所有正确答案" : "选择答案", multiple ? "Choose all correct answers" : "Choose an answer")}>
        {(exercise.options ?? []).map((option, index) => {
          const active = selected.includes(index);
          return (
            <button
              type="button"
              key={index}
              role={multiple ? "checkbox" : "radio"}
              aria-checked={active}
              className={active ? "selected" : ""}
              onClick={() => {
                const next = multiple
                  ? active ? selected.filter((value) => value !== index) : [...selected, index]
                  : [index];
                onChange({ kind: "selection", selected: next });
                onInteraction?.();
              }}
            >
              <span>{multiple ? (active ? "✓" : "□") : String.fromCharCode(65 + index)}</span>
              <strong>{displayText(option, teachingLocale)}</strong>
              {active && <Check size={17} />}
            </button>
          );
        })}
      </div>
    );
  }

  if (renderer === "ordering" && response.kind === "ordering") {
    const move = (from: number, offset: number) => {
      const to = from + offset;
      if (to < 0 || to >= response.order.length) return;
      const order = [...response.order];
      [order[from], order[to]] = [order[to]!, order[from]!];
      onChange({ kind: "ordering", order });
      onInteraction?.();
    };
    return (
      <div className="ordering-list" aria-label={c("调整为正确顺序", "Put the items in the correct order")}>
        <div className="exercise-instruction">{c("使用上下按钮调整顺序", "Use the arrow buttons to change the order")}</div>
        {response.order.map((optionIndex, position) => {
          const option = exercise.options?.[optionIndex];
          return (
            <div className="ordering-item" key={optionIndex}>
              <span>{position + 1}</span>
              <strong dir="auto">{option ? displayText(option, teachingLocale) : optionIndex + 1}</strong>
              <div>
                <button type="button" onClick={() => move(position, -1)} disabled={position === 0} aria-label={c(`上移第 ${position + 1} 项`, `Move item ${position + 1} up`)}><ArrowUp size={16} /></button>
                <button type="button" onClick={() => move(position, 1)} disabled={position === response.order.length - 1} aria-label={c(`下移第 ${position + 1} 项`, `Move item ${position + 1} down`)}><ArrowDown size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (response.kind !== "text") return null;
  const openTask = renderer === "open-task";
  const label = openTask ? c("你的回应", "Your response") : c(...(textLabels[exercise.kind] ?? ["你的答案", "Your answer"]));
  return (
    <div className={`text-exercise ${openTask ? "open-task" : ""}`}>
      {openTask && <div className="role-task-banner"><MessagesSquare size={18} /><div><strong>{exercise.kind === "role-play" ? c("角色任务", "Role task") : c("开放任务", "Open task")}</strong><p>{c("用目标语言自然完成任务；表达不必与示例完全相同。", "Complete the task naturally in the target language; your wording can differ from the example.")}</p></div></div>}
      <label className="answer-field"><span>{label}</span><textarea value={response.value} onChange={(event) => { onChange({ kind: "text", value: event.target.value }); onInteraction?.(); }} placeholder={openTask ? c("输入你会对对方说的话……", "Write what you would say…") : c("输入答案……", "Enter your answer…")} dir="auto" /></label>
    </div>
  );
}
