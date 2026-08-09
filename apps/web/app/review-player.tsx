"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Brain, CheckCircle2, Eye, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { displayText, type CoursePack } from "@/lib/course";
import { completeReviewTask, type CourseLearningRecord, type ReviewMode, type ReviewTask } from "@/lib/learning";

const reviewCopy: Record<ReviewMode, { label: string; prompt: string; input: boolean }> = {
  recognition: { label: "识别复习", prompt: "看到这个表达，你能想起它的意思吗？", input: false },
  "active-recall": { label: "主动回忆", prompt: "根据含义，写出或说出目标语言表达。", input: true },
  scenario: { label: "场景练习", prompt: "想象你正在真实场景中，尝试使用这个表达。", input: true },
  transfer: { label: "迁移任务", prompt: "换一个相似场景，重新组织这个表达。", input: true },
  fluency: { label: "流利度巩固", prompt: "不看提示，快速完整地说出这个表达。", input: true },
};

export function ReviewPlayer({
  course,
  initialRecord,
  tasks,
  preview = false,
  onRecord,
  onExit,
}: {
  course: CoursePack;
  initialRecord: CourseLearningRecord;
  tasks: ReviewTask[];
  preview?: boolean;
  onRecord: (record: CourseLearningRecord) => void;
  onExit: () => void;
}) {
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
        <header className="review-topbar"><button onClick={onExit}><ArrowLeft size={17} />返回学习首页</button><span>{preview ? "预览复习完成 · 未保存" : "复习完成"}</span></header>
        <section className="review-complete-card">
          <div><CheckCircle2 size={40} /></div><span className="kicker">REVIEW COMPLETE</span><h1>本组复习完成</h1><p>掌握度和下一次复习时间已经更新。</p>
          <div className="review-result-stats"><div><strong>{results.remembered}</strong><span>记得</span></div><div><strong>{results.retry}</strong><span>需要再练习</span></div></div>
          <button onClick={onExit}>返回学习首页<ArrowRight size={17} /></button>
        </section>
      </main>
    );
  }

  const copy = reviewCopy[task.mode];
  const percent = Math.round((index / tasks.length) * 100);
  return (
    <main className="review-player-shell">
      <header className="review-topbar"><button onClick={onExit}><ArrowLeft size={17} />{preview ? "退出预览" : "保存并退出"}</button><span>{preview ? "Studio 预览" : copy.label} · {index + 1}/{tasks.length}</span></header>
      <div className="review-progress"><span style={{ width: `${percent}%` }} /></div>
      <section className="review-card-stage">
        <div className="review-mode-icon"><Brain size={25} /></div>
        <span className="review-mode-label">{copy.label}</span>
        <h1>{copy.prompt}</h1>
        <div className="review-prompt-card">
          {task.mode === "active-recall" ? <><small>中文含义</small><strong>{content ? displayText(content.meaning) : task.knowledgeItemId}</strong></> : <><small>目标语言</small><strong>{content?.form ?? task.knowledgeItemId}</strong></>}
        </div>
        {copy.input && !revealed && <label className="review-answer"><span>你的回忆</span><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="可以先写下来，也可以直接口头回答……" dir="auto" /></label>}
        {revealed && <div className="review-reveal"><Sparkles size={18} /><div><span>参考答案</span><strong>{content?.form ?? task.knowledgeItemId}</strong><p>{content ? displayText(content.meaning) : ""}</p></div></div>}
        {!revealed ? <button className="reveal-answer-button" onClick={() => setRevealed(true)}><Eye size={17} />显示答案</button> : <div className="review-grade-actions"><button onClick={() => grade("retry")}><ThumbsDown size={18} /><span><strong>需要再练习</strong><small>4 小时后再次出现</small></span></button><button className="remembered" onClick={() => grade("remembered")}><ThumbsUp size={18} /><span><strong>记得</strong><small>提高掌握度并延长间隔</small></span></button></div>}
      </section>
    </main>
  );
}
