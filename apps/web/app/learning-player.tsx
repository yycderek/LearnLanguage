"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleAlert,
  Eye,
  Lightbulb,
  ListChecks,
  RotateCcw,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { requestAiFeedback, type AiSettings } from "@/lib/ai";
import { ExerciseRenderer } from "@/app/exercise-renderer";
import { displayText, type CoursePack } from "@/lib/course";
import { IndexedDbEffectQueue } from "@/lib/device-repository";
import { resolveExerciseCapabilities, type LanguagePack } from "@/lib/language-pack";
import { dateLocale, uiText, type AppLocale } from "@/lib/i18n";
import type { EvaluationSource } from "@learn-language/protocol";
import {
  createExerciseResponse,
  evaluateExerciseResponse,
  serializeExerciseResponse,
  textExerciseResponse,
  type ExerciseResponse,
} from "@learn-language/application";
import { createAiFeedbackEffect } from "@learn-language/engine";
import {
  learningPercent,
  startLearning,
  submitLearningStep,
  type LearningProgress,
  type MasteryLevel,
  type ReviewMode,
} from "@/lib/learning";

type Feedback = { kind: "success" | "retry" | "review"; title: string; message: string; source?: "ai" | "local"; detail?: string };

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
  onProgress,
  onExit,
}: {
  course: CoursePack;
  initialProgress: LearningProgress;
  languagePack?: LanguagePack;
  locale?: AppLocale;
  preview?: boolean;
  aiSettings?: AiSettings;
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

  const lesson = course.lessons.find((item) => item.id === progress.lessonId) ?? course.lessons[0];
  const currentStep = lesson?.steps.find((item) => item.id === progress.currentStepId);
  const exercise = currentStep?.exerciseRefs.map((id) => course.exercises.find((item) => item.id === id)).find(Boolean);
  const knowledge = currentStep?.knowledgeRefs.map((id) => course.knowledge.find((item) => item.id === id)).filter(Boolean) ?? [];
  const utterances = currentStep?.utteranceRefs.map((id) => course.utterances.find((item) => item.id === id)).filter(Boolean) ?? [];
  const percent = learningPercent(course, progress);
  const stepIndex = currentStep ? (lesson?.steps.findIndex((item) => item.id === currentStep.id) ?? 0) : -1;
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
  }

  function advance(evaluationSource: EvaluationSource = "deterministic", evidenceEligible = true) {
    if (!currentStep) return;
    const next = submitLearningStep(course, progress, {
      decision: "advance",
      answer: serializeExerciseResponse(activeResponse),
      score: 1,
      evaluationSource,
      evidenceEligible,
      usedSupport: showSupport,
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
          <button className="learner-back" onClick={onExit}><ArrowLeft size={17} />{c("返回课程工作台", "Back to learning home")}</button>
          <span className="device-pill">{preview ? c("预览进度不会保存", "Preview progress is not saved") : c("进度已保存到当前设备", "Progress saved on this device")}</span>
        </header>
        <section className="completion-card">
          <div className="completion-mark"><CheckCircle2 size={38} /></div>
          <span className="kicker">LESSON COMPLETE</span>
          <h1>{c("本课学习完成", "Lesson complete")}</h1>
          <p>{displayText(lesson?.title, teachingLocale)} · {c(`共完成 ${progress.completedStepIds.length} 个学习步骤`, `${progress.completedStepIds.length} learning steps completed`)}</p>
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
        <div className="learning-progress-meta"><span>{c(`步骤 ${stepIndex + 1} / ${lesson.steps.length}`, `Step ${stepIndex + 1} / ${lesson.steps.length}`)}</span><strong>{percent}%</strong></div>
        <div className="learning-progress-track"><span style={{ width: `${percent}%` }} /></div>
      </div>

      <section className="lesson-stage">
        <aside className="lesson-rail">
          {lesson.steps.map((step, index) => {
            const done = progress.completedStepIds.includes(step.id);
            const active = step.id === currentStep.id;
            return <div className={`rail-step ${done ? "done" : ""} ${active ? "active" : ""}`} key={step.id}><span>{done ? <Check size={13} /> : index + 1}</span><div><strong>{displayText(step.title, teachingLocale)}</strong><small>{phaseNames[step.phase] ? c(...phaseNames[step.phase]) : step.phase}</small></div></div>;
          })}
        </aside>

        <article className="learning-card">
          <div className="learning-heading"><span className="phase-badge">{phaseNames[currentStep.phase] ? c(...phaseNames[currentStep.phase]) : currentStep.phase}</span><h1>{displayText(currentStep.title, teachingLocale)}</h1><p>{exercise ? displayText(exercise.prompt, teachingLocale) : c("阅读并理解下面的课程内容，然后继续。", "Read and understand the lesson content, then continue.")}</p></div>

          {(knowledge.length > 0 || utterances.length > 0) && (
            <div className="learning-content">
              {knowledge.length > 0 && <div className="knowledge-learning-grid">{knowledge.map((item) => item && <div className="knowledge-learning-card" key={item.id}><span>{item.kind}</span><strong>{item.form}</strong>{(showSupport || currentStep.supportLevel === "full") && <p>{displayText(item.meaning, teachingLocale)}</p>}</div>)}</div>}
              {utterances.map((item) => item && <div className="utterance-learning-card" key={item.id}><BookOpenCheck size={18} /><div><strong>{item.text}</strong>{item.translation && (showSupport || currentStep.supportLevel === "full") && <p>{displayText(item.translation, teachingLocale)}</p>}</div></div>)}
            </div>
          )}

          {exercise && activeResponse && <ExerciseRenderer exercise={exercise} response={activeResponse} locale={locale} onChange={setResponse} onInteraction={() => setFeedback(undefined)} />}

          {showSupport && exercise?.guidance && <div className="support-card"><Lightbulb size={17} /><p>{displayText(exercise.guidance, teachingLocale)}</p></div>}

          {capabilityResolution.missing.length > 0 && <div className="capability-fallback"><TriangleAlert size={17} /><div><strong>{c("当前语言能力不足，已启用降级模式", "A required language capability is unavailable")}</strong><p>{c("缺少：", "Missing: ")}{capabilityResolution.missing.join(", ")} · {capabilityResolution.mode === "disabled" ? c("本练习将跳过且不记录掌握证据", "This exercise will be skipped without mastery evidence") : capabilityResolution.mode === "reference-answer" ? c("显示参考答案后由你确认", "You will confirm after seeing a reference answer") : c("改为学习者自评", "The exercise will use learner self-assessment")}</p></div></div>}

          {feedback && <div className={`learning-feedback ${feedback.kind}`}>
            {feedback.kind === "success" ? <CheckCircle2 size={21} /> : feedback.kind === "review" ? <Sparkles size={21} /> : <CircleAlert size={21} />}
            <div><span className={`feedback-source ${feedback.source ?? "local"}`}>{feedback.source === "ai" ? c("AI 参考 · 不自动评分", "AI reference · no automatic grading") : c("本地规则", "Local rules")}</span><strong>{feedback.title}</strong><p>{feedback.message}</p>{feedback.detail && <small>{feedback.kind === "review" ? feedback.detail : c(`AI 未使用：${feedback.detail}`, `AI not used: ${feedback.detail}`)}</small>}</div>
          </div>}

          <footer className="learning-actions">
            {!showSupport && (exercise || currentStep.supportLevel !== "none") ? <button className="support-button" onClick={() => setShowSupport(true)}><Eye size={16} />{c("查看提示", "View support")}</button> : <span />}
            {feedback?.kind === "success" ? <button className="learner-primary" onClick={() => advance("deterministic")}>{c("继续下一步", "Continue")}<ArrowRight size={17} /></button> : feedback?.kind === "retry" ? <button className="learner-primary retry-button" onClick={tryAgain}><RotateCcw size={16} />{c("根据提示重试", "Try again with support")}</button> : feedback?.kind === "review" ? <div className="ai-review-actions"><button className="support-button" onClick={tryAgain}><RotateCcw size={16} />{c("继续修改", "Keep editing")}</button><button className="learner-primary" onClick={() => advance("self")}>{c("我确认已完成", "I confirm completion")}<ArrowRight size={17} /></button></div> : capabilityResolution.mode === "disabled" ? <button className="learner-primary" onClick={submitAnswer}>{c("跳过不兼容练习", "Skip incompatible exercise")}<ArrowRight size={17} /></button> : <button className="learner-primary" onClick={submitAnswer} disabled={evaluating}>{evaluating ? <><Sparkles size={16} />{c("AI 反馈中…", "Getting AI feedback…")}</> : exercise ? <><ListChecks size={16} />{c("提交答案", "Submit answer")}</> : <><Sparkles size={16} />{c("完成并继续", "Complete and continue")}</>}</button>}
          </footer>
        </article>
      </section>
    </main>
  );
}
