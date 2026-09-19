"use client";

import { ArrowDown, ArrowUp, ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { displayText, type CoursePack, type LessonPhase } from "@/lib/course";
import { uiText, type AppLocale } from "@/lib/i18n";
import { appendLesson, appendLessonStep, appendUnit, assignLessonToUnit, duplicateLesson, moveLesson, moveLessonStep, moveUnit, removeLesson, removeLessonStep, removeUnit, renameUnit } from "@/lib/course-authoring";
import { ReferencePicker } from "@/app/studio/reference-picker";
import styles from "./course-flow-editor.module.css";

type CourseFlowEditorProps = {
  course: CoursePack;
  locale: AppLocale;
  selectedUnitId: string;
  selectedStudioLessonId: string;
  setSelectedUnitId: (id: string) => void;
  setSelectedStudioLessonId: (id: string) => void;
  editCourse: (change: (next: CoursePack) => void) => void;
  setNotice: (message: string) => void;
};

export function CourseFlowEditor({ course, locale, selectedUnitId, selectedStudioLessonId, setSelectedUnitId, setSelectedStudioLessonId, editCourse, setNotice }: CourseFlowEditorProps) {
  const appLocale = locale;
  const teachingLocale = locale;
  const t = (zh: string, en: string) => uiText(locale, zh, en);
  const selectedStudioLessonIndex = Math.max(0, course.lessons.findIndex((lesson) => lesson.id === selectedStudioLessonId));
  const selectedStudioLesson = course.lessons[selectedStudioLessonIndex];
  const flow = selectedStudioLesson?.steps ?? [];
  const knowledgeOptions = course.knowledge.map((item) => ({ id: item.id, label: item.form || t("未命名知识点", "Untitled knowledge") }));
  const utteranceOptions = course.utterances.map((item, index) => ({ id: item.id, label: item.text || t("Utterance " + (index + 1), "Utterance " + (index + 1)) }));
  const exerciseOptions = course.exercises.map((item, index) => ({ id: item.id, label: displayText(item.prompt, teachingLocale) || t("Exercise " + (index + 1), "Exercise " + (index + 1)) }));
  const goalOptions = course.goals.map((item, index) => ({ id: item.id, label: displayText(item.description, teachingLocale) || t("Goal " + (index + 1), "Can-do goal " + (index + 1)) }));

  function selectedDraftLesson(next: CoursePack) {
    return next.lessons.find((lesson) => lesson.id === selectedStudioLessonId) ?? next.lessons[0];
  }

  function activeStudioLessonId(next: CoursePack = course) {
    return next.lessons.find((lesson) => lesson.id === selectedStudioLessonId)?.id ?? next.lessons[0]?.id ?? "";
  }

  function addCourseLesson() {
    let createdId = "";
    editCourse((next) => {
      createdId = appendLesson(next, appLocale, t("新课节", "New lesson"));
      if (next.units?.some((unit) => unit.id === selectedUnitId)) assignLessonToUnit(next, createdId, selectedUnitId);
    });
    if (createdId) setSelectedStudioLessonId(createdId);
  }

  function moveCourseLesson(offset: -1 | 1) {
    editCourse((next) => { moveLesson(next, activeStudioLessonId(next), offset); });
  }

  function duplicateCourseLesson() {
    let createdId: string | undefined;
    editCourse((next) => { createdId = duplicateLesson(next, activeStudioLessonId(next), appLocale); });
    if (createdId) {
      setSelectedStudioLessonId(createdId);
      setNotice(t("课节副本已创建，可独立修改", "A lesson copy was created and can be edited independently"));
    }
  }

  function addCourseUnit() {
    let createdId = "";
    editCourse((next) => { createdId = appendUnit(next, appLocale, t("新单元", "New unit")); });
    if (createdId) setSelectedUnitId(createdId);
  }

  function moveCourseUnit(unitId: string, offset: -1 | 1) {
    editCourse((next) => { moveUnit(next, unitId, offset); });
  }

  function deleteCourseUnit(unitId: string) {
    const unit = course.units?.find((item) => item.id === unitId);
    if (!unit || !window.confirm(t(`删除单元“${displayText(unit.title, appLocale)}”？其中课节会移动到相邻单元。`, `Delete “${displayText(unit.title, appLocale)}”? Its lessons will move to an adjacent unit.`))) return;
    editCourse((next) => { removeUnit(next, unitId); });
    setSelectedUnitId(course.units?.find((item) => item.id !== unitId)?.id ?? "unit-1");
  }

  function setLessonUnit(lessonId: string, unitId: string) {
    editCourse((next) => { assignLessonToUnit(next, lessonId, unitId); });
    setSelectedUnitId(unitId);
  }

  function deleteCourseLesson() {
    if (course.lessons.length <= 1) {
      setNotice(t("课程至少需要保留一个课节", "A course must keep at least one lesson"));
      return;
    }
    const selectedId = activeStudioLessonId();
    const selected = course.lessons.find((lesson) => lesson.id === selectedId);
    if (!selected || !window.confirm(t(`确定删除课节“${displayText(selected.title, appLocale)}”吗？`, `Delete the lesson “${displayText(selected.title, appLocale)}”?`))) return;
    let nextId: string | undefined;
    editCourse((next) => { nextId = removeLesson(next, selectedId); });
    if (nextId) setSelectedStudioLessonId(nextId);
  }

  function addStep() {
    editCourse((next) => {
      const lesson = selectedDraftLesson(next);
      if (lesson) appendLessonStep(lesson, appLocale, t("新学习步骤", "New learning step"));
    });
  }

  function moveStep(index: number, offset: -1 | 1) {
    editCourse((next) => {
      const lesson = selectedDraftLesson(next);
      if (lesson) moveLessonStep(lesson, index, offset);
    });
  }

  function removeStep(index: number) {
    const lesson = course.lessons.find((item) => item.id === activeStudioLessonId()) ?? course.lessons[0];
    if (!lesson || lesson.steps.length <= 1) {
      setNotice(t("每个课节至少需要保留一个学习步骤", "Each lesson must keep at least one learning step"));
      return;
    }
    editCourse((next) => {
      const selected = selectedDraftLesson(next);
      if (selected) removeLessonStep(selected, index);
    });
  }

  return (
<div className={`form-section ${styles.editor}`}>
                      <div className="section-intro"><div><h3>{t("课程单元与课节", "Course units and lessons")}</h3><p>{t("先用单元组织课程，再为每个课节选择目标、材料和练习。技术 ID 会由系统自动维护。", "Organize the course into units, then choose goals, materials, and exercises for each lesson. Technical IDs are managed automatically.")}</p></div><div className="section-actions"><button className="outline-button" onClick={addCourseUnit}><Plus size={15} />{t("添加单元", "Add unit")}</button><button className="outline-button" onClick={addCourseLesson}><Plus size={15} />{t("添加课节", "Add lesson")}</button></div></div>
                      <h4 className={styles.sectionTitle}>{t("单元", "Units")}</h4>
<section className="unit-manager" aria-label={t("课程单元", "Course units")}>
                        {(course.units ?? []).map((unit, index) => (
                          <article className={unit.id === selectedUnitId ? "unit-card active" : "unit-card"} key={unit.id}>
                            <button type="button" className={styles.unitSelect} aria-pressed={unit.id === selectedUnitId} aria-label={t("选择单元：", "Select unit: ") + displayText(unit.title, teachingLocale)} onClick={() => setSelectedUnitId(unit.id)}>{String(index + 1).padStart(2, "0")}</button>
                            <label><small>{t("单元名称", "Unit title")}</small><input value={unit.title[teachingLocale] ?? ""} onFocus={() => setSelectedUnitId(unit.id)} onChange={(event) => editCourse((next) => { renameUnit(next, unit.id, teachingLocale, event.target.value); })} /></label>
                            <em>{t(unit.lessonRefs.length + " 课", unit.lessonRefs.length + " lessons")}</em>
                            <div className="unit-actions"><button type="button" onClick={(event) => { event.stopPropagation(); moveCourseUnit(unit.id, -1); }} disabled={index === 0} aria-label={t("单元前移", "Move unit earlier")}><ArrowUp size={14} /></button><button type="button" onClick={(event) => { event.stopPropagation(); moveCourseUnit(unit.id, 1); }} disabled={index === (course.units?.length ?? 0) - 1} aria-label={t("单元后移", "Move unit later")}><ArrowDown size={14} /></button><button type="button" className="danger" onClick={(event) => { event.stopPropagation(); deleteCourseUnit(unit.id); }} disabled={(course.units?.length ?? 0) <= 1} aria-label={t("删除单元", "Delete unit")}><Trash2 size={14} /></button></div>
                          </article>
                        ))}
                      </section>
                      <h4 className={styles.sectionTitle}>{t("课节 · 按课程顺序", "Lessons · course order")}</h4>
<div className="lesson-sequence" role="group" aria-label={t("课程课节顺序", "Course lesson order")}>
                        {course.lessons.map((lesson, index) => <button type="button" aria-pressed={lesson.id === selectedStudioLesson?.id} className={lesson.id === selectedStudioLesson?.id ? "active" : ""} key={lesson.id} onClick={() => { setSelectedStudioLessonId(lesson.id); const unit = course.units?.find((item) => item.lessonRefs.includes(lesson.id)); if (unit) setSelectedUnitId(unit.id); }}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{displayText(lesson.title, teachingLocale)}</strong><small>{displayText(course.units?.find((unit) => unit.lessonRefs.includes(lesson.id))?.title ?? {}, teachingLocale)} · {t(lesson.steps.length + " 步", lesson.steps.length + " steps")}</small></div></button>)}
                      </div>
                      {selectedStudioLesson && <div className="selected-lesson-panel">
                        <div className="selected-lesson-heading"><div><span>{t("正在编辑第 " + (selectedStudioLessonIndex + 1) + " 课", "Editing lesson " + (selectedStudioLessonIndex + 1))}</span><strong>{displayText(selectedStudioLesson.title, teachingLocale)}</strong></div><div><button type="button" onClick={duplicateCourseLesson} aria-label={t("复制当前课节", "Duplicate current lesson")}><Copy size={15} /></button><button type="button" onClick={() => moveCourseLesson(-1)} disabled={selectedStudioLessonIndex === 0} aria-label={t("课节前移", "Move lesson earlier")}><ArrowUp size={15} /></button><button type="button" onClick={() => moveCourseLesson(1)} disabled={selectedStudioLessonIndex === course.lessons.length - 1} aria-label={t("课节后移", "Move lesson later")}><ArrowDown size={15} /></button><button type="button" className="danger" onClick={deleteCourseLesson} disabled={course.lessons.length <= 1} aria-label={t("删除当前课节", "Delete current lesson")}><Trash2 size={15} /></button></div></div>
                        <div className="form-grid two-column lesson-fields">
                          <label><span>{t("课节名称", "Lesson title")} ({teachingLocale === "en" ? "English" : "中文"})</span><input value={selectedStudioLesson.title[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.title[teachingLocale] = event.target.value; })} /></label>
                          <label><span>{t("所属单元", "Unit")}</span><select value={(course.units ?? []).find((unit) => unit.lessonRefs.includes(selectedStudioLesson.id))?.id ?? ""} onChange={(event) => setLessonUnit(selectedStudioLesson.id, event.target.value)}>{(course.units ?? []).map((unit) => <option key={unit.id} value={unit.id}>{displayText(unit.title, teachingLocale)}</option>)}</select></label>
                          <ReferencePicker label={t("本课学习目标", "Learning goals for this lesson")} options={goalOptions} selected={selectedStudioLesson.canDoGoalRefs} emptyLabel={t("暂无能力目标，可在 JSON 进阶模式补充", "No can-do goals yet; add them in advanced JSON mode")} onChange={(ids) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.canDoGoalRefs = ids; })} />
                        </div>
                      </div>}
                      <div className={styles.stepsHeading}><h4 className={styles.sectionTitle}>{t("学习步骤", "Learning steps")} · {flow.length}</h4><button type="button" className="outline-button" onClick={addStep} disabled={!selectedStudioLesson}><Plus size={15} />{t("添加步骤", "Add step")}</button></div>
