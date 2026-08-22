"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Clock3, MapPinned, Target } from "lucide-react";
import {
  createExerciseResponse,
  createLearningPlan,
  evaluateExerciseResponse,
  placementQuestions,
  type CreateLearningPlanCommand,
  type ExerciseResponse,
  type LearningMotivation,
  type LearningPlan,
  type PlacementLessonResult,
} from "@learn-language/application";
import { ExerciseRenderer } from "@/app/exercise-renderer";
import { displayText, type CoursePack } from "@/lib/course";
import { uiText, type AppLocale } from "@/lib/i18n";

const motivations: Array<{ id: LearningMotivation; label: [string, string]; detail: [string, string] }> = [
  { id: "travel", label: ["旅行交流", "Travel"], detail: ["问路、购物、点单和基础求助", "Directions, shopping, ordering, and help"] },
  { id: "daily-life", label: ["日常生活", "Daily life"], detail: ["建立持续可用的生活表达", "Build useful everyday communication"] },
  { id: "work-study", label: ["工作或学习", "Work or study"], detail: ["为后续专业场景打好基础", "Prepare for later professional contexts"] },
  { id: "culture-media", label: ["文化与内容", "Culture and media"], detail: ["逐步理解文章、影视和歌曲文本", "Work toward articles, shows, and song text"] },
];

