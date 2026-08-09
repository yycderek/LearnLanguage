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
import { displayText, type CoursePack } from "@/lib/course";
import { IndexedDbEffectQueue } from "@/lib/device-repository";
import { resolveExerciseCapabilities, type LanguagePack } from "@/lib/language-pack";
import type { EvaluationSource } from "@learn-language/protocol";
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

const phaseNames: Record<string, string> = {
  diagnostic: "诊断",
  preteach: "知识预教",
  "supported-input": "支持性输入",
  comprehension: "独立理解",
  "guided-output": "引导输出",
  "independent-task": "独立任务",
  "feedback-retry": "反馈重试",
  "delayed-transfer": "延迟迁移",
};

const masteryNames: Record<MasteryLevel, string> = {
  encountered: "已接触",
  comprehended: "已理解",
  "prompted-output": "提示下输出",
  "independent-output": "独立输出",
  "delayed-transfer": "延迟迁移",
};

const reviewNames: Record<ReviewMode, string> = {
  recognition: "识别复习",
  "active-recall": "主动回忆",
  scenario: "场景练习",
  transfer: "迁移任务",
  fluency: "流利度巩固",
};

function formatDue(value: string) {
  return new Date(value).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function LearningPlayer({
  course,
  initialProgress,
  languagePack,
  preview = false,
  aiSettings,
  onProgress,
  onExit,
}: {
  course: CoursePack;
  initialProgress: LearningProgress;
  languagePack?: LanguagePack;
  preview?: boolean;
  aiSettings?: AiSettings;
  onProgress: (progress: LearningProgress) => void;
  onExit: () => void;
}) {
  const [progress, setProgress] = useState(initialProgress);
  const [selectedOption, setSelectedOption] = useState<number>();
  const [answer, setAnswer] = useState("");
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
  const choiceOptions = exercise?.options?.length ? exercise.options : [{ "zh-CN": "我理解了" }, { "zh-CN": "需要再看一次" }];
  const capabilityResolution = exercise && languagePack ? resolveExerciseCapabilities(exercise, languagePack) : { mode: "native" as const, missing: [] };

  function persist(next: LearningProgress) {
    setProgress(next);
    onProgress(next);
  }

  function resetStepUi() {
    setSelectedOption(undefined);
    setAnswer("");
    setShowSupport(false);
    setFeedback(undefined);
    setEvaluating(false);
  }

  function advance(evaluationSource: EvaluationSource = "deterministic", evidenceEligible = true) {
    if (!currentStep) return;
    const next = submitLearningStep(course, progress, {
      decision: "advance",
      answer: exercise?.kind === "single-choice" ? String(selectedOption ?? "") : answer,
      score: 1,
      evaluationSource,
      evidenceEligible,
      usedSupport: showSupport,
    });
    persist(next);
    resetStepUi();
  }

  function retry(message: string, title = "还差一点", source: "ai" | "local" = "local", detail?: string) {
    if (!currentStep) return;
    const next = submitLearningStep(course, progress, {
      decision: "retry",
      answer: exercise?.kind === "single-choice" ? String(selectedOption ?? "") : answer,
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
        title: "请对照参考答案自行确认",
        message: reference || "当前课程未提供参考答案，请查看提示后自行判断。",
        source: "local",
      });
      return;
    }
    if (exercise.kind === "single-choice") {
      if (selectedOption === undefined) {
        setFeedback({ kind: "retry", title: "先选择一个答案", message: "选择后再提交。" });
        return;
      }
      if (selectedOption === (exercise.correctOptionIndex ?? 0)) {
        setFeedback({ kind: "success", title: "理解正确", message: "你抓住了表达中的关键信息。" });
      } else {
        retry(exercise.guidance ? displayText(exercise.guidance) : "重新查看例句中的关键词后再试一次。");
      }
      return;
    }
    const normalized = answer.trim();
    if (!normalized) {
      setFeedback({ kind: "retry", title: "先写下你的回答", message: "不必追求完美，尝试使用本课学到的表达。" });
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
          lessonTitle: displayText(lesson?.title),
          prompt: displayText(exercise.prompt),
          answer: normalized,
          targetForms,
          guidance: exercise.guidance ? displayText(exercise.guidance) : undefined,
        });
        const message = result.suggestion ? `${result.message} 建议表达：${result.suggestion}` : result.message;
        setFeedback({
          kind: "review",
          title: result.title,
          message,
          source: "ai",
          detail: result.verdict === "pass"
            ? "AI 认为任务基本完成，请由你最终确认；确认后将作为自评证据记录。"
            : "AI 建议修改，但不会自动判错；你可以继续修改或自行确认。",
        });
        await effectQueue?.markCompleted(effect.id).catch(() => undefined);
        return;
      } catch (error) {
        const detail = error instanceof Error ? error.message : "AI 服务暂时不可用。";
        const usesTargetLanguage = targetForms.length === 0 || targetForms.some((form) => normalized.includes(form));
        if (usesTargetLanguage) {
          setFeedback({ kind: "success", title: "本地规则判定通过", message: "回答包含本课目标表达，可以继续下一步。", source: "local", detail });
        } else {
          retry(exercise.guidance ? displayText(exercise.guidance) : "尝试加入本课的关键词或句型后再提交。", "请根据提示再试一次", "local", detail);
        }
        return;
      } finally {
        setEvaluating(false);
      }
    }
    const usesTargetLanguage = targetForms.length === 0 || targetForms.some((form) => normalized.includes(form));
    if (usesTargetLanguage) {
      setFeedback({ kind: "success", title: "任务完成", message: "回答使用了本课目标表达，可以继续下一步。", source: "local" });
    } else {
      retry(exercise.guidance ? displayText(exercise.guidance) : "尝试加入本课的关键词或句型后再提交。");
    }
  }

  function tryAgain() {
    setSelectedOption(undefined);
    setAnswer("");
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
          <button className="learner-back" onClick={onExit}><ArrowLeft size={17} />返回课程工作台</button>
          <span className="device-pill">{preview ? "预览进度不会保存" : "进度已保存到当前设备"}</span>
        </header>
        <section className="completion-card">
          <div className="completion-mark"><CheckCircle2 size={38} /></div>
          <span className="kicker">LESSON COMPLETE</span>
          <h1>本课学习完成</h1>
          <p>{displayText(lesson?.title)} · 共完成 {progress.completedStepIds.length} 个学习步骤</p>
          <div className="completion-stats">
            <div><strong>{mastered.length}</strong><span>已记录知识点</span></div>
            <div><strong>{progress.events.filter((item) => item.type === "attempt.recorded").length}</strong><span>学习尝试</span></div>
            <div><strong>{progress.reviews.length}</strong><span>复习任务</span></div>
          </div>
          <div className="mastery-summary">
            <div className="summary-heading"><div><Target size={17} /><strong>掌握度</strong></div><button onClick={() => setReviewPlanOpen((open) => !open)}><CalendarClock size={15} />{reviewPlanOpen ? "隐藏复习计划" : "查看复习计划"}</button></div>
            {mastered.map((item) => {
              const content = course.knowledge.find((entry) => entry.id === item.knowledgeItemId);
              return <div className="mastery-row" key={item.knowledgeItemId}><span><strong>{content?.form ?? item.knowledgeItemId}</strong><small>{content ? displayText(content.meaning) : item.knowledgeItemId}</small></span><em>{masteryNames[item.level]}</em></div>;
            })}
          </div>
          {reviewPlanOpen && (
            <div className="review-plan">
              <div className="summary-heading"><div><CalendarClock size={17} /><strong>已生成的复习任务</strong></div></div>
              {progress.reviews.map((item) => {
                const content = course.knowledge.find((entry) => entry.id === item.knowledgeItemId);
                return <div className="review-row" key={item.id}><span><strong>{content?.form ?? item.knowledgeItemId}</strong><small>{reviewNames[item.mode]}</small></span><time>{formatDue(item.dueAt)}</time></div>;
              })}
            </div>
          )}
          <div className="completion-actions"><button className="outline-large" onClick={restart}><RotateCcw size={17} />重新学习</button><button className="learner-primary" onClick={onExit}>完成并返回<ArrowRight size={17} /></button></div>
        </section>
      </main>
    );
  }

  if (!lesson || !currentStep) return null;

  return (
    <main className="learner-shell">
      <header className="learner-topbar">
        <button className="learner-back" onClick={onExit}><ArrowLeft size={17} />保存并退出</button>
        <div className="learner-course-title"><span>{displayText(course.manifest.title)}</span><strong>{displayText(lesson.title)}</strong></div>
        <span className="device-pill">{preview ? "Studio 预览 · 不写入学习档案" : "设备本地进度"}</span>
      </header>
      <div className="learning-progress-wrap">
        <div className="learning-progress-meta"><span>步骤 {stepIndex + 1} / {lesson.steps.length}</span><strong>{percent}%</strong></div>
        <div className="learning-progress-track"><span style={{ width: `${percent}%` }} /></div>
      </div>

      <section className="lesson-stage">
        <aside className="lesson-rail">
          {lesson.steps.map((step, index) => {
            const done = progress.completedStepIds.includes(step.id);
            const active = step.id === currentStep.id;
            return <div className={`rail-step ${done ? "done" : ""} ${active ? "active" : ""}`} key={step.id}><span>{done ? <Check size={13} /> : index + 1}</span><div><strong>{displayText(step.title)}</strong><small>{phaseNames[step.phase] ?? step.phase}</small></div></div>;
          })}
        </aside>

        <article className="learning-card">
          <div className="learning-heading"><span className="phase-badge">{phaseNames[currentStep.phase] ?? currentStep.phase}</span><h1>{displayText(currentStep.title)}</h1><p>{exercise ? displayText(exercise.prompt) : "阅读并理解下面的课程内容，然后继续。"}</p></div>

          {(knowledge.length > 0 || utterances.length > 0) && (
            <div className="learning-content">
              {knowledge.length > 0 && <div className="knowledge-learning-grid">{knowledge.map((item) => item && <div className="knowledge-learning-card" key={item.id}><span>{item.kind}</span><strong>{item.form}</strong>{(showSupport || currentStep.supportLevel === "full") && <p>{displayText(item.meaning)}</p>}</div>)}</div>}
              {utterances.map((item) => item && <div className="utterance-learning-card" key={item.id}><BookOpenCheck size={18} /><div><strong>{item.text}</strong>{item.translation && (showSupport || currentStep.supportLevel === "full") && <p>{displayText(item.translation)}</p>}</div></div>)}
            </div>
          )}

          {exercise?.kind === "single-choice" && (
            <div className="choice-list" role="radiogroup" aria-label="选择答案">
              {choiceOptions.map((option, index) => <button key={index} className={selectedOption === index ? "selected" : ""} onClick={() => { setSelectedOption(index); setFeedback(undefined); }}><span>{String.fromCharCode(65 + index)}</span><strong>{displayText(option)}</strong>{selectedOption === index && <Check size={17} />}</button>)}
            </div>
          )}

          {exercise && exercise.kind !== "single-choice" && (
            <label className="answer-field"><span>你的回答</span><textarea value={answer} onChange={(event) => { setAnswer(event.target.value); setFeedback(undefined); }} placeholder="使用目标语言完成任务……" dir="auto" /></label>
          )}

          {showSupport && exercise?.guidance && <div className="support-card"><Lightbulb size={17} /><p>{displayText(exercise.guidance)}</p></div>}

          {capabilityResolution.missing.length > 0 && <div className="capability-fallback"><TriangleAlert size={17} /><div><strong>当前语言能力不足，已启用降级模式</strong><p>缺少：{capabilityResolution.missing.join("、")} · {capabilityResolution.mode === "disabled" ? "本练习将跳过且不记录掌握证据" : capabilityResolution.mode === "reference-answer" ? "显示参考答案后由你确认" : "改为学习者自评"}</p></div></div>}

          {feedback && <div className={`learning-feedback ${feedback.kind}`}>
            {feedback.kind === "success" ? <CheckCircle2 size={21} /> : feedback.kind === "review" ? <Sparkles size={21} /> : <CircleAlert size={21} />}
            <div><span className={`feedback-source ${feedback.source ?? "local"}`}>{feedback.source === "ai" ? "AI 参考 · 不自动评分" : "本地规则"}</span><strong>{feedback.title}</strong><p>{feedback.message}</p>{feedback.detail && <small>{feedback.kind === "review" ? feedback.detail : `AI 未使用：${feedback.detail}`}</small>}</div>
          </div>}

          <footer className="learning-actions">
            {!showSupport && (exercise || currentStep.supportLevel !== "none") ? <button className="support-button" onClick={() => setShowSupport(true)}><Eye size={16} />查看提示</button> : <span />}
            {feedback?.kind === "success" ? <button className="learner-primary" onClick={() => advance("deterministic")}>继续下一步<ArrowRight size={17} /></button> : feedback?.kind === "retry" ? <button className="learner-primary retry-button" onClick={tryAgain}><RotateCcw size={16} />根据提示重试</button> : feedback?.kind === "review" ? <div className="ai-review-actions"><button className="support-button" onClick={tryAgain}><RotateCcw size={16} />继续修改</button><button className="learner-primary" onClick={() => advance("self")}>我确认已完成<ArrowRight size={17} /></button></div> : capabilityResolution.mode === "disabled" ? <button className="learner-primary" onClick={submitAnswer}>跳过不兼容练习<ArrowRight size={17} /></button> : <button className="learner-primary" onClick={submitAnswer} disabled={evaluating}>{evaluating ? <><Sparkles size={16} />AI 反馈中…</> : exercise ? <><ListChecks size={16} />提交答案</> : <><Sparkles size={16} />完成并继续</>}</button>}
          </footer>
        </article>
      </section>
    </main>
  );
}
