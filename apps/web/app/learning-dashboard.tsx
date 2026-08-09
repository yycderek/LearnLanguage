"use client";

import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  CirclePlay,
  Clock3,
  Flame,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { displayText, type CoursePack } from "@/lib/course";
import {
  courseLearningPercent,
  learningPercent,
  lessonIsUnlocked,
  reviewsDue,
  type CourseLearningRecord,
  type ReviewTask,
} from "@/lib/learning";

function formatDue(value: string) {
  return new Date(value).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function LearningDashboard({
  course,
  record,
  preview = false,
  onBack,
  onStartLesson,
  onStartReview,
}: {
  course: CoursePack;
  record?: CourseLearningRecord;
  preview?: boolean;
  onBack: () => void;
  onStartLesson: (lessonId: string, restart?: boolean) => void;
  onStartReview: (tasks: ReviewTask[]) => void;
}) {
  const due = record ? reviewsDue(record) : [];
  const dueIds = new Set(due.map((task) => task.id));
  const completedLessons = course.lessons.filter((lesson) => record?.completedLessonIds.includes(lesson.id));
  const ongoing = course.lessons.find((lesson) => record?.lessonProgress[lesson.id]?.status === "active");
  const percent = courseLearningPercent(course, record);
  const upcoming = record?.reviews.slice(0, 4) ?? [];

  return (
    <main className="learning-home-shell">
      <header className="learning-home-topbar">
        <button onClick={onBack}><ArrowLeft size={17} />返回课程工作台</button>
        <div><span>{preview ? "STUDIO PREVIEW" : "LEARNING HOME"}</span><strong>{displayText(course.manifest.title)}</strong></div>
        <em>{preview ? "临时预览档案 · 不保存" : "设备本地学习档案"}</em>
      </header>

      <section className="learning-home-hero">
        <div>
          <span className="kicker">YOUR LEARNING PATH</span>
          <h1>今天继续前进一点</h1>
          <p>{ongoing ? `正在学习「${displayText(ongoing.title)}」` : completedLessons.length === course.lessons.length ? "全部课节已完成，可以开始复习。" : "选择已解锁的课节开始学习。"}</p>
        </div>
        <div className="overall-progress-ring" style={{ "--progress": `${percent * 3.6}deg` } as CSSProperties}><span><strong>{percent}%</strong><small>课程进度</small></span></div>
      </section>

      <section className="learning-overview-grid">
        <article className="learning-overview-card primary">
          <div className="overview-icon"><CirclePlay size={21} /></div>
          <span>进行中的课节</span>
          <strong>{ongoing ? displayText(ongoing.title) : "暂无进行中课节"}</strong>
          <p>{ongoing ? `已完成 ${learningPercent(course, record?.lessonProgress[ongoing.id])}%` : "从下方课程目录选择一个课节。"}</p>
          {ongoing && <button onClick={() => onStartLesson(ongoing.id)}>继续学习<ArrowRight size={15} /></button>}
        </article>
        <article className="learning-overview-card">
          <div className="overview-icon coral"><Check size={21} /></div>
          <span>已完成课节</span>
          <strong>{completedLessons.length} / {course.lessons.length}</strong>
          <p>每完成一课，就会解锁下一课。</p>
        </article>
        <article className="learning-overview-card review-card">
          <div className="overview-icon yellow"><CalendarClock size={21} /></div>
          <span>今日复习</span>
          <strong>{due.length} 个任务</strong>
          <p>{due.length > 0 ? "这些知识点已经到达复习时间。" : upcoming[0] ? `下一次：${formatDue(upcoming[0].dueAt)}` : "完成学习后会自动生成复习任务。"}</p>
          {(due.length > 0 || upcoming.length > 0) && <button onClick={() => onStartReview(due.length > 0 ? due : upcoming)}>{due.length > 0 ? "开始今日复习" : "预习复习卡"}<ArrowRight size={15} /></button>}
        </article>
      </section>

      <section className="learning-home-content">
        <article className="lesson-directory">
          <div className="learning-section-heading"><div><BookOpen size={18} /><span><strong>课程目录</strong><small>按顺序完成课节，逐步解锁学习路径</small></span></div><em>{course.lessons.length} 课</em></div>
          <div className="lesson-directory-list">
            {course.lessons.map((lesson, index) => {
              const progress = record?.lessonProgress[lesson.id];
              const unlocked = lessonIsUnlocked(course, record, index);
              const completed = record?.completedLessonIds.includes(lesson.id) === true;
              const active = progress?.status === "active";
              const lessonPercent = learningPercent(course, progress);
              return (
                <div className={`lesson-directory-row ${!unlocked ? "locked" : ""}`} key={lesson.id}>
                  <div className="lesson-order">{completed && !active ? <Check size={17} /> : !unlocked ? <LockKeyhole size={15} /> : String(index + 1).padStart(2, "0")}</div>
                  <div className="lesson-directory-info"><span>{active ? (completed ? "重新学习中" : "学习中") : completed ? "已完成" : unlocked ? "已解锁" : "完成上一课后解锁"}</span><strong>{displayText(lesson.title)}</strong><small>{lesson.steps.length} 个学习步骤</small></div>
                  {progress && <div className="lesson-mini-track"><span style={{ width: `${lessonPercent}%` }} /></div>}
                  {unlocked && <button onClick={() => onStartLesson(lesson.id, completed && !active)}>{active ? <>继续<ArrowRight size={14} /></> : completed ? <><RotateCcw size={14} />重新学习</> : <>开始<ArrowRight size={14} /></>}</button>}
                </div>
              );
            })}
          </div>
        </article>

        <aside className="review-queue-panel">
          <div className="learning-section-heading"><div><Target size={18} /><span><strong>复习队列</strong><small>根据掌握度自动安排</small></span></div></div>
          {upcoming.length === 0 ? <div className="empty-review-queue"><Sparkles size={22} /><p>完成课节后，这里会出现复习任务。</p></div> : <div className="review-queue-list">{upcoming.map((task) => {
            const content = course.knowledge.find((item) => item.id === task.knowledgeItemId);
            const isDue = dueIds.has(task.id);
            return <div key={task.id}><span className={isDue ? "due" : ""}>{isDue ? <Flame size={12} /> : <Clock3 size={12} />}{isDue ? "现在复习" : formatDue(task.dueAt)}</span><strong>{content?.form ?? task.knowledgeItemId}</strong><small>{content ? displayText(content.meaning) : task.mode}</small></div>;
          })}</div>}
        </aside>
      </section>
    </main>
  );
}