export function LearningPlanSetup({
  course,
  locale,
  existingPlan,
  onSave,
  onStart,
  onCancel,
}: {
  course: CoursePack;
  locale: AppLocale;
  existingPlan?: LearningPlan;
  onSave: (command: CreateLearningPlanCommand) => Promise<LearningPlan>;
  onStart: (lessonId: string) => void;
  onCancel: () => void;
}) {
  const c = (chinese: string, english: string) => uiText(locale, chinese, english);
  const questions = useMemo(() => placementQuestions(course), [course]);
  const [phase, setPhase] = useState<"preferences" | "placement" | "result">(existingPlan ? "result" : "preferences");
  const [motivation, setMotivation] = useState<LearningMotivation>(existingPlan?.motivation ?? "travel");
  const [minutesPerDay, setMinutesPerDay] = useState(existingPlan?.minutesPerDay ?? 15);
  const [daysPerWeek, setDaysPerWeek] = useState(existingPlan?.daysPerWeek ?? 5);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, ExerciseResponse>>({});
  const [results, setResults] = useState<PlacementLessonResult[]>([]);
  const [pending, setPending] = useState<{ command: CreateLearningPlanCommand; preview: LearningPlan }>();
  const [savedPlan, setSavedPlan] = useState(existingPlan);
  const [startingLessonId, setStartingLessonId] = useState(existingPlan?.startingLessonId ?? existingPlan?.placement.recommendedLessonId ?? course.lessons[0]?.id ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const currentQuestion = questions[questionIndex];
  const currentExercise = currentQuestion ? course.exercises.find((item) => item.id === currentQuestion.exerciseRef) : undefined;
  const currentResponse = currentExercise
    ? responses[currentExercise.id] ?? createExerciseResponse(currentExercise)
    : undefined;
  const plan = savedPlan ?? pending?.preview;

  function previewPlan(mode: "skipped" | "completed", placementResults: PlacementLessonResult[]) {
    const occurredAt = new Date().toISOString();
    const command: CreateLearningPlanCommand = {
      motivation,
      minutesPerDay,
      daysPerWeek,
      placementMode: mode,
      placementResults,
      occurredAt,
    };
    const preview = createLearningPlan(course, command);
    setPending({ command, preview });
    setStartingLessonId(preview.startingLessonId);
    setPhase("result");
  }

  function answerCurrentQuestion() {
    if (!currentQuestion || !currentExercise || !currentResponse) return;
    const evaluation = evaluateExerciseResponse(currentExercise, currentResponse);
    if (evaluation.status === "empty") {
      setError(c("请先完成这道检查题", "Complete this check before continuing"));
      return;
    }
    if (evaluation.status === "manual") {
      setError(c("这道题不能用于自动入学评估", "This item cannot be scored automatically for placement"));
      return;
    }
    const nextResults = [...results, { lessonId: currentQuestion.lessonId, passed: evaluation.status === "pass" }];
    setResults(nextResults);
    setError("");
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex((index) => index + 1);
    } else {
      previewPlan("completed", nextResults);
    }
  }

  async function saveAndStart() {
    if (!pending) {
      onStart(startingLessonId || plan?.startingLessonId || course.lessons[0]!.id);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const stored = await onSave({ ...pending.command, startingLessonId, occurredAt: new Date().toISOString() });
      setSavedPlan(stored);
      setPending(undefined);
      onStart(stored.startingLessonId);
    } catch {
      setError(c("学习计划保存失败，请检查设备存储权限", "The learning plan could not be saved. Check device storage permissions."));
    } finally {
      setSaving(false);
    }
  }

  function restart() {
    setPhase("preferences");
    setSavedPlan(undefined);
    setPending(undefined);
    setQuestionIndex(0);
    setResponses({});
    setResults([]);
    setError("");
  }

  return (
    <main className="learning-plan-shell">
      <header className="learning-plan-topbar">
        <button type="button" onClick={onCancel}><ArrowLeft size={16} />{c("返回", "Back")}</button>
        <div><span>PERSONAL LEARNING PLAN</span><strong>{c("设置你的学习路线", "Set your learning path")}</strong></div>
        <em>{displayText(course.manifest.title, locale)}</em>
      </header>

      <section className="learning-plan-progress" aria-label={c("计划设置进度", "Plan setup progress")}>
        {["preferences", "placement", "result"].map((item, index) => <span key={item} className={phase === item || (["preferences", "placement", "result"].indexOf(phase) > index) ? "active" : ""}>{index + 1}</span>)}
      </section>

      {phase === "preferences" && (
        <section className="learning-plan-card preferences">
          <div className="learning-plan-heading"><span><Target size={23} /></span><div><small>{c("第一步", "STEP ONE")}</small><h1>{c("你为什么学习这门语言？", "Why are you learning this language?")}</h1><p>{c("目标只影响计划表达和推荐节奏，不会限制你能学习的课程内容。", "Your goal shapes the plan and pace without limiting course content.")}</p></div></div>
          <div className="motivation-grid" role="radiogroup" aria-label={c("学习目标", "Learning goal")}>
            {motivations.map((item) => <button type="button" role="radio" aria-checked={motivation === item.id} className={motivation === item.id ? "selected" : ""} key={item.id} onClick={() => setMotivation(item.id)}><strong>{c(...item.label)}</strong><small>{c(...item.detail)}</small>{motivation === item.id && <Check size={16} />}</button>)}
          </div>
          <div className="plan-pace-grid">
            <label><span><Clock3 size={15} />{c("每天学习时间", "Minutes per day")}</span><select value={minutesPerDay} onChange={(event) => setMinutesPerDay(Number(event.target.value))}><option value={10}>{c("10 分钟", "10 minutes")}</option><option value={15}>{c("15 分钟", "15 minutes")}</option><option value={25}>{c("25 分钟", "25 minutes")}</option><option value={40}>{c("40 分钟", "40 minutes")}</option></select></label>
            <label><span><MapPinned size={15} />{c("每周学习天数", "Days per week")}</span><select value={daysPerWeek} onChange={(event) => setDaysPerWeek(Number(event.target.value))}><option value={3}>{c("每周 3 天", "3 days a week")}</option><option value={5}>{c("每周 5 天", "5 days a week")}</option><option value={7}>{c("每天", "Every day")}</option></select></label>
          </div>
          <footer><button className="secondary" type="button" onClick={() => previewPlan("skipped", [])}>{c("跳过评估，从第一课开始", "Skip placement and start at lesson 1")}</button><button className="primary" type="button" onClick={() => questions.length ? setPhase("placement") : previewPlan("skipped", [])}>{c(`开始 ${questions.length} 题基础检查`, `Start ${questions.length}-item foundation check`)}<ArrowRight size={16} /></button></footer>
        </section>
      )}

      {phase === "placement" && currentQuestion && currentExercise && currentResponse && (
        <section className="learning-plan-card placement">
          <div className="learning-plan-heading"><span><ClipboardCheck size={23} /></span><div><small>{c(`基础检查 ${questionIndex + 1}/${questions.length}`, `FOUNDATION CHECK ${questionIndex + 1}/${questions.length}`)}</small><h1>{displayText(course.lessons[currentQuestion.lessonIndex]?.title, locale)}</h1><p>{c("只用于推荐起始课节，不是 CEFR 或其他考试成绩，也不会写入掌握度。", "This only recommends a starting lesson. It is not a CEFR or exam score and creates no mastery evidence.")}</p></div></div>
          <div className="placement-exercise"><strong>{displayText(currentExercise.prompt, locale)}</strong><ExerciseRenderer exercise={currentExercise} response={currentResponse} locale={locale} onChange={(response) => { setResponses((current) => ({ ...current, [currentExercise.id]: response })); setError(""); }} /></div>
          {error && <p className="learning-plan-error">{error}</p>}
          <footer><button className="secondary" type="button" onClick={() => previewPlan("skipped", [])}>{c("跳过检查", "Skip check")}</button><button className="primary" type="button" onClick={answerCurrentQuestion}>{questionIndex + 1 === questions.length ? c("查看推荐", "See recommendation") : c("下一题", "Next question")}<ArrowRight size={16} /></button></footer>
        </section>
      )}

      {phase === "result" && plan && (
        <section className="learning-plan-card result">
          <div className="learning-plan-heading"><span><MapPinned size={23} /></span><div><small>{c("个人学习计划", "YOUR PLAN")}</small><h1>{c("你的第一周路线已经准备好", "Your first-week path is ready")}</h1><p>{plan.placement.mode === "completed" ? c(`基础检查答对 ${plan.placement.correctCount}/${plan.placement.total} 题；这只是课程起点建议。`, `${plan.placement.correctCount}/${plan.placement.total} foundation checks passed. This is only a course starting-point recommendation.`) : c("你跳过了基础检查，可以从第一课开始或手动选择其他课节。", "You skipped placement. Start at lesson 1 or choose another lesson manually.")}</p></div></div>
          <div className="plan-result-grid"><article><small>{c("每周投入", "Weekly time")}</small><strong>{plan.weeklyTargetMinutes} {c("分钟", "min")}</strong><span>{c(`${plan.daysPerWeek} 天 × 每天 ${plan.minutesPerDay} 分钟`, `${plan.daysPerWeek} days × ${plan.minutesPerDay} min`)}</span></article><article><small>{c("建议进度", "Suggested progress")}</small><strong>{c(`${plan.lessonTargetCount} 个课节`, `${plan.lessonTargetCount} lessons`)}</strong><span>{c(`另预留约 ${plan.reviewTargetMinutes} 分钟复习`, `About ${plan.reviewTargetMinutes} min reserved for review`)}</span></article><article><small>{c("评估跳过", "Placed out")}</small><strong>{plan.placement.placedOutLessonIds.length}</strong><span>{c("不生成虚假掌握度", "No artificial mastery evidence")}</span></article></div>
          <label className="starting-lesson-select"><span>{c("开始课节（可以调整）", "Starting lesson (adjustable)")}</span><select value={startingLessonId} disabled={Boolean(savedPlan && !pending)} onChange={(event) => setStartingLessonId(event.target.value)}>{course.lessons.map((lesson, index) => <option key={lesson.id} value={lesson.id}>{index + 1}. {displayText(lesson.title, locale)}</option>)}</select><small>{c(`系统推荐：${displayText(course.lessons.find((lesson) => lesson.id === plan.placement.recommendedLessonId)?.title, locale)}`, `Recommended: ${displayText(course.lessons.find((lesson) => lesson.id === plan.placement.recommendedLessonId)?.title, locale)}`)}</small></label>
          {error && <p className="learning-plan-error">{error}</p>}
          <footer><button className="secondary" type="button" onClick={restart}>{c("重新设置", "Set up again")}</button><button className="primary" type="button" disabled={saving} onClick={() => void saveAndStart()}>{saving ? c("正在保存…", "Saving…") : existingPlan && !pending ? c("从计划继续", "Continue from plan") : c("保存计划并开始", "Save plan and start")}<ArrowRight size={16} /></button></footer>
        </section>
      )}
    </main>
  );
}
