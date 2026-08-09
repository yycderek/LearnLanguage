"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Brain, CheckCircle2, Eye, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { displayText, type CoursePack } from "@/lib/course";
import { uiText, type TeachingLocale } from "@/lib/i18n";
import { completeReviewTask, type CourseLearningRecord, type ReviewMode, type ReviewTask } from "@/lib/learning";

const reviewCopy: Record<ReviewMode, { label: [string, string]; prompt: [string, string]; input: boolean }> = {
  recognition: { label: ["识别复习", "Recognition"], prompt: ["看到这个表达，你能想起它的意思吗？", "Can you recall what this expression means?"], input: false },
  "active-recall": { label: ["主动回忆", "Active recall"], prompt: ["根据含义，写出或说出目标语言表达。", "Produce the target-language expression from its meaning."], input: true },
  scenario: { label: ["场景练习", "Scenario practice"], prompt: ["想象你正在真实场景中，尝试使用这个表达。", "Imagine a real situation and use this expression."], input: true },
  transfer: { label: ["迁移任务", "Transfer task"], prompt: ["换一个相似场景，重新组织这个表达。", "Rebuild this expression for a similar situation."], input: true },
  fluency: { label: ["流利度巩固", "Fluency review"], prompt: ["不看提示，快速完整地说出这个表达。", "Produce the full expression quickly without support."], input: true },
};

export function ReviewPlayer({
  course,
  initialRecord,
  tasks,
  teachingLocale = "zh-CN",
  preview = false,
  onRecord,
  onExit,
}: {
  course: CoursePack;
  initialRecord: CourseLearningRecord;
  tasks: ReviewTask[];
  teachingLocale?: TeachingLocale;
  preview?: boolean;
  onRecord: (record: CourseLearningRecord) => void;
  onExit: () => void;
}) {
  const c = (chinese: string, english: string) => uiText(teachingLocale, chinese, english);
  const [record, setRecord] = useState(initialRecord);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState({ remembered: 0, retry: 0 });
  const task = tasks[index];
  const content = task ? course.knowledge.find((item) => item.id === task.knowledgeItemId) : undefined;

  function grade(result: "remembered" | "retry") {
    if (!task) return;
    const next = completeReviewTask(record, task.id, result);
    setRecord(next);
    onRecord(next);
    setResults((current) => ({ ...current, [result]: current[result] + 1 }));
    setIndex((current) => current + 1);
    setRevealed(false);
    setAnswer("");
  }

  if (!task) {
    return (
      <main className="review-player-shell">
        <header className="review-topbar"><button onClick={onExit}><ArrowLeft size={17} />{c("返回学习首页", "Back to learning home")}</button><span>{preview ? c("预览复习完成 · 未保存", "Preview complete · not saved") : c("复习完成", "Review complete")}</span></header>
        <section className="review-complete-card">
          <div><CheckCircle2 size={40} /></div><span className="kicker">REVIEW COMPLETE</span><h1>{c("本组复习完成", "Review set complete")}</h1><p>{c("掌握度和下一次复习时间已经更新。", "Mastery and the next review time have been updated.")}</p>
          <div className="review-result-stats"><div><strong>{results.remembered}</strong><span>{c("记得", "Remembered")}</span></div><div><strong>{results.retry}</strong><span>{c("需要再练习", "Needs practice")}</span></div></div>
          <button onClick={onExit}>{c("返回学习首页", "Back to learning home")}<ArrowRight size={17} /></button>
        </section>
      </main>
    );
  }

  const copy = reviewCopy[task.mode];
  const copyLabel = c(...copy.label);
  const copyPrompt = c(...copy.prompt);
  const percent = Math.round((index / tasks.length) * 100);
  return (
    <main className="review-player-shell">
      <header className="review-topbar"><button onClick={onExit}><ArrowLeft size={17} />{preview ? c("退出预览", "Exit preview") : c("保存并退出", "Save and exit")}</button><span>{preview ? c("Studio 预览", "Studio preview") : copyLabel} · {index + 1}/{tasks.length}</span></header>
      <div className="review-progress"><span style={{ width: `${percent}%` }} /></div>
      <section className="review-card-stage">
        <div className="review-mode-icon"><Brain size={25} /></div>
        <span className="review-mode-label">{copyLabel}</span>
        <h1>{copyPrompt}</h1>
        <div className="review-prompt-card">
          {task.mode === "active-recall" ? <><small>{c("教学语言含义", "Meaning")}</small><strong>{content ? displayText(content.meaning, teachingLocale) : task.knowledgeItemId}</strong></> : <><small>{c("目标语言", "Target language")}</small><strong>{content?.form ?? task.knowledgeItemId}</strong></>}
        </div>
        {copy.input && !revealed && <label className="review-answer"><span>{c("你的回忆", "Your recall")}</span><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={c("可以先写下来，也可以直接口头回答……", "Write it down or answer aloud…")} dir="auto" /></label>}
        {revealed && <div className="review-reveal"><Sparkles size={18} /><div><span>{c("参考答案", "Reference answer")}</span><strong>{content?.form ?? task.knowledgeItemId}</strong><p>{content ? displayText(content.meaning, teachingLocale) : ""}</p></div></div>}
        {!revealed ? <button className="reveal-answer-button" onClick={() => setRevealed(true)}><Eye size={17} />{c("显示答案", "Show answer")}</button> : <div className="review-grade-actions"><button onClick={() => grade("retry")}><ThumbsDown size={18} /><span><strong>{c("需要再练习", "Needs practice")}</strong><small>{c("4 小时后再次出现", "Show again in 4 hours")}</small></span></button><button className="remembered" onClick={() => grade("remembered")}><ThumbsUp size={18} /><span><strong>{c("记得", "Remembered")}</strong><small>{c("提高掌握度并延长间隔", "Raise mastery and extend the interval")}</small></span></button></div>}
      </section>
    </main>
  );
}
