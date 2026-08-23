"use client";

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarCheck2,
  Check,
  CircleHelp,
  Clock3,
  Flag,
  Flame,
  GraduationCap,
  House,
  Languages,
  Library,
  LockKeyhole,
  PanelTop,
  RotateCcw,
  Route,
  Settings2,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";
import { summarizeCourseCompletion, type LearningPlan } from "@learn-language/application";
import type { AdaptiveLearningAgenda } from "@learn-language/application/adaptive-agenda";
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
  learningPlan,
  agenda,
  locale = "zh-CN",
  onLocaleChange,
  preview = false,
  onSelectCourse,
  onOpenLibrary,
  onOpenPlan,
  onOpenHelp,
  onOpenSettings,
  onBack,
  onStartLesson,
  onStartReview,
}: {
  course: CoursePack;
  courses?: CoursePack[];
  languagePack?: LanguagePack;
  record?: CourseLearningRecord;
  learningPlan?: LearningPlan;
  agenda?: AdaptiveLearningAgenda;
  locale?: AppLocale;
  onLocaleChange?: (locale: AppLocale) => void;
  preview?: boolean;
  onSelectCourse?: (courseId: string) => void;
  onOpenLibrary?: () => void;
  onOpenPlan?: () => void;
  onOpenHelp?: () => void;
  onOpenSettings?: () => void;
  onBack: () => void;
  onStartLesson: (lessonId: string, restart?: boolean) => void;
  onStartReview: (tasks: ReviewTask[]) => void;
}) {
  const teachingLocale = locale;
  const uiLocale = locale;
  const c = (chinese: string, english: string) => uiText(locale, chinese, english);
  const due = record ? reviewsDue(record).sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt)) : [];
  const dueIds = new Set(due.map((task) => task.id));
  const completedLessons = course.lessons.filter((lesson) => record?.completedLessonIds.includes(lesson.id));
  const ongoing = course.lessons.find((lesson) => record?.lessonProgress[lesson.id]?.status === "active");
  const agendaLessonItem = agenda?.items.find((item) => item.kind !== "review");
  const agendaLesson = agendaLessonItem && "lessonId" in agendaLessonItem
    ? course.lessons.find((lesson) => lesson.id === agendaLessonItem.lessonId)
    : undefined;
  const firstIncompleteIndex = course.lessons.findIndex((lesson, index) => lessonIsUnlocked(course, record, index) && !record?.completedLessonIds.includes(lesson.id));
  const focusLesson = ongoing ?? agendaLesson ?? course.lessons[firstIncompleteIndex >= 0 ? firstIncompleteIndex : Math.max(0, course.lessons.length - 1)];
  const focusProgress = focusLesson ? record?.lessonProgress[focusLesson.id] : undefined;
  const focusCompleted = focusLesson ? record?.completedLessonIds.includes(focusLesson.id) === true : false;
  const focusStages = focusLesson ? buildLearnerStages(
    focusLesson,
    focusProgress?.currentStepId ?? focusLesson.entryStepId,
    focusProgress?.completedStepIds ?? [],
  ).map((stage) => focusCompleted ? { ...stage, status: "completed" as const } : stage) : [];
  const percent = courseLearningPercent(course, record);
  const upcoming = record?.reviews.slice(0, 4) ?? [];
  const completionSummary = summarizeCourseCompletion(course, record);
  const weakTaskIds = new Set(completionSummary.weakKnowledge.flatMap((item) => item.reviewTaskIds));
  const weakTasks = record?.reviews.filter((task) => weakTaskIds.has(task.id)) ?? [];
  const languageBadge = languagePack?.accent ?? course.manifest.languageId.slice(0, 2).toUpperCase();
  const focusGoal = focusLesson?.canDoGoalRefs
    .map((goalId) => course.goals.find((goal) => goal.id === goalId))
    .find(Boolean);
  const planStartingLesson = learningPlan ? course.lessons.find((lesson) => lesson.id === learningPlan.startingLessonId) : undefined;
  const planMotivation = learningPlan ? ({
    travel: c("旅行交流", "Travel"),
    "daily-life": c("日常生活", "Daily life"),
    "work-study": c("工作或学习", "Work or study"),
    "culture-media": c("文化与内容", "Culture and media"),
  } as const)[learningPlan.motivation] : undefined;
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
            {onOpenPlan && <button type="button" onClick={onOpenPlan}><Target size={17} /><span>{c("学习计划", "Plan")}</span></button>}
            <button type="button" onClick={onOpenLibrary}><Library size={17} /><span>{c("课程库", "Library")}</span></button>
            <button type="button" onClick={() => onStartReview(due.length > 0 ? due : upcoming)} disabled={due.length === 0 && upcoming.length === 0}><RotateCcw size={17} /><span>{c("复习", "Review")}</span>{due.length > 0 && <em>{due.length}</em>}</button>
            {onOpenSettings && <button type="button" onClick={onOpenSettings}><Settings2 size={17} /><span>{c("设置", "Settings")}</span></button>}
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

        {!preview && (
          <nav className="mobile-workspace-nav learning-mobile-nav" aria-label={c("学习导航", "Learning navigation")}>
            <button className="active" type="button"><House size={15} />{c("今日学习", "Today")}</button>
            {onOpenPlan && <button type="button" onClick={onOpenPlan}><Target size={15} />{c("计划", "Plan")}</button>}
            <button type="button" onClick={onOpenLibrary}><Library size={15} />{c("课程库", "Library")}</button>
            <button type="button" onClick={() => onStartReview(due.length > 0 ? due : upcoming)} disabled={due.length === 0 && upcoming.length === 0}><RotateCcw size={15} />{c("复习", "Review")}</button>
            {onOpenSettings && <button type="button" onClick={onOpenSettings}><Settings2 size={15} />{c("设置", "Settings")}</button>}
            <button type="button" onClick={() => document.getElementById("course-outline")?.scrollIntoView({ behavior: "smooth", block: "start" })}><BarChart3 size={15} />{c("学习进度", "Progress")}</button>
          </nav>
        )}

        {!preview && onOpenPlan && (
          <section className={`learning-plan-summary-card ${learningPlan ? "" : "empty"}`}>
            <div className="learning-plan-summary-icon"><Target size={20} /></div>
            {learningPlan ? <>
              <div><small>{c("个人学习计划", "PERSONAL LEARNING PLAN")}</small><strong>{c(`每周 ${learningPlan.weeklyTargetMinutes} 分钟 · ${planMotivation}`, `${learningPlan.weeklyTargetMinutes} min/week · ${planMotivation}`)}</strong><span>{c(`建议每周完成 ${learningPlan.lessonTargetCount} 个课节，从「${displayText(planStartingLesson?.title, teachingLocale)}」开始`, `Aim for ${learningPlan.lessonTargetCount} lessons a week, starting with “${displayText(planStartingLesson?.title, teachingLocale)}”`)}</span></div>
              <button type="button" onClick={onOpenPlan}>{c("查看与调整", "View & adjust")}<ArrowRight size={14} /></button>
            </> : <>
              <div><small>{c("可选设置", "OPTIONAL SETUP")}</small><strong>{c("还没有个人学习计划", "No personal learning plan yet")}</strong><span>{c("选择目标与节奏，也可以做一次不计成绩的基础检查。", "Choose a goal and pace, with an optional ungraded foundation check.")}</span></div>
              <button type="button" onClick={onOpenPlan}>{c("设置计划", "Set a plan")}<ArrowRight size={14} /></button>
            </>}
          </section>
        )}


        {completionSummary.complete && (
          <section className="course-completion-card" aria-labelledby="course-completion-title">
            <div className="course-completion-icon"><GraduationCap size={28} /></div>
            <div className="course-completion-copy">
              <small>{c("课程完成总结", "COURSE COMPLETION SUMMARY")}</small>
              <h2 id="course-completion-title">{c("你已完成这门课程", "You completed this course")}</h2>
              <p>{c(`已完成 ${completionSummary.totalLessonCount} 个课节，并达成 ${completionSummary.achievedGoalIds.length} 个课程目标。`, `You completed ${completionSummary.totalLessonCount} lessons and achieved ${completionSummary.achievedGoalIds.length} course goals.`)}</p>
              <ul>{completionSummary.achievedGoalIds.slice(0, 4).map((goalId) => { const goal = course.goals.find((item) => item.id === goalId); return goal ? <li key={goalId}><Check size={13} />{displayText(goal.description, teachingLocale)}</li> : null; })}</ul>
              <div className="course-completion-stats">
                <span><strong>{completionSummary.masteryCounts["independent-output"] + completionSummary.masteryCounts["delayed-transfer"]}</strong>{c("个知识点可独立运用", "knowledge items used independently")}</span>
                <span><strong>{completionSummary.dueReviewCount}</strong>{c("项到期复习", "reviews due")}</span>
                <span><strong>{completionSummary.weakKnowledge.length}</strong>{c("项建议巩固", "items to reinforce")}</span>
              </div>
            </div>
            <div className="course-completion-actions">
              {weakTasks.length > 0 && <button className="primary-button" type="button" onClick={() => onStartReview(weakTasks)}><Target size={15} />{c("巩固薄弱项", "Practice weak items")}</button>}
              <button className="outline-button" type="button" onClick={onOpenLibrary}><Library size={15} />{c("选择下一门课程", "Choose another course")}</button>
            </div>
          </section>
        )}

        {completionSummary.weakKnowledge.length > 0 && (
          <section className="weak-knowledge-panel" aria-labelledby="weak-knowledge-title">
            <header><div><Target size={19} /><span><small>{c("根据现有学习证据", "FROM EXISTING LEARNING EVIDENCE")}</small><h2 id="weak-knowledge-title">{c("建议重点巩固", "Recommended targeted practice")}</h2></span></div>{weakTasks.length > 0 && <button type="button" onClick={() => onStartReview(weakTasks)}>{c("开始针对练习", "Start targeted practice")}<ArrowRight size={14} /></button>}</header>
            <div className="weak-knowledge-list">{completionSummary.weakKnowledge.map((item) => <article key={item.knowledgeItemId}><strong>{item.form}</strong><span>{item.reasons.map((reason) => ({ "lesson-retries": c("课内多次尝试", "lesson retries"), "review-retries": c("复习需要重试", "review retries"), "due-review": c("已经到期", "due now"), "early-mastery": c("仍在早期掌握阶段", "early mastery") })[reason]).join(" · ")}</span><em>{c(`优先级 ${item.priority}`, `Priority ${item.priority}`)}</em></article>)}</div>
            <footer>{c("只使用尝试次数、掌握等级与复习结果推导；不会新增或展示原始作答内容。", "Derived only from attempt counts, mastery levels, and review results; raw answers are neither added nor shown.")}</footer>
          </section>
        )}

        {!preview && agenda && (
          <section className={`adaptive-agenda-card ${agenda.status}`} aria-labelledby="today-agenda-title">
            <header>
              <div className="adaptive-agenda-heading">
                <span><CalendarCheck2 size={21} /></span>
                <div><small>{c("今日自适应安排", "TODAY'S ADAPTIVE PLAN")}</small><h2 id="today-agenda-title">{c("今天学什么", "What to learn today")}</h2></div>
              </div>
              <em>{agenda.status === "course-complete" ? c("课程已完成", "Course complete") : agenda.status === "target-met" ? c("本周目标已完成", "Weekly target met") : c(`今日 ${agenda.today.completedMinutes}/${agenda.today.targetMinutes} 分钟`, `${agenda.today.completedMinutes}/${agenda.today.targetMinutes} min today`)}</em>
            </header>
            <div className="adaptive-week-progress">
              <div><span>{c("本周实际进度", "Actual progress this week")}</span><strong>{c(`${agenda.week.completedMinutes}/${agenda.week.targetMinutes} 分钟 · ${agenda.week.completedLessonCount}/${agenda.week.targetLessonCount} 课节`, `${agenda.week.completedMinutes}/${agenda.week.targetMinutes} min · ${agenda.week.completedLessonCount}/${agenda.week.targetLessonCount} lessons`)}</strong></div>
              <div className="adaptive-progress-track" role="progressbar" aria-label={c("本周计划完成度", "Weekly plan progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={agenda.week.percent}><span style={{ width: `${agenda.week.percent}%` }} /></div>
            </div>
            <div className="adaptive-agenda-items">
              {agenda.items.map((item) => {
                if (item.kind === "review") return (
                  <article key="review">
                    <span><RotateCcw size={18} /></span>
                    <div><small>{c("优先任务", "PRIORITY")}</small><strong>{c(`复习 ${item.taskCount} 个知识点`, `Review ${item.taskCount} knowledge items`)}</strong><p>{c(`根据到期时间安排 · 约 ${item.estimatedMinutes} 分钟`, `Scheduled by due time · about ${item.estimatedMinutes} min`)}</p></div>
                    <button type="button" onClick={() => onStartReview(due.slice(0, item.taskCount))}>{c("开始复习", "Start review")}<ArrowRight size={14} /></button>
                  </article>
                );
                const lesson = course.lessons.find((candidate) => candidate.id === item.lessonId);
                if (!lesson) return null;
                return (
                  <article key={item.lessonId}>
                    <span><BookOpen size={18} /></span>
                    <div><small>{item.kind === "continue-lesson" ? c("继续上次进度", "RESUME") : c("下一课", "NEXT LESSON")}</small><strong>{displayText(lesson.title, teachingLocale)}</strong><p>{c(`建议安排约 ${item.estimatedMinutes} 分钟`, `Plan about ${item.estimatedMinutes} min`)}</p></div>
                    <button type="button" onClick={() => onStartLesson(item.lessonId)}>{item.kind === "continue-lesson" ? c("继续课节", "Continue") : c("开始课节", "Start")}<ArrowRight size={14} /></button>
                  </article>
                );
              })}
              {agenda.items.length === 0 && (
                <div className="adaptive-agenda-complete"><Sparkles size={20} /><div><strong>{agenda.status === "course-complete" ? c("这门课程已完成", "You completed this course") : c("本周目标已完成", "Weekly target complete")}</strong><p>{c("可以自由复习或继续学习；错过某一天不会扣减进度。", "Review or keep learning freely; missing a day never reduces progress.")}</p></div></div>
              )}
            </div>
            <footer>{c("安排由课节用时、完成记录和到期复习自动调整。", "The plan adapts from lesson time, completions, and due reviews.")}</footer>
          </section>
        )}

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
            <div className="learning-map-heading">
              <div><span><Route size={19} /></span><div><strong>{c("本课学习地图", "Lesson learning map")}</strong><small>{c("沿路线完成三个真实学习阶段", "Follow the route through three real learning stages")}</small></div></div>
              <em>{c(`${focusStages.filter((stage) => stage.status === "completed").length}/${focusStages.length} 个阶段完成`, `${focusStages.filter((stage) => stage.status === "completed").length}/${focusStages.length} stages complete`)}</em>
            </div>
            <div className="learning-task-path" aria-label={c("本课任务路径", "Lesson task path")}>
              {focusStages.map((stage, index) => {
                const copy = stageCopy[stage.id];
                const stagePercent = Math.round((stage.completedSteps / Math.max(1, stage.stepIds.length)) * 100);
                return (
                  <div className="learning-task-wrap" key={stage.id}>
                    {index > 0 && <div className={`learning-task-link ${focusStages[index - 1].status === "completed" ? "done" : ""}`} />}
                    <article className={`learning-task ${stage.status}`} aria-current={stage.status === "active" ? "step" : undefined}>
                      <span className="learning-task-node"><b>{String(index + 1).padStart(2, "0")}</b>{stage.status === "completed" ? <Check size={22} /> : stage.status === "upcoming" ? <LockKeyhole size={20} /> : stage.id === "use" ? <Flag size={21} /> : stage.id === "practice" ? <Target size={21} /> : <GraduationCap size={22} />}</span>
                      <div className="learning-task-copy">
                        <div className="learning-task-meta"><small>{c(`阶段 ${index + 1}`, `STAGE ${index + 1}`)}</small><em>{stage.status === "completed" ? c("已完成", "Complete") : stage.status === "active" ? c("当前任务", "Current") : c("尚未解锁", "Locked")}</em></div>
                        <strong>{c(...copy.label)}</strong><p>{c(...copy.detail)}</p>
                        <div className="learning-stage-progress" aria-label={c(`${stage.completedSteps}/${stage.stepIds.length} 个步骤完成`, `${stage.completedSteps}/${stage.stepIds.length} steps complete`)}><span style={{ width: `${stagePercent}%` }} /></div>
                        <small className="learning-stage-count">{c(`${stage.completedSteps}/${stage.stepIds.length} 个步骤`, `${stage.completedSteps}/${stage.stepIds.length} steps`)}</small>
                      </div>
                      {stage.status === "active" ? <button onClick={() => onStartLesson(focusLesson.id, focusCompleted)}>{focusProgress ? c("继续任务", "Continue task") : c("开始任务", "Start task")}<ArrowRight size={15} /></button> : <span className="learning-task-state">{stage.status === "completed" ? <><Check size={14} />{c("已掌握", "Mastered")}</> : <><LockKeyhole size={13} />{c("完成上一阶段后解锁", "Unlock after the previous stage")}</>}</span>}
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
