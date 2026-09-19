"use client";

import { Plus, Trash2 } from "lucide-react";
import { displayText, type CoursePack, type ExerciseKind } from "@/lib/course";
import { uiText, type AppLocale } from "@/lib/i18n";
import type { LanguageDirection } from "@/lib/language-pack";
import { ReferencePicker } from "@/app/studio/reference-picker";

type CourseContentEditorProps = {
  course: CoursePack;
  editorSection: "knowledge" | "utterances" | "exercises";
  locale: AppLocale;
  direction: LanguageDirection;
  showAdvanced: boolean;
  editCourse: (change: (next: CoursePack) => void) => void;
};

function uniqueId(prefix: string, values: string[]) {
  let index = values.length + 1;
  while (values.includes(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function splitRefs(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function splitLines(value: string) {
  return value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean);
}

function localizedOptionLines(options: CoursePack["exercises"][number]["options"], locale: AppLocale) {
  return (options ?? []).map((option) => option[locale] ?? option.native ?? Object.values(option)[0] ?? "").join("\n");
}

export function CourseContentEditor({ course, editorSection, locale, direction, showAdvanced, editCourse }: CourseContentEditorProps) {
  const teachingLocale = locale;
  const t = (chinese: string, english: string) => uiText(locale, chinese, english);
  const knowledgeOptions = course.knowledge.map((item) => ({ id: item.id, label: item.form || t("未命名知识点", "Untitled knowledge") }));
  const utteranceOptions = course.utterances.map((item, index) => ({ id: item.id, label: item.text || t("Utterance " + (index + 1), "Utterance " + (index + 1)) }));

  function addKnowledge() {
    editCourse((next) => next.knowledge.push({
      id: uniqueId("knowledge", next.knowledge.map((item) => item.id)),
      kind: "lexeme",
      form: "",
      meaning: { [teachingLocale]: "" },
    }));
  }

  function removeKnowledge(index: number) {
    editCourse((next) => {
      const [removed] = next.knowledge.splice(index, 1);
      if (!removed) return;
      next.utterances.forEach((item) => { item.knowledgeRefs = item.knowledgeRefs.filter((id) => id !== removed.id); });
      next.exercises.forEach((item) => { item.knowledgeRefs = item.knowledgeRefs.filter((id) => id !== removed.id); });
      next.lessons.forEach((lesson) => lesson.steps.forEach((step) => { step.knowledgeRefs = step.knowledgeRefs.filter((id) => id !== removed.id); }));
    });
  }

  function addUtterance() {
    editCourse((next) => next.utterances.push({
      id: uniqueId("utterance", next.utterances.map((item) => item.id)),
      text: "",
      translation: { [teachingLocale]: "" },
      knowledgeRefs: [],
    }));
  }

  function removeUtterance(index: number) {
    editCourse((next) => {
      const [removed] = next.utterances.splice(index, 1);
      if (!removed) return;
      next.exercises.forEach((item) => { item.utteranceRefs = item.utteranceRefs.filter((id) => id !== removed.id); });
      next.lessons.forEach((lesson) => lesson.steps.forEach((step) => { step.utteranceRefs = step.utteranceRefs.filter((id) => id !== removed.id); }));
    });
  }

  function addExercise() {
    editCourse((next) => next.exercises.push({
      id: uniqueId("exercise", next.exercises.map((item) => item.id)),
      kind: "role-play",
      prompt: { [teachingLocale]: "" },
      knowledgeRefs: [],
      utteranceRefs: [],
    }));
  }

  function removeExercise(index: number) {
    editCourse((next) => {
      const [removed] = next.exercises.splice(index, 1);
      if (!removed) return;
      next.lessons.forEach((lesson) => lesson.steps.forEach((step) => { step.exerciseRefs = step.exerciseRefs.filter((id) => id !== removed.id); }));
    });
  }

  function changeExerciseKind(index: number, kind: ExerciseKind) {
    editCourse((next) => {
      const exercise = next.exercises[index];
      if (!exercise) return;
      exercise.kind = kind;
      if (["single-choice", "multiple-choice", "ordering"].includes(kind) && !exercise.options?.length) {
        exercise.options = [{ [teachingLocale]: t("选项一", "Option one") }, { [teachingLocale]: t("选项二", "Option two") }];
      }
      if (kind === "single-choice") exercise.correctOptionIndex ??= 0;
      if (kind === "multiple-choice") exercise.correctOptionIndices ??= [0];
      if (kind === "ordering") exercise.correctOrder = exercise.options?.map((_, optionIndex) => optionIndex);
    });
  }

  function updateExerciseOptions(index: number, value: string) {
    editCourse((next) => {
      const exercise = next.exercises[index];
      if (!exercise) return;
      const lines = splitLines(value);
      exercise.options = lines.map((line, optionIndex) => ({ ...(exercise.options?.[optionIndex] ?? {}), [teachingLocale]: line }));
      if (exercise.correctOptionIndex !== undefined && exercise.correctOptionIndex >= lines.length) exercise.correctOptionIndex = 0;
      if (exercise.correctOptionIndices) exercise.correctOptionIndices = exercise.correctOptionIndices.filter((optionIndex) => optionIndex < lines.length);
      if (exercise.kind === "ordering") exercise.correctOrder = lines.map((_, optionIndex) => optionIndex);
    });
  }

  return (
    <>
    {editorSection === "knowledge" && (
      <div className="form-section">
        <div className="section-intro"><div><h3>{t("知识点", "Knowledge")}</h3><p>{t("维护词汇、语法、字符或文化知识。", "Maintain vocabulary, grammar, script, and pragmatic knowledge.")}</p></div><button className="outline-button" onClick={addKnowledge}><Plus size={15} />{t("添加知识点", "Add knowledge")}</button></div>
        <div className="item-stack">
          {course.knowledge.map((item, index) => (
            <article className="edit-card" key={`${item.id}-${index}`}>
              <div className="edit-card-heading"><span>{t(`知识点 ${index + 1}`, `Knowledge ${index + 1}`)}</span><button onClick={() => removeKnowledge(index)} aria-label={t(`删除知识点 ${index + 1}`, `Delete knowledge ${index + 1}`)}><Trash2 size={15} /></button></div>
              <div className="form-grid three-column">
                <label><span>{t("类型", "Type")}</span><select value={item.kind} onChange={(event) => editCourse((next) => { next.knowledge[index].kind = event.target.value as typeof item.kind; })}><option value="lexeme">{t("词汇", "Vocabulary")}</option><option value="grammar">{t("语法", "Grammar")}</option><option value="script">{t("文字系统", "Script")}</option><option value="pragmatics">{t("语用文化", "Pragmatics")}</option></select></label>
                <label><span>{t("目标语形式", "Target-language form")}</span><input value={item.form} dir={direction} onChange={(event) => editCourse((next) => { next.knowledge[index].form = event.target.value; })} /></label>
                <label className="wide"><span>{teachingLocale === "en" ? "English meaning" : t("中文释义", "Chinese meaning")}</span><input value={item.meaning[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.knowledge[index].meaning[teachingLocale] = event.target.value; })} /></label>
              </div>
            </article>
          ))}
        </div>
      </div>
    )}

    {editorSection === "utterances" && (
      <div className="form-section">
        <div className="section-intro"><div><h3>{t("例句与表达", "Utterances")}</h3><p>{t("添加学习者会听到、读到和练习的自然表达。", "Add natural expressions learners will read and practise.")}</p></div><button className="outline-button" onClick={addUtterance}><Plus size={15} />{t("添加例句", "Add utterance")}</button></div>
        <div className="item-stack">
          {course.utterances.map((item, index) => (
            <article className="edit-card" key={`${item.id}-${index}`}>
              <div className="edit-card-heading"><span>{t(`例句 ${index + 1}`, `Utterance ${index + 1}`)}</span><button onClick={() => removeUtterance(index)} aria-label={t(`删除例句 ${index + 1}`, `Delete utterance ${index + 1}`)}><Trash2 size={15} /></button></div>
              <div className="form-grid two-column">
                <ReferencePicker label={t("关联知识点", "Related knowledge")} options={knowledgeOptions} selected={item.knowledgeRefs} emptyLabel={t("请先添加知识点", "Add knowledge first")} onChange={(ids) => editCourse((next) => { next.utterances[index].knowledgeRefs = ids; })} />
                <label className="wide"><span>{t("目标语例句", "Target-language utterance")}</span><textarea dir={direction} value={item.text} onChange={(event) => editCourse((next) => { next.utterances[index].text = event.target.value; })} /></label>
                <label className="wide"><span>{teachingLocale === "en" ? "English translation" : t("中文翻译", "Chinese translation")}</span><input value={item.translation?.[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.utterances[index].translation = { ...(next.utterances[index].translation ?? {}), [teachingLocale]: event.target.value }; })} /></label>
              </div>
            </article>
          ))}
        </div>
      </div>
    )}

    {editorSection === "exercises" && (
      <div className="form-section">
        <div className="section-intro"><div><h3>{t("练习", "Exercises")}</h3><p>{t("定义理解、产出和角色扮演任务。", "Define comprehension, production, and role-play tasks.")}</p></div><button className="outline-button" onClick={addExercise}><Plus size={15} />{t("添加练习", "Add exercise")}</button></div>
        <div className="item-stack">
          {course.exercises.map((item, index) => (
            <article className="edit-card" key={`${item.id}-${index}`}>
              <div className="edit-card-heading"><span>{t(`练习 ${index + 1}`, `Exercise ${index + 1}`)}</span><button onClick={() => removeExercise(index)} aria-label={t(`删除练习 ${index + 1}`, `Delete exercise ${index + 1}`)}><Trash2 size={15} /></button></div>
              <div className="form-grid two-column">
                <label><span>{t("类型", "Type")}</span><select value={item.kind} onChange={(event) => changeExerciseKind(index, event.target.value as ExerciseKind)}><option value="single-choice">{t("单选理解", "Single choice")}</option><option value="multiple-choice">{t("多选理解", "Multiple choice")}</option><option value="ordering">{t("排序", "Ordering")}</option><option value="fill-blank">{t("填空", "Fill in the blank")}</option><option value="short-input">{t("简短输入", "Short input")}</option><option value="cloze">{t("完形填空", "Cloze")}</option><option value="substitution">{t("替换表达", "Substitution")}</option><option value="reconstruction">{t("重组表达", "Reconstruction")}</option><option value="matching">{t("匹配", "Matching")}</option><option value="role-play">{t("角色扮演", "Role-play")}</option><option value="free-response">{t("自由回答", "Free response")}</option></select></label>
                <label className="wide"><span>{t("任务提示", "Task prompt")}（{teachingLocale === "en" ? "English" : "中文"}）</span><textarea value={item.prompt[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.exercises[index].prompt[teachingLocale] = event.target.value; })} /></label>
                {["single-choice", "multiple-choice", "ordering"].includes(item.kind) && <label className="wide"><span>{t("选项（每行一个）", "Options (one per line)")}（{teachingLocale === "en" ? "English" : "中文"}）</span><textarea value={localizedOptionLines(item.options, teachingLocale)} onChange={(event) => updateExerciseOptions(index, event.target.value)} placeholder={t("第一项\n第二项", "First item\nSecond item")} /></label>}
                {item.kind === "single-choice" && <label><span>{t("正确选项", "Correct option")}</span><select value={item.correctOptionIndex ?? 0} onChange={(event) => editCourse((next) => { next.exercises[index].correctOptionIndex = Number(event.target.value); })}>{(item.options ?? []).map((option, optionIndex) => <option value={optionIndex} key={optionIndex}>{optionIndex + 1}. {displayText(option, teachingLocale)}</option>)}</select></label>}
                {item.kind === "multiple-choice" && <label><span>{t("正确选项序号（逗号分隔）", "Correct option numbers (comma-separated)")}</span><input value={(item.correctOptionIndices ?? []).map((value) => value + 1).join(", ")} onChange={(event) => editCourse((next) => { next.exercises[index].correctOptionIndices = [...new Set(splitRefs(event.target.value).map(Number).filter((value) => Number.isInteger(value) && value > 0).map((value) => value - 1))]; })} placeholder="1, 3" /></label>}
                {item.kind === "ordering" && <label><span>{t("正确顺序", "Correct order")}</span><input value={t("按上方行顺序", "Same as the line order above")} readOnly /></label>}
                {!["single-choice", "multiple-choice", "ordering"].includes(item.kind) && <label className="wide"><span>{t("可接受答案（可选，每行一个）", "Accepted answers (optional, one per line)")}</span><textarea value={item.acceptedAnswers?.join("\n") ?? ""} onChange={(event) => editCourse((next) => { const answers = splitLines(event.target.value); if (answers.length) next.exercises[index].acceptedAnswers = answers; else delete next.exercises[index].acceptedAnswers; })} placeholder={t("留空时使用自评或 AI 反馈", "Leave empty to use self-assessment or AI feedback")} /></label>}
                <label className="wide"><span>{t("作答提示（可选）", "Learner support (optional)")}（{teachingLocale === "en" ? "English" : "中文"}）</span><textarea value={item.guidance?.[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.exercises[index].guidance = { ...(next.exercises[index].guidance ?? {}), [teachingLocale]: event.target.value }; })} /></label>
                <ReferencePicker label={t("练习涉及的知识点", "Knowledge used by this exercise")} options={knowledgeOptions} selected={item.knowledgeRefs} emptyLabel={t("暂无知识点，可稍后添加", "No knowledge yet; you can add it later")} onChange={(ids) => editCourse((next) => { next.exercises[index].knowledgeRefs = ids; })} />
                <ReferencePicker label={t("练习使用的例句", "Utterances used by this exercise")} options={utteranceOptions} selected={item.utteranceRefs} emptyLabel={t("请先添加例句", "Add utterances first")} onChange={(ids) => editCourse((next) => { next.exercises[index].utteranceRefs = ids; })} />
                {showAdvanced && <><label><span>{t("所需语言能力（逗号分隔）", "Required language capabilities (comma-separated)")}</span><input placeholder={t("例如 token-comparison", "For example: token-comparison")} value={item.requiredCapabilities?.join(", ") ?? ""} onChange={(event) => editCourse((next) => { const capabilities = splitRefs(event.target.value) as NonNullable<CoursePack["exercises"][number]["requiredCapabilities"]>; if (capabilities.length) next.exercises[index].requiredCapabilities = capabilities; else delete next.exercises[index].requiredCapabilities; })} /></label><label><span>{t("能力不足时", "When capabilities are missing")}</span><select value={item.capabilityFallback ?? "self-assessment"} onChange={(event) => editCourse((next) => { next.exercises[index].capabilityFallback = event.target.value as NonNullable<CoursePack["exercises"][number]["capabilityFallback"]>; })}><option value="self-assessment">{t("学习者自评", "Learner self-assessment")}</option><option value="reference-answer">{t("显示参考答案", "Show reference answer")}</option><option value="disabled">{t("跳过且不计证据", "Skip without evidence")}</option></select></label></>}
              </div>
            </article>
          ))}
        </div>
      </div>
    )}

    </>
  );
}
