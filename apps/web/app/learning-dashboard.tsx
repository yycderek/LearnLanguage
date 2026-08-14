"use client";

import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  CircleHelp,
  CirclePlay,
  Clock3,
  Flame,
  Library,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { displayText, type CoursePack } from "@/lib/course";
import { dateLocale, uiText, type AppLocale } from "@/lib/i18n";
import {
  courseLearningPercent,
  learningPercent,
  lessonIsUnlocked,
  reviewsDue,
  type CourseLearningRecord,
  type ReviewTask,
} from "@/lib/learning";

function formatDue(value: string, locale: AppLocale) {
  return new Date(value).toLocaleString(dateLocale(locale), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function LearningDashboard({
  course,
  courses = [course],
  record,
  locale = "zh-CN",
  onLocaleChange,
  preview = false,
  onSelectCourse,
  onOpenLibrary,
  onOpenHelp,
  onBack,
  onStartLesson,
  onStartReview,
}: {
  course: CoursePack;
  courses?: CoursePack[];
  record?: CourseLearningRecord;
  locale?: AppLocale;
  onLocaleChange?: (locale: AppLocale) => void;
  preview?: boolean;
  onSelectCourse?: (courseId: string) => void;
  onOpenLibrary?: () => void;
  onOpenHelp?: () => void;
  onBack: () => void;
  onStartLesson: (lessonId: string, restart?: boolean) => void;
  onStartReview: (tasks: ReviewTask[]) => void;
}) {
  const teachingLocale = locale;
  const uiLocale = locale;
  const c = (chinese: string, english: string) => uiText(locale, chinese, english);
  const due = record ? reviewsDue(record) : [];
  const dueIds = new Set(due.map((task) => task.id));
  const completedLessons = course.lessons.filter((lesson) => record?.completedLessonIds.includes(lesson.id));
  const ongoing = course.lessons.find((lesson) => record?.lessonProgress[lesson.id]?.status === "active");
  const percent = courseLearningPercent(course, record);
  const upcoming = record?.reviews.slice(0, 4) ?? [];

  return (
    <main className="learning-home-shell">
      <header className="learning-home-topbar">
        <button onClick={onBack}><ArrowLeft size={17} />{c("返回课程工作台", "Back to Course Studio")}</button>
        <div><span>{preview ? "STUDIO PREVIEW" : "LEARNING HOME"}</span><strong>{displayText(course.manifest.title, teachingLocale)}</strong>{!preview && courses.length > 1 && <select aria-label={c("选择学习课程", "Select a course")} value={course.manifest.id} onChange={(event) => onSelectCourse?.(event.target.value)}>{courses.map((item) => <option key={`${item.manifest.id}:${item.manifest.version}`} value={item.manifest.id}>{displayText(item.manifest.title, teachingLocale)}</option>)}</select>}</div>
        <div className="learning-home-meta"><div className="locale-selectors"><label className="teaching-language-select compact"><span>{c("语言", "Language")}</span><select value={locale} onChange={(event) => onLocaleChange?.(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label>{!preview && <button className="open-library-button" onClick={onOpenLibrary}><Library size={13} />{c("课程库", "Library")}</button>}<button className="open-library-button" onClick={onOpenHelp}><CircleHelp size={13} />{c("帮助", "Guide")}</button></div><em>{preview ? c("临时预览档案 · 不保存", "Temporary preview profile · not saved") : c("设备本地学习档案", "Device-local learning profile")}</em></div>
      </header>

      <section className="learning-home-hero">
        <div>
          <span className="kicker">YOUR LEARNING PATH</span>
          <h1>{c("今天继续前进一点", "Make a little progress today")}</h1>
          <p>{ongoing ? c(`正在学习「${displayText(ongoing.title, teachingLocale)}」`, `Continue “${displayText(ongoing.title, teachingLocale)}”`) : completedLessons.length === course.lessons.length ? c("全部课节已完成，可以开始复习。", "All lessons are complete. You can start reviewing.") : c("选择已解锁的课节开始学习。", "Choose an unlocked lesson to begin.")}</p>
        </div>
        <div className="overall-progress-ring" style={{ "--progress": `${percent * 3.6}deg` } as CSSProperties}><span><strong>{percent}%</strong><small>{c("课程进度", "Course progress")}</small></span></div>
      </section>

      <section className="learning-overview-grid">
        <article className="learning-overview-card primary">
          <div className="overview-icon"><CirclePlay size={21} /></div>
          <span>{c("进行中的课节", "Current lesson")}</span>
          <strong>{ongoing ? displayText(ongoing.title, teachingLocale) : c("暂无进行中课节", "No lesson in progress")}</strong>
          <p>{ongoing ? c(`已完成 ${learningPercent(course, record?.lessonProgress[ongoing.id])}%`, `${learningPercent(course, record?.lessonProgress[ongoing.id])}% complete`) : c("从下方课程目录选择一个课节。", "Choose a lesson from the course outline below.")}</p>
          {ongoing && <button onClick={() => onStartLesson(ongoing.id)}>{c("继续学习", "Continue")}<ArrowRight size={15} /></button>}
        </article>
        <article className="learning-overview-card">
          <div className="overview-icon coral"><Check size={21} /></div>
          <span>{c("已完成课节", "Completed lessons")}</span>
          <strong>{completedLessons.length} / {course.lessons.length}</strong>
          <p>{c("每完成一课，就会解锁下一课。", "Completing a lesson unlocks the next one.")}</p>
        </article>
        <article className="learning-overview-card review-card">
          <div className="overview-icon yellow"><CalendarClock size={21} /></div>
          <span>{c("今日复习", "Reviews today")}</span>
          <strong>{c(`${due.length} 个任务`, `${due.length} tasks`)}</strong>
          <p>{due.length > 0 ? c("这些知识点已经到达复习时间。", "These items are ready for review.") : upcoming[0] ? c(`下一次：${formatDue(upcoming[0].dueAt, uiLocale)}`, `Next: ${formatDue(upcoming[0].dueAt, uiLocale)}`) : c("完成学习后会自动生成复习任务。", "Review tasks appear automatically after learning.")}</p>
          {(due.length > 0 || upcoming.length > 0) && <button onClick={() => onStartReview(due.length > 0 ? due : upcoming)}>{due.length > 0 ? c("开始今日复习", "Start today's review") : c("预习复习卡", "Preview review cards")}<ArrowRight size={15} /></button>}
        </article>
      </section>

      <section className="learning-home-content">
        <article className="lesson-directory">
          <div className="learning-section-heading"><div><BookOpen size={18} /><span><strong>{c("课程目录", "Course outline")}</strong><small>{c("按顺序完成课节，逐步解锁学习路径", "Complete lessons in order to unlock the path")}</small></span></div><em>{c(`${course.lessons.length} 课`, `${course.lessons.length} lessons`)}</em></div>
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
                  <div className="lesson-directory-info"><span>{active ? (completed ? c("重新学习中", "Relearning") : c("学习中", "In progress")) : completed ? c("已完成", "Completed") : unlocked ? c("已解锁", "Unlocked") : c("完成上一课后解锁", "Complete the previous lesson to unlock")}</span><strong>{displayText(lesson.title, teachingLocale)}</strong><small>{c(`${lesson.steps.length} 个学习步骤`, `${lesson.steps.length} learning steps`)}</small></div>
                  {progress && <div className="lesson-mini-track"><span style={{ width: `${lessonPercent}%` }} /></div>}
                  {unlocked && <button onClick={() => onStartLesson(lesson.id, completed && !active)}>{active ? <>{c("继续", "Continue")}<ArrowRight size={14} /></> : completed ? <><RotateCcw size={14} />{c("重新学习", "Learn again")}</> : <>{c("开始", "Start")}<ArrowRight size={14} /></>}</button>}
                </div>
              );
            })}
          </div>
        </article>

        <aside className="review-queue-panel">
          <div className="learning-section-heading"><div><Target size={18} /><span><strong>{c("复习队列", "Review queue")}</strong><small>{c("根据掌握度自动安排", "Scheduled from your mastery evidence")}</small></span></div></div>
          {upcoming.length === 0 ? <div className="empty-review-queue"><Sparkles size={22} /><p>{c("完成课节后，这里会出现复习任务。", "Review tasks will appear here after a lesson.")}</p></div> : <div className="review-queue-list">{upcoming.map((task) => {
            const content = course.knowledge.find((item) => item.id === task.knowledgeItemId);
            const isDue = dueIds.has(task.id);
            return <div key={task.id}><span className={isDue ? "due" : ""}>{isDue ? <Flame size={12} /> : <Clock3 size={12} />}{isDue ? c("现在复习", "Review now") : formatDue(task.dueAt, uiLocale)}</span><strong>{content?.form ?? task.knowledgeItemId}</strong><small>{content ? displayText(content.meaning, teachingLocale) : task.mode}</small></div>;
          })}</div>}
        </aside>
      </section>
    </main>
  );
}