<div className="item-stack compact">
                        {flow.map((step, index) => (
                          <details className={styles.step} key={step.id} open={index === 0}>
<summary><span className={styles.stepIndex}>{String(index + 1).padStart(2, "0")}</span><strong>{displayText(step.title, teachingLocale) || t("未命名步骤", "Untitled step")}</strong><span className={styles.stepHint}>{t("展开编辑", "Edit details")}</span><ChevronDown className={styles.chevron} size={18} aria-hidden="true" /></summary>
<div className={styles.stepBody}>
                            <div className="form-grid two-column">
                              <label><span>{t("阶段", "Phase")}</span><select value={step.phase} onChange={(event) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.steps[index].phase = event.target.value as LessonPhase; })}><option value="diagnostic">{t("诊断", "Diagnostic")}</option><option value="preteach">{t("预教", "Pre-teaching")}</option><option value="supported-input">{t("支持性输入", "Supported input")}</option><option value="comprehension">{t("独立理解", "Comprehension")}</option><option value="guided-output">{t("引导输出", "Guided output")}</option><option value="independent-task">{t("独立任务", "Independent task")}</option><option value="feedback-retry">{t("反馈重试", "Feedback retry")}</option><option value="delayed-transfer">{t("延迟迁移", "Delayed transfer")}</option></select></label>
                              <label><span>{t("显示标题", "Display title")} ({teachingLocale === "en" ? "English" : "中文"})</span><input value={step.title[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.steps[index].title[teachingLocale] = event.target.value; })} /></label>
                              <ReferencePicker label={t("本步骤知识点", "Knowledge in this step")} options={knowledgeOptions} selected={step.knowledgeRefs} emptyLabel={t("暂无知识点", "No knowledge yet")} onChange={(ids) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.steps[index].knowledgeRefs = ids; })} />
                              <ReferencePicker label={t("本步骤例句", "Utterances in this step")} options={utteranceOptions} selected={step.utteranceRefs} emptyLabel={t("暂无例句", "No utterances yet")} onChange={(ids) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.steps[index].utteranceRefs = ids; })} />
                              <ReferencePicker label={t("本步骤练习", "Exercises in this step")} options={exerciseOptions} selected={step.exerciseRefs} emptyLabel={t("暂无练习", "No exercises yet")} onChange={(ids) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.steps[index].exerciseRefs = ids; })} />
                            </div>
                            <div className="step-actions"><button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label={t("上移步骤 " + (index + 1), "Move step " + (index + 1) + " up")}><ArrowUp size={14} /></button><button type="button" onClick={() => moveStep(index, 1)} disabled={index === flow.length - 1} aria-label={t("下移步骤 " + (index + 1), "Move step " + (index + 1) + " down")}><ArrowDown size={14} /></button><button type="button" className="danger" onClick={() => removeStep(index)} disabled={flow.length <= 1} aria-label={t("删除步骤 " + (index + 1), "Delete step " + (index + 1))}><Trash2 size={14} /></button></div>
                          </div></details>
                        ))}
                      </div>
                    </div>
  );
}
