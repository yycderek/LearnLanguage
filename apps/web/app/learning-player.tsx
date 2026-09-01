"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleAlert,
  Eye,
  Lightbulb,
  ListChecks,
  MessageCircleQuestion,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import { requestAiFeedback, requestAiTutor, type AiSettings, type AiTutorAnswer } from "@/lib/ai";
import { ExerciseRenderer } from "@/app/exercise-renderer";
import { PronunciationControls } from "@/app/pronunciation-button";
import { displayText, type CoursePack } from "@/lib/course";
import { IndexedDbEffectQueue } from "@/lib/device-repository";
import { resolveExerciseCapabilities, type LanguagePack } from "@/lib/language-pack";
import { dateLocale, uiText, type AppLocale } from "@/lib/i18n";
import { buildLearnerStages, type LearnerStageId } from "@/lib/learning-presentation";
import type { EvaluationSource } from "@learn-language/protocol";
import {
  createExerciseResponse,
  evaluateExerciseResponse,
  serializeExerciseResponse,
  textExerciseResponse,
  type ExerciseResponse,
} from "@learn-language/application";
import { createAiFeedbackEffect, createAiTutorEffect, type AiTutorIntent } from "@learn-language/engine";
import {
  learningPercent,
  startLearning,
  submitLearningStep,
  type LearningProgress,
  type MasteryLevel,
  type ReviewMode,
} from "@/lib/learning";

type Feedback = {
  kind: "success" | "retry" | "review";
  title: string;
  message: string;
  source?: "ai" | "local";
  detail?: string;
  diagnosticAction?: "skip" | "learn";
  nextStepId?: string;
};

const phaseNames: Record<string, [string, string]> = {
  diagnostic: ["诊断", "Diagnostic"],
  preteach: ["知识预教", "Pre-teaching"],
  "supported-input": ["支持性输入", "Supported input"],
  comprehension: ["独立理解", "Comprehension"],
  "guided-output": ["引导输出", "Guided output"],
  "independent-task": ["独立任务", "Independent task"],
  "feedback-retry": ["反馈重试", "Feedback retry"],
  "delayed-transfer": ["延迟迁移", "Delayed transfer"],
};

const learnerStageNames: Record<LearnerStageId, [string, string]> = {
  learn: ["理解", "Learn"],
  practice: ["练习", "Practice"],
  use: ["运用", "Use"],
};

const learnerStageDescriptions: Record<LearnerStageId, [string, string]> = {
  learn: ["认识新内容并理解场景", "Meet new content and understand it in context"],
  practice: ["提取信息并重组表达", "Retrieve meaning and rebuild the expression"],
  use: ["独立完成任务并迁移运用", "Complete the task independently and transfer it"],
};

const masteryNames: Record<MasteryLevel, [string, string]> = {
  encountered: ["已接触", "Encountered"],
  comprehended: ["已理解", "Comprehended"],
  "prompted-output": ["提示下输出", "Prompted output"],
  "independent-output": ["独立输出", "Independent output"],
  "delayed-transfer": ["延迟迁移", "Delayed transfer"],
};

const reviewNames: Record<ReviewMode, [string, string]> = {
  recognition: ["识别复习", "Recognition"],
  "active-recall": ["主动回忆", "Active recall"],
  scenario: ["场景练习", "Scenario practice"],
  transfer: ["迁移任务", "Transfer task"],
  fluency: ["流利度巩固", "Fluency review"],
};

