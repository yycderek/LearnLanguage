"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bot,
  Braces,
  Check,
  ChevronRight,
  Clock3,
  FileJson,
  GraduationCap,
  KeyRound,
  Languages,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { LearningPlayer } from "@/app/learning-player";
import { LearningDashboard } from "@/app/learning-dashboard";
import { ReviewPlayer } from "@/app/review-player";
import { testAiConnection, type AiProvider, type AiSettings } from "@/lib/ai";
import {
  displayText,
  forkPublishedCourse,
  publishCourseDraft,
  sampleCourse,
  validateCourse,
  type CoursePack,
  type ExerciseKind,
  type ImportIssue,
  type PublishedCoursePack,
} from "@/lib/course";
import {
  builtInLanguagePacks,
  languageName,
  validateLanguagePack,
  type LanguageDirection,
  type LanguagePack,
} from "@/lib/language-pack";
import {
  courseLearningPercent,
  createCourseLearningRecord,
  normalizeCourseLearningRecord,
  reviewsDue,
  startLearning,
  updateCourseLearningRecord,
  type CourseLearningRecord,
  type LearningProgress,
  type ReviewTask,
} from "@/lib/learning";

type HistoryItem = {
  draftId: string;
  revision: number;
  title: string;
  languageId: string;
  updatedAt: string;
  payload: string;
};

type EditorSection = "overview" | "knowledge" | "utterances" | "exercises" | "flow";
type LanguageForm = {
  id: string;
  zhName: string;
  nativeName: string;
  accent: string;
  scriptCode: string;
  direction: LanguageDirection;
};

const DRAFTS_STORAGE_KEY = "learn-language-drafts-v1";
const AI_STORAGE_KEY = "learn-language-ai-settings-v1";
const AI_SESSION_KEY = "learn-language-ai-key-session-v1";
const LANGUAGE_PACKS_STORAGE_KEY = "learn-language-packs-v1";
const LEGACY_LEARNING_PROGRESS_STORAGE_KEY = "learn-language-progress-v1";
const LEARNING_RECORDS_STORAGE_KEY = "learn-language-progress-v2";

const defaultAiSettings: AiSettings = { provider: "openai", model: "", endpoint: "", apiKey: "" };
const defaultLanguageForm: LanguageForm = {
  id: "",
  zhName: "",
  nativeName: "",
  accent: "Aa",
  scriptCode: "Latn",
  direction: "ltr",
};

const providerLabels: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  compatible: "OpenAI 兼容 / 本地模型",
};

