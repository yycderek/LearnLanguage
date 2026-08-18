"use client";

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CircleHelp,
  Clock3,
  Flame,
  GraduationCap,
  House,
  Languages,
  Library,
  LockKeyhole,
  PanelTop,
  RotateCcw,
  Route,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";
import { displayText, type CoursePack } from "@/lib/course";
import { dateLocale, uiText, type AppLocale } from "@/lib/i18n";
import type { LanguagePack } from "@/lib/language-pack";
import { buildLearnerStages, type LearnerStageId } from "@/lib/learning-presentation";
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
  languagePack,
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
  languagePack?: LanguagePack;
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
  const firstIncompleteIndex = course.lessons.findIndex((lesson, index) => lessonIsUnlocked(course, record, index) && !record?.completedLessonIds.includes(lesson.id));
  const focusLesson = ongoing ?? course.lessons[firstIncompleteIndex >= 0 ? firstIncompleteIndex : Math.max(0, course.lessons.length - 1)];
  const focusProgress = focusLesson ? record?.lessonProgress[focusLesson.id] : undefined;
  const focusCompleted = focusLesson ? record?.completedLessonIds.includes(focusLesson.id) === true : false;
  const focusStages = focusLesson ? buildLearnerStages(
    focusLesson,
    focusProgress?.currentStepId ?? focusLesson.entryStepId,
    focusProgress?.completedStepIds ?? [],
  ).map((stage) => focusCompleted ? { ...stage, status: "completed" as const } : stage) : [];
  const percent = courseLearningPercent(course, record);
  const upcoming = record?.reviews.slice(0, 4) ?? [];
  const languageBadge = languagePack?.accent ?? course.manifest.languageId.slice(0, 2).toUpperCase();
  const focusGoal = focusLesson?.canDoGoalRefs
    .map((goalId) => course.goals.find((goal) => goal.id === goalId))
    .find(Boolean);
  const stageCopy: Record<LearnerStageId, { label: [string, string]; detail: [string, string] }> = {
    learn: { label: ["理解", "Understand"], detail: ["认识本课表达与使用场景", "Meet the lesson forms and their context"] },
    practice: { label: ["练习", "Practice"], detail: ["通过互动练习建立稳定理解", "Build reliable understanding through interaction"] },
    use: { label: ["运用", "Use"], detail: ["完成有明确标准的情景任务", "Complete a scenario task with clear criteria"] },
  };

  return (
    <main className={`learning-product-shell ${preview ? "preview" : ""}`}>
      {!preview && (
        <aside className="learning-side-rail">
          <div className="learning-brand"><span><Languages size={20} /></span><div><strong>LearnLanguage</strong><small>OPEN LANGUAGE PLATFORM</small></div></div>
          <div className="product-mode-switch" aria-label={c("切换产品空间", "Switch product space")}>
            <button className="active" type="button"><GraduationCap size={16} /><span>{c("学习", "Learn")}</span></button>
            <button type="button" onClick={onBack}><PanelTop size={16} /><span>Studio</span></button>
          </div>
          <nav className="learning-side-nav" aria-label={c("学习导航", "Learning navigation")}>
            <button className="active" type="button"><House size={17} /><span>{c("今日学习", "Today")}</span></button>
            <button type="button" onClick={onOpenLibrary}><Library size={17} /><span>{c("课程库", "Library")}</span></button>
            <button type="button" onClick={() => onStartReview(due.length > 0 ? due : upcoming)} disabled={due.length === 0 && upcoming.length === 0}><RotateCcw size={17} /><span>{c("复习", "Review")}</span>{due.length > 0 && <em>{due.length}</em>}</button>
            <button type="button" onClick={() => document.getElementById("course-outline")?.scrollIntoView({ behavior: "smooth", block: "start" })}><BarChart3 size={17} /><span>{c("学习进度", "Progress")}</span></button>
          </nav>
          <div className="local-profile"><span><UserRound size={16} /></span><div><strong>{c("本地学习档案", "Local profile")}</strong><small>{c("数据保存在当前设备", "Data stays on this device")}</small></div></div>
        </aside>
      )}

      <section className="learning-home-shell">
        <header className="learning-home-topbar">
          {preview && <button onClick={onBack}><ArrowLeft size={17} />{c("返回课程编辑器", "Back to course editor")}</button>}
          <div className="learning-home-heading"><span>{preview ? "STUDIO PREVIEW" : c("学习空间 · LEARN", "LEARNING SPACE · LEARN")}</span><strong>{preview ? displayText(course.manifest.title, teachingLocale) : c("继续今天的学习", "Continue today's learning")}</strong>{!preview && courses.length > 1 && <select aria-label={c("选择学习课程", "Select a course")} value={course.manifest.id} onChange={(event) => onSelectCourse?.(event.target.value)}>{courses.map((item) => <option key={`${item.manifest.id}:${item.manifest.version}`} value={item.manifest.id}>{displayText(item.manifest.title, teachingLocale)}</option>)}</select>}</div>
          <div className="learning-home-meta"><div className="locale-selectors"><label className="teaching-language-select compact"><span>{c("界面与讲解", "Interface & instruction")}</span><select value={locale} onChange={(event) => onLocaleChange?.(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label>{!preview && <button className="open-library-button" onClick={onOpenLibrary}><Library size={13} />{c("课程库", "Library")}</button>}<button className="open-library-button" onClick={onOpenHelp}><CircleHelp size={13} />{c("帮助", "Guide")}</button></div><em>{preview ? c("临时预览档案 · 不保存", "Temporary preview profile · not saved") : c("无需账户 · 本地优先", "No account · local first")}</em></div>
        </header>

        <section className="learning-summary-grid">
          <article><span><Route size={19} /></span><div><small>{c("课程进度", "Course progress")}</small><strong>{completedLessons.length} / {course.lessons.length} {c("课", "lessons")}</strong></div><em>{percent}%</em></article>
          <article><span><Check size={19} /></span><div><small>{c("已完成课节", "Completed lessons")}</small><strong>{c(`${completedLessons.length} 个里程碑`, `${completedLessons.length} milestones`)}</strong></div><em>{c("稳定前进", "Steady progress")}</em></article>
          <article><span><RotateCcw size={19} /></span><div><small>{c("今日复习", "Reviews today")}</small><strong>{c(`${due.length} 个知识点`, `${due.length} knowledge items`)}</strong></div>{(due.length > 0 || upcoming.length > 0) && <button onClick={() => onStartReview(due.length > 0 ? due : upcoming)}>{due.length > 0 ? c("先复习", "Review first") : c("查看复习卡", "View cards")}</button>}</article>
        </section>

        {focusLesson && (
          <section className="learning-focus-panel">
            <header>
              <div className="learning-course-identity"><span>{languageBadge}</span><div><small>{languagePack?.name.native ?? course.manifest.languageId} · {c("当前课程", "CURRENT COURSE")}</small><h1>{displayText(focusLesson.title, teachingLocale)}</h1></div></div>
              <div className="learning-focus-status"><Clock3 size={15} /><span>{c(`${focusLesson.steps.length} 个学习步骤`, `${focusLesson.steps.length} learning steps`)}</span></div>
            </header>
            <p className="learning-focus-goal">{focusGoal ? displayText(focusGoal.description, teachingLocale) : c("完成理解、练习和运用三个阶段，逐步掌握本课能力。", "Complete Understand, Practice, and Use to build this lesson's ability.")}</p>
            <div className="learning-task-path" aria-label={c("本课任务路径", "Lesson task path")}>
              {focusStages.map((stage, index) => {
                const copy = stageCopy[stage.id];
                return (
                  <div className="learning-task-wrap" key={stage.id}>
                    {index > 0 && <div className={`learning-task-link ${focusStages[index - 1].status === "completed" ? "done" : ""}`} />}
                    <article className={`learning-task ${stage.status}`}>
                      <span>{stage.status === "completed" ? <Check size={17} /> : stage.status === "active" ? <GraduationCap size={18} /> : <LockKeyhole size={16} />}</span>
                      <div><small>{c(...copy.label)} · {c(`${stage.completedSteps}/${stage.stepIds.length} 步`, `${stage.completedSteps}/${stage.stepIds.length} steps`)}</small><strong>{c(...copy.label)}</strong><p>{c(...copy.detail)}</p></div>
                      {stage.status === "active" ? <button onClick={() => onStartLesson(focusLesson.id, focusCompleted)}>{focusProgress ? c("继续任务", "Continue task") : c("开始任务", "Start task")}<ArrowRight size={14} /></button> : <em>{stage.status === "completed" ? c("已掌握", "Complete") : c("待解锁", "Locked")}</em>}
                    </article>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="learning-home-content">
          <article className="lesson-directory" id="course-outline">
            <div className="learning-section-heading"><div><BookOpen size={18} /><span><strong>{c("完整课程目录", "Full course outline")}</strong><small>{c("按顺序完成课节，逐步解锁学习路径", "Complete lessons in order to unlock the path")}</small></span></div><em>{c(`${course.lessons.length} 课`, `${course.lessons.length} lessons`)}</em></div>
            <div className="lesson-directory-list">
              {course.lessons.map((lesson, index) => {
                const progress = record?.lessonProgress[lesson.id];
                const unlocked = lessonIsUnlocked(course, record, index);
                const completed = record?.completedLessonIds.includes(lesson.id) === true;
                const active = progress?.status === "active";
                const lessonPercent = learningPercent(course, progress);
                return (
                  <div className={`lesson-directory-row ${!unlocked ? "locked" : ""} ${lesson.id === focusLesson?.id ? "focus" : ""}`} key={lesson.id}>
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
      </section>
    </main>
  );
}