function formatDue(value: string, locale: AppLocale) {
  return new Date(value).toLocaleString(dateLocale(locale), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function LearningPlayer({
  course,
  initialProgress,
  languagePack,
  locale = "zh-CN",
  preview = false,
  aiSettings,
  onConfigureAi,
  onProgress,
  onExit,
}: {
  course: CoursePack;
  initialProgress: LearningProgress;
  languagePack?: LanguagePack;
  locale?: AppLocale;
  preview?: boolean;
  aiSettings?: AiSettings;
  onConfigureAi?: () => void;
  onProgress: (progress: LearningProgress) => void;
  onExit: () => void;
}) {
  const teachingLocale = locale;
  const uiLocale = locale;
  const c = (chinese: string, english: string) => uiText(locale, chinese, english);
  const [progress, setProgress] = useState(initialProgress);
  const [response, setResponse] = useState<ExerciseResponse>();
  const [showSupport, setShowSupport] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();
  const [evaluating, setEvaluating] = useState(false);
  const [reviewPlanOpen, setReviewPlanOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [tutorReply, setTutorReply] = useState<AiTutorAnswer>();
  const [tutorError, setTutorError] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);

  const lesson = course.lessons.find((item) => item.id === progress.lessonId) ?? course.lessons[0];
  const currentStep = lesson?.steps.find((item) => item.id === progress.currentStepId);
  const exercise = currentStep?.exerciseRefs.map((id) => course.exercises.find((item) => item.id === id)).find(Boolean);
  const knowledge = currentStep?.knowledgeRefs.map((id) => course.knowledge.find((item) => item.id === id)).filter(Boolean) ?? [];
  const utterances = currentStep?.utteranceRefs.map((id) => course.utterances.find((item) => item.id === id)).filter(Boolean) ?? [];
  const percent = learningPercent(course, progress);
  const learnerStages = lesson ? buildLearnerStages(lesson, currentStep?.id ?? "", progress.completedStepIds) : [];
  const activeStageIndex = Math.max(0, learnerStages.findIndex((stage) => stage.status === "active"));
  const activeStage = learnerStages[activeStageIndex];
  const targetForms = knowledge.map((item) => item?.form.trim()).filter(Boolean) as string[];
  const activeResponse = exercise ? response ?? createExerciseResponse(exercise) : undefined;
  const capabilityResolution = exercise
    ? languagePack
      ? resolveExerciseCapabilities(exercise, languagePack)
      : { mode: exercise.capabilityFallback ?? "disabled", missing: exercise.requiredCapabilities ?? [] }
    : { mode: "native" as const, missing: [] };

  function persist(next: LearningProgress) {
    setProgress(next);
    onProgress(next);
  }

  function resetStepUi() {
    setResponse(undefined);
    setShowSupport(false);
    setFeedback(undefined);
    setEvaluating(false);
    setTutorOpen(false);
    setTutorQuestion("");
    setTutorReply(undefined);
    setTutorError("");
    setTutorBusy(false);
  }

  function advance(evaluationSource: EvaluationSource = "deterministic", evidenceEligible = true, nextStepId?: string, score = 1) {
    if (!currentStep) return;
    const next = submitLearningStep(course, progress, {
      decision: "advance",
      answer: serializeExerciseResponse(activeResponse),
      score,
      evaluationSource,
      evidenceEligible,
      usedSupport: showSupport,
      nextStepId,
    });
    persist(next);
    resetStepUi();
  }

  function retry(message: string, title = c("还差一点", "Almost there"), source: "ai" | "local" = "local", detail?: string) {
    if (!currentStep) return;
    const next = submitLearningStep(course, progress, {
      decision: "retry",
      answer: serializeExerciseResponse(activeResponse),
      score: 0,
      evaluationSource: "deterministic",
      usedSupport: showSupport,
    });
    persist(next);
    setFeedback({ kind: "retry", title, message, source, detail });
  }

  async function submitAnswer() {
    if (!currentStep) return;
    if (!exercise) {
      advance();
      return;
    }
    if (capabilityResolution.mode === "disabled") {
      advance("self", false);
      return;
    }
    if (capabilityResolution.mode === "reference-answer") {
      const reference = exercise.acceptedAnswers?.join(" / ")
        || utterances.map((item) => item?.text ?? "").filter(Boolean).join(" / ")
        || targetForms.join(" / ");
      setFeedback({
        kind: "review",
        title: c("请对照参考答案自行确认", "Compare with the reference answer"),
        message: reference || c("当前课程未提供参考答案，请查看提示后自行判断。", "This course has no reference answer. Review the support and decide for yourself."),
        source: "local",
      });
      return;
    }
    const exerciseResponse = activeResponse ?? createExerciseResponse(exercise);
    const deterministic = evaluateExerciseResponse(exercise, exerciseResponse);
    if (deterministic.status === "empty") {
      setFeedback({ kind: "retry", title: c("先完成这道练习", "Complete the exercise first"), message: c("作答后再提交；不必追求一次就完美。", "Add your response before submitting. It does not need to be perfect.") });
      return;
    }
    if (currentStep.diagnostic && deterministic.status === "pass") {
      setFeedback({
        kind: "success",
        title: c("基础检查通过", "Diagnostic passed"),
        message: c("你已掌握本课检查内容，可以直接完成本课；之后仍可随时重新学习。", "You already know the checked material, so you can complete this lesson now and revisit it later."),
        diagnosticAction: "skip",
        nextStepId: currentStep.diagnostic.passNextStepId,
      });
      return;
    }
    if (currentStep.diagnostic && deterministic.status === "retry") {
      setFeedback({
        kind: "review",
        title: c("建议学习本课", "Study this lesson"),
        message: c("这次检查还没有覆盖本课目标，接下来会从核心内容开始学习，不需要反复重做检查。", "This check did not yet meet the lesson goal. Continue into the lesson instead of repeating the diagnostic."),
        diagnosticAction: "learn",
        nextStepId: currentStep.diagnostic.learnNextStepId,
      });
      return;
    }
    if (deterministic.status === "pass") {
      setFeedback({ kind: "success", title: c("回答正确", "Correct"), message: c("答案符合这道练习的目标，可以继续下一步。", "Your answer meets this exercise's goal. You can continue.") });
      return;
    }
    if (deterministic.status === "retry") {
      retry(exercise.guidance ? displayText(exercise.guidance, teachingLocale) : c("根据本课内容调整答案后再试一次。", "Review the lesson content, adjust your answer, and try again."));
      return;
    }
    const normalized = textExerciseResponse(exerciseResponse);
    if (!normalized) {
      setFeedback({ kind: "review", title: c("这道练习需要自行确认", "This exercise needs self-assessment"), message: c("课程没有提供可自动判定的答案，请查看提示并确认是否完成目标。", "The course has no deterministic answer key. Review the support and confirm whether you completed the goal."), source: "local" });
      return;
    }
    if (aiSettings) {
      setEvaluating(true);
      setFeedback(undefined);
      const effect = createAiFeedbackEffect({
        requestId: crypto.randomUUID(),
        sessionId: progress.sessionId,
        courseId: progress.courseId,
        lessonId: progress.lessonId,
        stepId: currentStep.id,
        afterSequence: progress.engineEvents.at(-1)?.sequence ?? progress.events.length,
      });
      const effectQueue = preview ? undefined : new IndexedDbEffectQueue();
      await effectQueue?.enqueue([effect], new Date().toISOString()).catch(() => undefined);
      try {
        const result = await requestAiFeedback(aiSettings, {
          course,
          lessonTitle: displayText(lesson?.title, teachingLocale),
          prompt: displayText(exercise.prompt, teachingLocale),
          answer: normalized,
          targetForms,
          guidance: exercise.guidance ? displayText(exercise.guidance, teachingLocale) : undefined,
          teachingLocale,
        });
        const message = result.suggestion ? c(`${result.message} 建议表达：${result.suggestion}`, `${result.message} Suggested version: ${result.suggestion}`) : result.message;
        setFeedback({
          kind: "review",
          title: result.title,
          message,
          source: "ai",
          detail: result.verdict === "pass"
            ? c("AI 认为任务基本完成，请由你最终确认；确认后将作为自评证据记录。", "AI considers the task complete. Confirm it yourself before it becomes self-assessed evidence.")
            : c("AI 建议修改，但不会自动判错；你可以继续修改或自行确认。", "AI suggests a revision but does not mark you wrong. Revise or confirm it yourself."),
        });
        await effectQueue?.markCompleted(effect.id).catch(() => undefined);
        return;
      } catch (error) {
        const detail = error instanceof Error ? error.message : c("AI 服务暂时不可用。", "The AI service is temporarily unavailable.");
        const usesTargetLanguage = targetForms.length === 0 || targetForms.some((form) => normalized.includes(form));
        if (usesTargetLanguage) {
          setFeedback({ kind: "success", title: c("本地规则判定通过", "Passed by local rules"), message: c("回答包含本课目标表达，可以继续下一步。", "Your answer contains the target expression. You can continue."), source: "local", detail });
        } else {
          retry(exercise.guidance ? displayText(exercise.guidance, teachingLocale) : c("尝试加入本课的关键词或句型后再提交。", "Add a keyword or pattern from this lesson and submit again."), c("请根据提示再试一次", "Try again with the support"), "local", detail);
        }
        return;
      } finally {
        setEvaluating(false);
      }
    }
    const usesTargetLanguage = targetForms.length === 0 || targetForms.some((form) => normalized.includes(form));
    if (usesTargetLanguage) {
      setFeedback({ kind: "success", title: c("任务完成", "Task complete"), message: c("回答使用了本课目标表达，可以继续下一步。", "Your answer uses the target expression. You can continue."), source: "local" });
    } else {
      retry(exercise.guidance ? displayText(exercise.guidance, teachingLocale) : c("尝试加入本课的关键词或句型后再提交。", "Add a keyword or pattern from this lesson and submit again."));
    }
  }

  async function askTutor(intent: AiTutorIntent) {
    if (!aiSettings || !lesson || !currentStep) {
      setTutorOpen(true);
      return;
    }
    if (intent === "question" && !tutorQuestion.trim()) {
      setTutorError(c("请先输入想问的问题。", "Enter a question first."));
      return;
    }
    setTutorBusy(true);
    setTutorError("");
    setTutorReply(undefined);
    const requestId = crypto.randomUUID();
    const effect = createAiTutorEffect({
      requestId,
      intent,
      sessionId: progress.sessionId,
      courseId: progress.courseId,
      lessonId: progress.lessonId,
      stepId: currentStep.id,
      afterSequence: progress.engineEvents.at(-1)?.sequence ?? progress.events.length,
    });
    const effectQueue = preview ? undefined : new IndexedDbEffectQueue();
    await effectQueue?.enqueue([effect], new Date().toISOString()).catch(() => undefined);
    try {
      const answer = await requestAiTutor(aiSettings, {
        course,
        lessonTitle: displayText(lesson.title, teachingLocale),
        stepTitle: displayText(currentStep.title, teachingLocale),
        phase: currentStep.phase,
        task: exercise ? displayText(exercise.prompt, teachingLocale) : undefined,
        learnerResponse: activeResponse ? textExerciseResponse(activeResponse) || undefined : undefined,
        knowledge: knowledge.flatMap((item) => item ? [{ form: item.form, meaning: displayText(item.meaning, teachingLocale) }] : []),
        utterances: utterances.flatMap((item) => item ? [{ text: item.text, ...(item.translation ? { translation: displayText(item.translation, teachingLocale) } : {}) }] : []),
        intent,
        question: intent === "question" ? tutorQuestion.trim() : undefined,
        teachingLocale,
      });
      setTutorReply(answer);
      await effectQueue?.markCompleted(effect.id).catch(() => undefined);
    } catch (error) {
      setTutorError(error instanceof Error ? error.message : c("AI 导师暂时不可用。", "The AI tutor is temporarily unavailable."));
    } finally {
      setTutorBusy(false);
    }
  }

  function tryAgain() {
    setResponse(undefined);
    setShowSupport(true);
    setFeedback(undefined);
    setEvaluating(false);
  }

  function restart() {
    const next = startLearning(course, progress.lessonId);
    persist(next);
    setReviewPlanOpen(false);
    resetStepUi();
  }

  if (progress.status === "completed") {
    const mastered = Object.values(progress.mastery);
    return (
      <main className="learner-shell completion-shell">
        <header className="learner-topbar">
          <button className="learner-back" onClick={onExit}><ArrowLeft size={17} />{c("返回学习首页", "Back to learning home")}</button>
          <span className="device-pill">{preview ? c("预览进度不会保存", "Preview progress is not saved") : c("进度已保存到当前设备", "Progress saved on this device")}</span>
        </header>
        <section className="completion-card">
          <div className="completion-mark"><CheckCircle2 size={38} /></div>
          <span className="kicker">LESSON COMPLETE</span>
          <h1>{c("本课学习完成", "Lesson complete")}</h1>
          <p>{displayText(lesson?.title, teachingLocale)} · {c("本课学习路径已完成", "Lesson path completed")}</p>
          <div className="completion-stats">
            <div><strong>{mastered.length}</strong><span>{c("已记录知识点", "Knowledge items")}</span></div>
            <div><strong>{progress.events.filter((item) => item.type === "attempt.recorded").length}</strong><span>{c("学习尝试", "Learning attempts")}</span></div>
            <div><strong>{progress.reviews.length}</strong><span>{c("复习任务", "Review tasks")}</span></div>
          </div>
          <div className="mastery-summary">
            <div className="summary-heading"><div><Target size={17} /><strong>{c("掌握度", "Mastery")}</strong></div><button onClick={() => setReviewPlanOpen((open) => !open)}><CalendarClock size={15} />{reviewPlanOpen ? c("隐藏复习计划", "Hide review plan") : c("查看复习计划", "View review plan")}</button></div>
            {mastered.map((item) => {
              const content = course.knowledge.find((entry) => entry.id === item.knowledgeItemId);
              return <div className="mastery-row" key={item.knowledgeItemId}><span><strong>{content?.form ?? item.knowledgeItemId}</strong><small>{content ? displayText(content.meaning, teachingLocale) : item.knowledgeItemId}</small></span><em>{c(...masteryNames[item.level])}</em></div>;
            })}
          </div>
          {reviewPlanOpen && (
            <div className="review-plan">
              <div className="summary-heading"><div><CalendarClock size={17} /><strong>{c("已生成的复习任务", "Generated review tasks")}</strong></div></div>
              {progress.reviews.map((item) => {
                const content = course.knowledge.find((entry) => entry.id === item.knowledgeItemId);
                return <div className="review-row" key={item.id}><span><strong>{content?.form ?? item.knowledgeItemId}</strong><small>{c(...reviewNames[item.mode])}</small></span><time>{formatDue(item.dueAt, uiLocale)}</time></div>;
              })}
            </div>
          )}
          <div className="completion-actions"><button className="outline-large" onClick={restart}><RotateCcw size={17} />{c("重新学习", "Learn again")}</button><button className="learner-primary" onClick={onExit}>{c("完成并返回", "Finish and return")}<ArrowRight size={17} /></button></div>
        </section>
      </main>
    );
  }

  if (!lesson || !currentStep) return null;

  return (
    <main className="learner-shell">
      <header className="learner-topbar">
        <button className="learner-back" onClick={onExit}><ArrowLeft size={17} />{c("保存并退出", "Save and exit")}</button>
        <div className="learner-course-title"><span>{displayText(course.manifest.title, teachingLocale)}</span><strong>{displayText(lesson.title, teachingLocale)}</strong></div>
        <span className="device-pill">{preview ? c("Studio 预览 · 不写入学习档案", "Studio preview · does not change your profile") : c("设备本地进度", "Device-local progress")}</span>
      </header>
      <div className="learning-progress-wrap">
        <div className="learning-progress-meta"><span>{c(`阶段 ${activeStageIndex + 1} / ${learnerStages.length} · 本阶段 ${activeStage?.completedSteps ?? 0} / ${activeStage?.stepIds.length ?? 0}`, `Stage ${activeStageIndex + 1} / ${learnerStages.length} · ${activeStage?.completedSteps ?? 0} / ${activeStage?.stepIds.length ?? 0} in this stage`)}</span><strong>{percent}%</strong></div>
        <div className="learning-progress-track"><span style={{ width: `${percent}%` }} /></div>
      </div>

      <section className="lesson-stage">
        <aside className="lesson-rail">
          {learnerStages.map((stage, index) => {
            const done = stage.status === "completed";
            const active = stage.status === "active";
            return <div className={`rail-step learner-stage-step ${done ? "done" : ""} ${active ? "active" : ""}`} key={stage.id}><span>{done ? <Check size={13} /> : index + 1}</span><div><strong>{c(...learnerStageNames[stage.id])}</strong><small>{c(...learnerStageDescriptions[stage.id])}</small><em>{c(`${stage.completedSteps} / ${stage.stepIds.length} 个环节`, `${stage.completedSteps} / ${stage.stepIds.length} activities`)}</em></div></div>;
          })}
        </aside>

        <article className="learning-card">
          <div className="learning-heading"><span className="phase-badge">{c(...learnerStageNames[learnerStages[activeStageIndex]?.id ?? "learn"])} · {phaseNames[currentStep.phase] ? c(...phaseNames[currentStep.phase]) : currentStep.phase}</span><h1>{displayText(currentStep.title, teachingLocale)}</h1><p>{exercise ? displayText(exercise.prompt, teachingLocale) : c("阅读并理解下面的课程内容，然后继续。", "Read and understand the lesson content, then continue.")}</p></div>

          {(knowledge.length > 0 || utterances.length > 0) && (
            <div className="learning-content">
              {knowledge.length > 0 && <div className="knowledge-learning-grid">{knowledge.map((item) => item && <div className="knowledge-learning-card" key={item.id}><span>{item.kind}</span><strong>{item.form}</strong>{(showSupport || currentStep.supportLevel === "full") && <p>{displayText(item.meaning, teachingLocale)}</p>}</div>)}</div>}
              {utterances.map((item) => item && <div className="utterance-learning-card" key={item.id}><BookOpenCheck size={18} /><div className="utterance-learning-copy"><strong>{item.text}</strong>{item.translation && (showSupport || currentStep.supportLevel === "full") && <p>{displayText(item.translation, teachingLocale)}</p>}<PronunciationControls text={item.text} languageId={course.manifest.languageId} locale={locale} /></div></div>)}
            </div>
          )}

          {exercise && activeResponse && <ExerciseRenderer exercise={exercise} response={activeResponse} locale={locale} onChange={setResponse} onInteraction={() => setFeedback(undefined)} />}

          {showSupport && exercise?.guidance && <div className="support-card"><Lightbulb size={17} /><p>{displayText(exercise.guidance, teachingLocale)}</p></div>}

          {capabilityResolution.missing.length > 0 && <div className="capability-fallback"><TriangleAlert size={17} /><div><strong>{c("当前语言能力不足，已启用降级模式", "A required language capability is unavailable")}</strong><p>{c("缺少：", "Missing: ")}{capabilityResolution.missing.join(", ")} · {capabilityResolution.mode === "disabled" ? c("本练习将跳过且不记录掌握证据", "This exercise will be skipped without mastery evidence") : capabilityResolution.mode === "reference-answer" ? c("显示参考答案后由你确认", "You will confirm after seeing a reference answer") : c("改为学习者自评", "The exercise will use learner self-assessment")}</p></div></div>}

          {tutorOpen && <section className="ai-tutor-panel" aria-labelledby="ai-tutor-title">
            <header>
              <div><span><Bot size={19} /></span><div><small>OPTIONAL AI TUTOR</small><h2 id="ai-tutor-title">{c("可选 AI 学习导师", "Optional AI tutor")}</h2></div></div>
              <button type="button" onClick={() => setTutorOpen(false)} aria-label={c("关闭 AI 导师", "Close AI tutor")}><X size={17} /></button>
            </header>
            {!aiSettings ? <div className="ai-tutor-empty"><MessageCircleQuestion size={24} /><div><strong>{c("需要先配置个人 AI", "Configure Personal AI first")}</strong><p>{c("课程和本地练习不依赖 AI。配置后，导师可以解释当前步骤、提供提示和回答问题。", "Courses and local exercises do not require AI. Once configured, the tutor can explain this step, give hints, and answer questions.")}</p></div>{onConfigureAi && <button type="button" onClick={onConfigureAi}>{c("打开 AI 设置", "Open AI settings")}</button>}</div> : <>
              <p className="ai-tutor-boundary">{c("只发送当前课节内容、当前回答和你主动输入的问题。回复只作参考，不自动评分，也不改变进度。", "Only this lesson context, the current response, and questions you enter are sent. Replies are reference only: no automatic grading or progress changes.")}</p>
              <div className="ai-tutor-shortcuts">
                <button type="button" disabled={tutorBusy} onClick={() => void askTutor("explain")}><BookOpenCheck size={15} />{c("解释本步", "Explain this step")}</button>
                <button type="button" disabled={tutorBusy} onClick={() => void askTutor("hint")}><Lightbulb size={15} />{c("给一个提示", "Give me a hint")}</button>
                <button type="button" disabled={tutorBusy} onClick={() => void askTutor("example")}><Sparkles size={15} />{c("换个例子", "Show another example")}</button>
              </div>
              {tutorBusy && <div className="ai-tutor-loading" role="status"><Sparkles size={16} />{c("正在结合当前课节生成帮助…", "Creating help from this lesson context…")}</div>}
              {tutorError && <div className="ai-tutor-error" role="alert"><CircleAlert size={16} />{tutorError}</div>}
              {tutorReply && <article className="ai-tutor-reply" aria-live="polite"><span>{c("AI 参考 · 不记录为学习证据", "AI reference · not learning evidence")}</span><h3>{tutorReply.title}</h3><p>{tutorReply.explanation}</p>{tutorReply.examples.length > 0 && <ul>{tutorReply.examples.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}{tutorReply.practicePrompt && <div className="ai-tutor-practice"><strong>{c("可以接着试", "Try next")}</strong><p>{tutorReply.practicePrompt}</p></div>}{tutorReply.caution && <small>{tutorReply.caution}</small>}</article>}
              <form className="ai-tutor-question" onSubmit={(event) => { event.preventDefault(); void askTutor("question"); }}>
                <label htmlFor="ai-tutor-question">{c("针对当前步骤提问", "Ask about this step")}</label>
                <textarea id="ai-tutor-question" value={tutorQuestion} maxLength={600} onChange={(event) => { setTutorQuestion(event.target.value); setTutorError(""); }} placeholder={c("例如：这个句型和刚才的表达有什么区别？", "For example: How is this pattern different from the previous one?")} />
                <footer><span>{tutorQuestion.length} / 600</span><button type="submit" disabled={tutorBusy || !tutorQuestion.trim()}><Send size={14} />{c("发送问题", "Send question")}</button></footer>
              </form>
            </>}
          </section>}

          {feedback && <div className={`learning-feedback ${feedback.kind}`}>
            {feedback.kind === "success" ? <CheckCircle2 size={21} /> : feedback.kind === "review" ? <Sparkles size={21} /> : <CircleAlert size={21} />}
            <div><span className={`feedback-source ${feedback.source ?? "local"}`}>{feedback.source === "ai" ? c("AI 参考 · 不自动评分", "AI reference · no automatic grading") : c("本地规则", "Local rules")}</span><strong>{feedback.title}</strong><p>{feedback.message}</p>{feedback.detail && <small>{feedback.kind === "review" ? feedback.detail : c(`AI 未使用：${feedback.detail}`, `AI not used: ${feedback.detail}`)}</small>}</div>
          </div>}

          <footer className="learning-actions">
            <div className="learning-support-actions">
              {!showSupport && (exercise || currentStep.supportLevel !== "none") && <button className="support-button" onClick={() => setShowSupport(true)}><Eye size={16} />{c("查看提示", "View support")}</button>}
              <button className={`tutor-button ${tutorOpen ? "active" : ""}`} type="button" onClick={() => setTutorOpen((open) => !open)}><Bot size={16} />{c("AI 导师", "AI tutor")}</button>
            </div>
            {feedback?.diagnosticAction === "skip" ? <button className="learner-primary" onClick={() => advance("deterministic", true, feedback.nextStepId, 1)}>{c("跳过并完成本课", "Skip and complete lesson")}<ArrowRight size={17} /></button> : feedback?.diagnosticAction === "learn" ? <button className="learner-primary" onClick={() => advance("deterministic", false, feedback.nextStepId, 0)}>{c("开始学习本课", "Start this lesson")}<ArrowRight size={17} /></button> : feedback?.kind === "success" ? <button className="learner-primary" onClick={() => advance("deterministic")}>{c("继续下一步", "Continue")}<ArrowRight size={17} /></button> : feedback?.kind === "retry" ? <button className="learner-primary retry-button" onClick={tryAgain}><RotateCcw size={16} />{c("根据提示重试", "Try again with support")}</button> : feedback?.kind === "review" ? <div className="ai-review-actions"><button className="support-button" onClick={tryAgain}><RotateCcw size={16} />{c("继续修改", "Keep editing")}</button><button className="learner-primary" onClick={() => advance("self")}>{c("我确认已完成", "I confirm completion")}<ArrowRight size={17} /></button></div> : capabilityResolution.mode === "disabled" ? <button className="learner-primary" onClick={submitAnswer}>{c("跳过不兼容练习", "Skip incompatible exercise")}<ArrowRight size={17} /></button> : <button className="learner-primary" onClick={submitAnswer} disabled={evaluating}>{evaluating ? <><Sparkles size={16} />{c("AI 反馈中…", "Getting AI feedback…")}</> : exercise ? <><ListChecks size={16} />{c("提交答案", "Submit answer")}</> : <><Sparkles size={16} />{c("完成并继续", "Complete and continue")}</>}</button>}
          </footer>
        </article>
      </section>
    </main>
  );
}