const sectionLabels: Array<[EditorSection, string]> = [
  ["overview", "基本信息"],
  ["knowledge", "知识点"],
  ["utterances", "例句"],
  ["exercises", "练习"],
  ["flow", "课节流程"],
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function cloneCourse(course: CoursePack): CoursePack {
  return JSON.parse(JSON.stringify(course)) as CoursePack;
}

function uniqueId(prefix: string, values: string[]) {
  let index = values.length + 1;
  while (values.includes(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function splitRefs(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function aiIsReady(settings: AiSettings) {
  return Boolean(settings.model.trim() && (settings.provider === "compatible" ? settings.endpoint.trim() : settings.apiKey.trim()));
}

export function CourseStudio() {
  const [language, setLanguage] = useState("ja");
  const [languagePacks, setLanguagePacks] = useState<LanguagePack[]>(builtInLanguagePacks);
  const [source, setSource] = useState(() => JSON.stringify(sampleCourse("ja"), null, 2));
  const [course, setCourse] = useState<CoursePack>(() => sampleCourse("ja"));
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [draftId, setDraftId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState("示例课程已载入，可以直接编辑");
  const [editorMode, setEditorMode] = useState<"visual" | "json">("visual");
  const [editorSection, setEditorSection] = useState<EditorSection>("overview");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettings>(defaultAiSettings);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiConnection, setAiConnection] = useState<{ state: "idle" | "testing" | "success" | "error"; message?: string }>({ state: "idle" });
  const [languageOpen, setLanguageOpen] = useState(false);
  const [languageMode, setLanguageMode] = useState<"quick" | "import">("quick");
  const [languageForm, setLanguageForm] = useState<LanguageForm>(defaultLanguageForm);
  const [languageJson, setLanguageJson] = useState("");
  const [languageError, setLanguageError] = useState("");
  const [recordsByCourse, setRecordsByCourse] = useState<Record<string, CourseLearningRecord>>({});
  const [previewRecordsByCourse, setPreviewRecordsByCourse] = useState<Record<string, CourseLearningRecord>>({});
  const [learningContext, setLearningContext] = useState<"learn" | "preview">("learn");
  const [learningView, setLearningView] = useState<"studio" | "dashboard" | "lesson" | "review">("studio");
  const [selectedLessonId, setSelectedLessonId] = useState<string>();
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([]);

  const stats = useMemo(
    () => [
      [course.lessons.length, "课节"],
      [course.knowledge.length, "知识点"],
      [course.exercises.length, "练习"],
      [course.lessons.reduce((count, lesson) => count + lesson.steps.length, 0), "学习步骤"],
    ],
    [course],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedHistory = readJson<HistoryItem[]>(DRAFTS_STORAGE_KEY, []);
      const storedAi = readJson<AiSettings>(AI_STORAGE_KEY, defaultAiSettings);
      const legacyKey = storedAi.apiKey?.trim() ?? "";
      const sessionKey = sessionStorage.getItem(AI_SESSION_KEY) ?? legacyKey;
      const hydratedAi = { ...defaultAiSettings, ...storedAi, apiKey: sessionKey };
      const customPacks = readJson<LanguagePack[]>(LANGUAGE_PACKS_STORAGE_KEY, []);
      const storedRecords = readJson<Record<string, unknown>>(LEARNING_RECORDS_STORAGE_KEY, {});
      const legacyProgress = readJson<Record<string, unknown>>(LEGACY_LEARNING_PROGRESS_STORAGE_KEY, {});
      const normalizedRecords: Record<string, CourseLearningRecord> = {};
      for (const [courseId, value] of Object.entries({ ...legacyProgress, ...storedRecords })) {
        const normalized = normalizeCourseLearningRecord(value);
        if (normalized) normalizedRecords[courseId] = normalized;
      }
      setHistory(storedHistory);
      setAiSettings(hydratedAi);
      setAiConfigured(aiIsReady(hydratedAi));
      if (legacyKey) {
        sessionStorage.setItem(AI_SESSION_KEY, legacyKey);
        localStorage.setItem(AI_STORAGE_KEY, JSON.stringify({ ...hydratedAi, apiKey: "" }));
      }
      setLanguagePacks([...builtInLanguagePacks, ...customPacks.filter((pack) => !builtInLanguagePacks.some((item) => item.id === pack.id))]);
      setRecordsByCourse(normalizedRecords);
      if (Object.keys(normalizedRecords).length > 0) localStorage.setItem(LEARNING_RECORDS_STORAGE_KEY, JSON.stringify(normalizedRecords));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function commitCourse(next: CoursePack, message = "可视化修改已同步到课程包") {
    setCourse(next);
    setSource(JSON.stringify(next, null, 2));
    setIssues([]);
    setNotice(message);
  }

  function editCourse(change: (next: CoursePack) => void) {
    if (course.manifest.status === "published") {
      setNotice("已发布课程不可修改；请先创建派生草稿");
      return;
    }
    const next = cloneCourse(course);
    change(next);
    commitCourse(next);
  }

  function loadLanguage(pack: LanguagePack) {
    const next = sampleCourse(pack.id, languageName(pack));
    setLanguage(pack.id);
    setEditorSection("overview");
    setDraftId(undefined);
    commitCourse(next, `${languageName(pack)}示例已载入`);
  }

  function importSource() {
    const result = validateCourse(source);
    setIssues(result.issues);
    if (result.course) {
      setCourse(result.course);
      setLanguage(result.course.manifest.languageId);
      setNotice("课程包校验通过，预览已更新");
    } else {
      setNotice(`发现 ${result.issues.length} 个需要修正的问题`);
    }
  }

  function saveDraft() {
    if (course.manifest.status === "published") {
      setNotice("已发布课程不可覆盖保存；请创建派生草稿");
      return;
    }
    const result = validateCourse(source);
    if (!result.course) {
      setIssues(result.issues);
      setNotice("请先修正课程包问题");
      return;
    }
    setSaving(true);
    const nextDraftId = draftId ?? crypto.randomUUID();
    const latestRevision = history
      .filter((item) => item.draftId === nextDraftId)
      .reduce((max, item) => Math.max(max, item.revision), 0);
    const local: HistoryItem = {
      draftId: nextDraftId,
      revision: latestRevision + 1,
      title: displayText(result.course.manifest.title),
      languageId: result.course.manifest.languageId,
      updatedAt: new Date().toISOString(),
      payload: source,
    };
    const nextHistory = [local, ...history].slice(0, 24);
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(nextHistory));
    setDraftId(nextDraftId);
    setHistory(nextHistory);
    setNotice(`已保存到当前设备 · 修订 ${local.revision}`);
    setSaving(false);
  }

  async function publishCurrentCourse() {
    const result = validateCourse(source);
    setIssues(result.issues);
    if (!result.course) {
      setNotice("发布前请先修正课程包问题");
      return;
    }
    if (result.course.manifest.status === "published") {
      setNotice("当前课程已经发布");
      return;
    }
    setPublishing(true);
    try {
      const published = await publishCourseDraft(result.course);
      commitCourse(published, `已发布不可变版本 · ${published.manifest.contentHash.slice(0, 22)}…`);
      setDraftId(undefined);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "课程发布失败");
    } finally {
      setPublishing(false);
    }
  }

  function forkCurrentCourse() {
    if (course.manifest.status !== "published") return;
    const draft = forkPublishedCourse(course as PublishedCoursePack);
    commitCourse(draft, "已从发布版本创建新的私人草稿");
    setDraftId(undefined);
    setEditorSection("overview");
  }

  function restore(item: HistoryItem) {
    const parsed = validateCourse(item.payload);
    if (!parsed.course) return;
    setSource(item.payload);
    setCourse(parsed.course);
    setLanguage(parsed.course.manifest.languageId);
    setDraftId(item.draftId);
    setIssues([]);
    setNotice(`已恢复修订 ${item.revision}`);
  }

  function saveAiSettings() {
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify({ ...aiSettings, apiKey: "" }));
    if (aiSettings.apiKey.trim()) sessionStorage.setItem(AI_SESSION_KEY, aiSettings.apiKey.trim());
    else sessionStorage.removeItem(AI_SESSION_KEY);
    setAiConfigured(aiIsReady(aiSettings));
    setAiOpen(false);
    setNotice(`${providerLabels[aiSettings.provider]} 配置已保存；密钥将在关闭标签页后清除`);
  }

  async function testCurrentAi() {
    setAiConnection({ state: "testing", message: "正在连接所选 AI 服务……" });
    try {
      await testAiConnection(aiSettings);
      setAiConnection({ state: "success", message: "连接成功，可以用于文本学习反馈。" });
    } catch (error) {
      setAiConnection({ state: "error", message: error instanceof Error ? error.message : "连接失败，请检查配置。" });
    }
  }

  function storeCourseRecord(next: CourseLearningRecord) {
    if (learningContext === "preview") {
      setPreviewRecordsByCourse((current) => ({ ...current, [next.courseId]: next }));
      return;
    }
    setRecordsByCourse((current) => {
      const updated = { ...current, [next.courseId]: next };
      localStorage.setItem(LEARNING_RECORDS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function storeLessonProgress(progress: LearningProgress) {
    const activeRecords = learningContext === "preview" ? previewRecordsByCourse : recordsByCourse;
    const current = activeRecords[progress.courseId] ?? createCourseLearningRecord(course);
    storeCourseRecord(updateCourseLearningRecord(current, progress));
  }

  function openLesson(lessonId: string, restart = false) {
    const activeRecords = learningContext === "preview" ? previewRecordsByCourse : recordsByCourse;
    const record = activeRecords[course.manifest.id] ?? createCourseLearningRecord(course);
    const existing = record.lessonProgress[lessonId];
    const lesson = course.lessons.find((item) => item.id === lessonId);
    const compatible = !restart
      && existing?.courseVersion === course.manifest.version
      && (existing.status === "completed" || lesson?.steps.some((step) => step.id === existing.currentStepId));
    const progress = compatible ? existing : startLearning(course, lessonId);
    if (progress !== existing) storeCourseRecord(updateCourseLearningRecord(record, progress));
    setSelectedLessonId(lessonId);
    setLearningView("lesson");
  }

  function openReview(tasks: ReviewTask[]) {
    setReviewTasks(tasks);
    setLearningView("review");
  }

  function enterLearningSpace() {
    setLearningContext("learn");
    setLearningView("dashboard");
  }

  function enterStudioPreview() {
    setLearningContext("preview");
    setLearningView("dashboard");
  }

  function addKnowledge() {
    editCourse((next) => next.knowledge.push({
      id: uniqueId("knowledge", next.knowledge.map((item) => item.id)),
      kind: "lexeme",
      form: "",
      meaning: { "zh-CN": "" },
    }));
  }

  function removeKnowledge(index: number) {
    editCourse((next) => {
      const [removed] = next.knowledge.splice(index, 1);
      if (!removed) return;
      next.utterances.forEach((item) => { item.knowledgeRefs = item.knowledgeRefs.filter((id) => id !== removed.id); });
      next.exercises.forEach((item) => { item.knowledgeRefs = item.knowledgeRefs.filter((id) => id !== removed.id); });
      next.lessons.forEach((lesson) => lesson.steps.forEach((step) => { step.knowledgeRefs = step.knowledgeRefs.filter((id) => id !== removed.id); }));
    });
  }

  function addUtterance() {
    editCourse((next) => next.utterances.push({
      id: uniqueId("utterance", next.utterances.map((item) => item.id)),
      text: "",
      translation: { "zh-CN": "" },
      knowledgeRefs: [],
    }));
  }

  function removeUtterance(index: number) {
    editCourse((next) => {
      const [removed] = next.utterances.splice(index, 1);
      if (!removed) return;
      next.exercises.forEach((item) => { item.utteranceRefs = item.utteranceRefs.filter((id) => id !== removed.id); });
      next.lessons.forEach((lesson) => lesson.steps.forEach((step) => { step.utteranceRefs = step.utteranceRefs.filter((id) => id !== removed.id); }));
    });
  }

  function addExercise() {
    editCourse((next) => next.exercises.push({
      id: uniqueId("exercise", next.exercises.map((item) => item.id)),
      kind: "role-play",
      prompt: { "zh-CN": "" },
      knowledgeRefs: [],
      utteranceRefs: [],
    }));
  }

  function removeExercise(index: number) {
    editCourse((next) => {
      const [removed] = next.exercises.splice(index, 1);
      if (!removed) return;
      next.lessons.forEach((lesson) => lesson.steps.forEach((step) => { step.exerciseRefs = step.exerciseRefs.filter((id) => id !== removed.id); }));
    });
  }

  function addStep() {
    editCourse((next) => {
      const lesson = next.lessons[0];
      if (!lesson) return;
      const id = uniqueId("step", lesson.steps.map((item) => item.id));
      const previous = lesson.steps.at(-1);
      if (previous) previous.next = [id];
      lesson.steps.push({ id, phase: "supported-input", title: { "zh-CN": "新学习步骤" }, supportLevel: "full", knowledgeRefs: [], utteranceRefs: [], exerciseRefs: [], next: [] });
      if (!lesson.entryStepId) lesson.entryStepId = id;
    });
  }

  function removeStep(index: number) {
    editCourse((next) => {
      const lesson = next.lessons[0];
      const [removed] = lesson.steps.splice(index, 1);
      if (!removed) return;
      lesson.steps.forEach((step) => { step.next = step.next.filter((id) => id !== removed.id); });
      lesson.steps.forEach((step, stepIndex) => { step.next = stepIndex < lesson.steps.length - 1 ? [lesson.steps[stepIndex + 1].id] : []; });
      lesson.entryStepId = lesson.steps[0]?.id ?? "";
    });
  }

  function saveLanguagePack() {
    let json = languageJson;
    if (languageMode === "quick") {
      json = JSON.stringify({
        schemaVersion: 1,
        id: languageForm.id.trim(),
        name: { "zh-CN": languageForm.zhName.trim(), native: languageForm.nativeName.trim() || languageForm.zhName.trim() },
        accent: languageForm.accent.trim(),
        scripts: [{ code: languageForm.scriptCode.trim(), name: { "zh-CN": languageForm.scriptCode.trim() }, direction: languageForm.direction, primary: true }],
        readingSystems: [],
        segmentation: { strategy: languageForm.scriptCode === "Latn" ? "whitespace" : "grapheme" },
      });
    }
    const result = validateLanguagePack(json);
    if (!result.pack) {
      setLanguageError(result.error ?? "Language Pack 无效");
      return;
    }
    const custom = languagePacks
      .filter((pack) => !builtInLanguagePacks.some((builtIn) => builtIn.id === pack.id) && pack.id !== result.pack?.id);
    const nextCustom = [...custom, result.pack];
    localStorage.setItem(LANGUAGE_PACKS_STORAGE_KEY, JSON.stringify(nextCustom));
    setLanguagePacks([...builtInLanguagePacks, ...nextCustom]);
    setLanguageOpen(false);
    setLanguageError("");
    setLanguageForm(defaultLanguageForm);
    setLanguageJson("");
    loadLanguage(result.pack);
    setNotice(`${languageName(result.pack)} Language Pack 已保存并创建入门课程`);
  }

  const currentLanguage = languagePacks.find((item) => item.id === language);
  const flow = course.lessons[0]?.steps ?? [];
  const activeRecords = learningContext === "preview" ? previewRecordsByCourse : recordsByCourse;
  const currentRecord = activeRecords[course.manifest.id];
  const currentPercent = courseLearningPercent(course, currentRecord);
  const dueReviewCount = currentRecord ? reviewsDue(currentRecord).length : 0;
  const ongoingLesson = course.lessons.find((lesson) => currentRecord?.lessonProgress[lesson.id]?.status === "active");
  const selectedProgress = selectedLessonId ? currentRecord?.lessonProgress[selectedLessonId] : undefined;

  if (learningView === "dashboard") {
    return <LearningDashboard course={course} record={currentRecord} preview={learningContext === "preview"} onBack={() => setLearningView("studio")} onStartLesson={openLesson} onStartReview={openReview} />;
  }
  if (learningView === "lesson" && selectedProgress) {
    return <LearningPlayer course={course} initialProgress={selectedProgress} preview={learningContext === "preview"} aiSettings={aiConfigured ? aiSettings : undefined} onProgress={storeLessonProgress} onExit={() => setLearningView("dashboard")} />;
  }
  if (learningView === "review" && currentRecord) {
    return <ReviewPlayer course={course} initialRecord={currentRecord} tasks={reviewTasks} preview={learningContext === "preview"} onRecord={storeCourseRecord} onExit={() => setLearningView("dashboard")} />;
  }

  return (
    <main className="studio-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Languages size={20} /></div>
          <div><strong>LearnLanguage</strong><span>课程工作台</span></div>
        </div>
        <nav className="side-nav" aria-label="工作台导航">
          <button className="nav-item active"><BookOpen size={18} /><span>课程编辑器</span></button>
          <button className="nav-item" onClick={enterLearningSpace}><GraduationCap size={18} /><span>学习空间</span>{dueReviewCount > 0 && <em>{dueReviewCount}</em>}</button>
          <button className="nav-item"><Clock3 size={18} /><span>本地草稿</span><em>{history.length}</em></button>
        </nav>
        <div className="section-label">目标语言</div>
        <div className="language-list">
          {languagePacks.map((item) => (
            <button key={item.id} className={`language-button ${language === item.id ? "selected" : ""}`} onClick={() => loadLanguage(item)}>
              <span className="language-glyph">{item.accent}</span>
              <span><strong>{languageName(item, "native")}</strong><small>{languageName(item)}</small></span>
              {language === item.id && <Check size={16} />}
            </button>
          ))}
          <button className="language-button add-language" onClick={() => setLanguageOpen(true)}>
            <Plus size={17} />
            <span><strong>添加语言</strong><small>创建或导入 Language Pack</small></span>
          </button>
        </div>
        <div className="sidebar-note">
          <Sparkles size={16} />
          <p>语言只是内容包。学习流程、掌握度与复习机制由同一套引擎驱动。</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <div className="eyebrow"><span className="status-dot" />无需登录 · 设备本地</div>
            <h1>{displayText(course.manifest.title)}</h1>
          </div>
          <div className="top-actions">
            <button className="ai-button" onClick={() => setAiOpen(true)}><Bot size={17} />AI 设置<span className={`ai-state ${aiConfigured ? "configured" : ""}`} /></button>
            {course.manifest.status === "published" ? <button className="save-button" onClick={forkCurrentCourse}><RotateCcw size={17} />创建派生草稿</button> : <><button className="outline-button" onClick={publishCurrentCourse} disabled={publishing}>{publishing ? "正在发布…" : "校验并发布"}</button><button className="save-button" onClick={saveDraft} disabled={saving}><Save size={17} />{saving ? "正在保存…" : "保存草稿"}</button></>}
          </div>
        </header>

        <div className="status-strip">
          <div><ShieldCheck size={16} /><span>{notice}</span></div>
          <span className="schema-pill">Schema v{course.schemaVersion}</span>
        </div>

        <div className="work-grid">
          <section className="editor-panel panel">
            <div className="panel-heading editor-heading">
              <div><span className="kicker">COURSE PACK</span><h2>课程内容编辑</h2></div>
              <div className="mode-switch" aria-label="编辑方式">
                <button className={editorMode === "visual" ? "active" : ""} onClick={() => setEditorMode("visual")}><BookOpen size={14} />可视化</button>
                <button className={editorMode === "json" ? "active" : ""} onClick={() => setEditorMode("json")}><Braces size={14} />JSON</button>
              </div>
            </div>

            {editorMode === "visual" ? (
              <>
                <div className="section-tabs">
                  {sectionLabels.map(([id, label]) => <button key={id} className={editorSection === id ? "active" : ""} onClick={() => setEditorSection(id)}>{label}</button>)}
                </div>
                <div className="visual-editor">
                  {editorSection === "overview" && (
                    <div className="form-section">
                      <div className="section-intro"><div><h3>课程基本信息</h3><p>这些信息会显示在课程封面和目录中。</p></div></div>
                      <div className="form-grid two-column">
                        <label><span>课程 ID</span><input value={course.manifest.id} onChange={(event) => editCourse((next) => { next.manifest.id = event.target.value; })} /></label>
                        <label><span>版本</span><input value={course.manifest.version} onChange={(event) => editCourse((next) => { next.manifest.version = event.target.value; })} /></label>
                        <label className="wide"><span>课程名称</span><input value={displayText(course.manifest.title)} onChange={(event) => editCourse((next) => { next.manifest.title["zh-CN"] = event.target.value; })} /></label>
                        <label className="wide"><span>课程简介</span><textarea value={displayText(course.manifest.description)} onChange={(event) => editCourse((next) => { next.manifest.description["zh-CN"] = event.target.value; })} /></label>
                        <label><span>状态</span><input value={course.manifest.status === "published" ? "已发布 · 只读" : "草稿"} readOnly /></label>
                        <label><span>作者显示名</span><input value={course.manifest.author.displayName} onChange={(event) => editCourse((next) => { next.manifest.author.displayName = event.target.value; })} /></label>
                      </div>
                    </div>
                  )}

                  {editorSection === "knowledge" && (
                    <div className="form-section">
                      <div className="section-intro"><div><h3>知识点</h3><p>维护词汇、语法、字符或文化知识。</p></div><button className="outline-button" onClick={addKnowledge}><Plus size={15} />添加知识点</button></div>
                      <div className="item-stack">
                        {course.knowledge.map((item, index) => (
                          <article className="edit-card" key={`${item.id}-${index}`}>
                            <div className="edit-card-heading"><span>知识点 {index + 1}</span><button onClick={() => removeKnowledge(index)} aria-label={`删除知识点 ${index + 1}`}><Trash2 size={15} /></button></div>
                            <div className="form-grid three-column">
                              <label><span>ID</span><input value={item.id} onChange={(event) => editCourse((next) => {
                                const previous = next.knowledge[index].id;
                                const current = event.target.value;
                                next.knowledge[index].id = current;
                                next.utterances.forEach((entry) => { entry.knowledgeRefs = entry.knowledgeRefs.map((id) => id === previous ? current : id); });
                                next.exercises.forEach((entry) => { entry.knowledgeRefs = entry.knowledgeRefs.map((id) => id === previous ? current : id); });
                                next.lessons.forEach((lesson) => lesson.steps.forEach((step) => { step.knowledgeRefs = step.knowledgeRefs.map((id) => id === previous ? current : id); }));
                              })} /></label>
                              <label><span>类型</span><select value={item.kind} onChange={(event) => editCourse((next) => { next.knowledge[index].kind = event.target.value as typeof item.kind; })}><option value="lexeme">词汇</option><option value="grammar">语法</option><option value="script">文字系统</option><option value="pragmatics">语用文化</option></select></label>
                              <label><span>目标语形式</span><input value={item.form} dir={currentLanguage?.scripts[0]?.direction ?? "ltr"} onChange={(event) => editCourse((next) => { next.knowledge[index].form = event.target.value; })} /></label>
                              <label className="wide"><span>中文释义</span><input value={displayText(item.meaning)} onChange={(event) => editCourse((next) => { next.knowledge[index].meaning["zh-CN"] = event.target.value; })} /></label>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {editorSection === "utterances" && (
                    <div className="form-section">
                      <div className="section-intro"><div><h3>例句与表达</h3><p>添加学习者会听到、读到和练习的自然表达。</p></div><button className="outline-button" onClick={addUtterance}><Plus size={15} />添加例句</button></div>
                      <div className="item-stack">
                        {course.utterances.map((item, index) => (
                          <article className="edit-card" key={`${item.id}-${index}`}>
                            <div className="edit-card-heading"><span>例句 {index + 1}</span><button onClick={() => removeUtterance(index)} aria-label={`删除例句 ${index + 1}`}><Trash2 size={15} /></button></div>
                            <div className="form-grid two-column">
                              <label><span>ID</span><input value={item.id} onChange={(event) => editCourse((next) => {
                                const previous = next.utterances[index].id;
                                const current = event.target.value;
                                next.utterances[index].id = current;
                                next.exercises.forEach((entry) => { entry.utteranceRefs = entry.utteranceRefs.map((id) => id === previous ? current : id); });
                                next.lessons.forEach((lesson) => lesson.steps.forEach((step) => { step.utteranceRefs = step.utteranceRefs.map((id) => id === previous ? current : id); }));
                              })} /></label>
                              <label><span>关联知识点（逗号分隔）</span><input value={item.knowledgeRefs.join(", ")} onChange={(event) => editCourse((next) => { next.utterances[index].knowledgeRefs = splitRefs(event.target.value); })} /></label>
                              <label className="wide"><span>目标语例句</span><textarea dir={currentLanguage?.scripts[0]?.direction ?? "ltr"} value={item.text} onChange={(event) => editCourse((next) => { next.utterances[index].text = event.target.value; })} /></label>
                              <label className="wide"><span>中文翻译</span><input value={displayText(item.translation)} onChange={(event) => editCourse((next) => { next.utterances[index].translation = { ...(next.utterances[index].translation ?? {}), "zh-CN": event.target.value }; })} /></label>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {editorSection === "exercises" && (
                    <div className="form-section">
                      <div className="section-intro"><div><h3>练习</h3><p>定义理解、产出和角色扮演任务。</p></div><button className="outline-button" onClick={addExercise}><Plus size={15} />添加练习</button></div>
                      <div className="item-stack">
                        {course.exercises.map((item, index) => (
                          <article className="edit-card" key={`${item.id}-${index}`}>
                            <div className="edit-card-heading"><span>练习 {index + 1}</span><button onClick={() => removeExercise(index)} aria-label={`删除练习 ${index + 1}`}><Trash2 size={15} /></button></div>
                            <div className="form-grid two-column">
                              <label><span>ID</span><input value={item.id} onChange={(event) => editCourse((next) => {
                                const previous = next.exercises[index].id;
                                const current = event.target.value;
                                next.exercises[index].id = current;
                                next.lessons.forEach((lesson) => lesson.steps.forEach((step) => { step.exerciseRefs = step.exerciseRefs.map((id) => id === previous ? current : id); }));
                              })} /></label>
                              <label><span>类型</span><select value={item.kind} onChange={(event) => editCourse((next) => { next.exercises[index].kind = event.target.value as ExerciseKind; })}><option value="single-choice">单选理解</option><option value="role-play">角色扮演</option><option value="ordering">排序</option><option value="free-response">自由回答</option></select></label>
                              <label className="wide"><span>任务提示</span><textarea value={displayText(item.prompt)} onChange={(event) => editCourse((next) => { next.exercises[index].prompt["zh-CN"] = event.target.value; })} /></label>
                              <label><span>关联知识点（逗号分隔）</span><input value={item.knowledgeRefs.join(", ")} onChange={(event) => editCourse((next) => { next.exercises[index].knowledgeRefs = splitRefs(event.target.value); })} /></label>
                              <label><span>关联例句（逗号分隔）</span><input value={item.utteranceRefs.join(", ")} onChange={(event) => editCourse((next) => { next.exercises[index].utteranceRefs = splitRefs(event.target.value); })} /></label>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {editorSection === "flow" && (
                    <div className="form-section">
                      <div className="section-intro"><div><h3>课节与学习流程</h3><p>调整第一个课节的标题和逐步学习路径。</p></div><button className="outline-button" onClick={addStep}><Plus size={15} />添加步骤</button></div>
                      {course.lessons[0] && <label className="lesson-title-field"><span>课节名称</span><input value={displayText(course.lessons[0].title)} onChange={(event) => editCourse((next) => { next.lessons[0].title["zh-CN"] = event.target.value; })} /></label>}
                      <div className="item-stack compact">
                        {flow.map((step, index) => (
                          <article className="edit-card flow-edit-card" key={`${step.id}-${index}`}>
                            <div className="step-number">{String(index + 1).padStart(2, "0")}</div>
                            <div className="form-grid three-column">
                              <label><span>ID</span><input value={step.id} onChange={(event) => editCourse((next) => {
                                const lesson = next.lessons[0];
                                const previous = lesson.steps[index].id;
                                const current = event.target.value;
                                lesson.steps[index].id = current;
                                if (lesson.entryStepId === previous) lesson.entryStepId = current;
                                lesson.steps.forEach((entry) => { entry.next = entry.next.map((id) => id === previous ? current : id); });
                              })} /></label>
                              <label><span>阶段</span><select value={step.phase} onChange={(event) => editCourse((next) => { next.lessons[0].steps[index].phase = event.target.value; })}><option value="diagnostic">诊断</option><option value="preteach">预教</option><option value="supported-input">支持性输入</option><option value="comprehension">独立理解</option><option value="guided-output">引导输出</option><option value="independent-task">独立任务</option><option value="feedback-retry">反馈重试</option><option value="delayed-transfer">延迟迁移</option></select></label>
                              <label><span>显示标题</span><input value={displayText(step.title)} onChange={(event) => editCourse((next) => { next.lessons[0].steps[index].title["zh-CN"] = event.target.value; })} /></label>
                            </div>
                            <button className="step-delete" onClick={() => removeStep(index)} aria-label={`删除步骤 ${index + 1}`}><Trash2 size={15} /></button>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="editor-toolbar"><div><FileJson size={16} /><span>{course.manifest.id}.json</span></div><span>{source.split("\n").length} 行</span></div>
                <textarea className="json-source" aria-label="课程包 JSON" value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} />
                <div className="editor-footer"><button className="primary-button" onClick={importSource}><Braces size={16} />校验并预览</button><span>支持任何符合 Course Pack v2 的语言内容</span></div>
              </>
            )}

            {issues.length > 0 && (
              <div className="issue-box">
                <div className="issue-title"><TriangleAlert size={17} /><strong>{issues.length} 个问题</strong></div>
                {issues.slice(0, 5).map((issue, index) => <div className="issue-row" key={`${issue.path}-${index}`}><span>{issue.stage}</span><code>{issue.path}</code><p>{issue.message}</p></div>)}
              </div>
            )}
          </section>

          <aside className="preview-column">
            <section className="course-card panel">
              <div className="course-cover"><span>{currentLanguage?.accent ?? language.slice(0, 2)}</span><div className="cover-orbit orbit-one" /><div className="cover-orbit orbit-two" /></div>
              <div className="course-info">
                <div className="course-meta"><span>{currentLanguage ? languageName(currentLanguage, "native") : language}</span><span>·</span><span>{course.manifest.status}</span></div>
                <h2>{displayText(course.manifest.title)}</h2><p>{displayText(course.manifest.description)}</p>
                <div className="stat-grid">{stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
                <div className="learning-launch">
                  {currentRecord && <div className="mini-progress"><span><i style={{ width: `${currentPercent}%` }} /></span><small>{ongoingLesson ? `正在学习：${displayText(ongoingLesson.title)}` : `课程进度 ${currentPercent}%`}{dueReviewCount > 0 ? ` · ${dueReviewCount} 个待复习` : ""}</small></div>}
                  <button onClick={enterStudioPreview}><Play size={15} fill="currentColor" />预览学习流程</button>
                  <small>预览使用临时档案，不会写入真实学习进度。</small>
                </div>
              </div>
            </section>
            <section className="flow-panel panel">
              <div className="panel-heading"><div><span className="kicker">LEARNING FLOW</span><h2>课程流程预览</h2></div><span className="count-badge">{flow.length} 步</span></div>
              <div className="flow-list">{flow.map((step, index) => <div className="flow-step" key={`${step.id}-${index}`}><div className="step-index">{String(index + 1).padStart(2, "0")}</div><div><strong>{displayText(step.title)}</strong><span>{step.phase}</span></div>{index < flow.length - 1 && <ChevronRight size={15} />}</div>)}</div>
            </section>
            <section className="history-panel panel">
              <div className="panel-heading"><div><span className="kicker">VERSION HISTORY</span><h2>当前设备的修订</h2></div></div>
              {history.length === 0 ? <div className="empty-history"><Clock3 size={20} /><p>保存草稿后，修订记录会保留在这个浏览器中。</p></div> : <div className="history-list">{history.slice(0, 4).map((item) => <button key={`${item.draftId}-${item.revision}`} onClick={() => restore(item)}><span className="revision">v{item.revision}</span><span><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></span><RotateCcw size={14} /></button>)}</div>}
            </section>
          </aside>
        </div>
      </section>

      {languageOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="ai-dialog language-dialog" role="dialog" aria-modal="true" aria-labelledby="language-dialog-title">
            <div className="dialog-heading"><div className="dialog-icon"><Languages size={20} /></div><div><span className="kicker">LANGUAGE PACK</span><h2 id="language-dialog-title">添加目标语言</h2></div><button className="icon-button" onClick={() => setLanguageOpen(false)} aria-label="关闭添加语言"><X size={18} /></button></div>
            <div className="dialog-tabs"><button className={languageMode === "quick" ? "active" : ""} onClick={() => { setLanguageMode("quick"); setLanguageError(""); }}>快速创建</button><button className={languageMode === "import" ? "active" : ""} onClick={() => { setLanguageMode("import"); setLanguageError(""); }}><Upload size={14} />导入 JSON</button></div>
            <div className="dialog-body">
              {languageMode === "quick" ? (
                <div className="form-grid two-column">
                  <label><span>语言 ID</span><input value={languageForm.id} onChange={(event) => setLanguageForm((current) => ({ ...current, id: event.target.value }))} placeholder="例如：fr 或 ar-EG" /></label>
                  <label><span>语言符号</span><input value={languageForm.accent} maxLength={2} onChange={(event) => setLanguageForm((current) => ({ ...current, accent: event.target.value }))} placeholder="Fr" /></label>
                  <label><span>中文名称</span><input value={languageForm.zhName} onChange={(event) => setLanguageForm((current) => ({ ...current, zhName: event.target.value }))} placeholder="例如：法语" /></label>
                  <label><span>本地名称</span><input value={languageForm.nativeName} onChange={(event) => setLanguageForm((current) => ({ ...current, nativeName: event.target.value }))} placeholder="例如：Français" /></label>
                  <label><span>书写系统代码</span><input value={languageForm.scriptCode} onChange={(event) => setLanguageForm((current) => ({ ...current, scriptCode: event.target.value }))} placeholder="Latn" /></label>
                  <label><span>书写方向</span><select value={languageForm.direction} onChange={(event) => setLanguageForm((current) => ({ ...current, direction: event.target.value as LanguageDirection }))}><option value="ltr">从左到右</option><option value="rtl">从右到左</option><option value="ttb">从上到下</option></select></label>
                </div>
              ) : (
                <label className="json-import-field"><span>Language Pack JSON</span><textarea value={languageJson} onChange={(event) => setLanguageJson(event.target.value)} placeholder={'{\n  "schemaVersion": 1,\n  "id": "fr",\n  ...\n}'} spellCheck={false} /></label>
              )}
              {languageError && <div className="language-error"><TriangleAlert size={16} />{languageError}</div>}
              <div className="privacy-note"><ShieldCheck size={17} /><p>自定义语言包只保存在当前浏览器。创建后会自动生成一份可编辑的入门课程，之后可继续补充语料。</p></div>
            </div>
            <div className="dialog-footer"><button className="text-button" onClick={() => setLanguageOpen(false)}>取消</button><button className="primary-button" onClick={saveLanguagePack}>保存并创建课程</button></div>
          </section>
        </div>
      )}

      {aiOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-dialog-title">
            <div className="dialog-heading"><div className="dialog-icon"><Settings2 size={20} /></div><div><span className="kicker">PERSONAL AI</span><h2 id="ai-dialog-title">选择你使用的 AI</h2></div><button className="icon-button" onClick={() => setAiOpen(false)} aria-label="关闭 AI 设置"><X size={18} /></button></div>
            <div className="dialog-body">
              <label><span>AI 服务商</span><select value={aiSettings.provider} onChange={(event) => setAiSettings((current) => ({ ...current, provider: event.target.value as AiProvider }))}>{Object.entries(providerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>模型 ID</span><input value={aiSettings.model} onChange={(event) => setAiSettings((current) => ({ ...current, model: event.target.value }))} placeholder="例如：你账户中可用的模型名称" /></label>
              <label><span>API 地址（可选）</span><input value={aiSettings.endpoint} onChange={(event) => setAiSettings((current) => ({ ...current, endpoint: event.target.value }))} placeholder="自定义或本地服务地址" /></label>
              <label><span>API 密钥（兼容服务可不填）</span><div className="key-input"><KeyRound size={16} /><input type="password" value={aiSettings.apiKey} onChange={(event) => { setAiSettings((current) => ({ ...current, apiKey: event.target.value })); setAiConnection({ state: "idle" }); }} placeholder="关闭当前标签页后自动清除" autoComplete="off" /></div></label>
              {aiConnection.state !== "idle" && <div className={`ai-connection-status ${aiConnection.state}`}>{aiConnection.message}</div>}
              <div className="privacy-note"><ShieldCheck size={17} /><p>服务商、模型和地址保存在当前设备；密钥只保留在当前标签页会话中。官方服务请求经过 LearnLanguage 转发但不会保存密钥，兼容服务直接连接你填写的地址。</p></div>
            </div>
            <div className="dialog-footer ai-dialog-actions"><button className="text-button" onClick={() => setAiOpen(false)}>取消</button><button className="outline-button" onClick={testCurrentAi} disabled={aiConnection.state === "testing"}>{aiConnection.state === "testing" ? "正在测试…" : "测试连接"}</button><button className="primary-button" onClick={saveAiSettings}>保存设置</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
