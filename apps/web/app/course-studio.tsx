"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
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
import { CourseLibrary } from "@/app/course-library";
import { ReviewPlayer } from "@/app/review-player";
import { testAiConnection, type AiProvider, type AiSettings } from "@/lib/ai";
import {
  getAllDeviceValues,
  getDeviceValue,
  persistLearningState,
  putCourseRecord,
  putCourseRecords,
  putDeviceValue,
  putInstalledCourse,
  putInstalledCourseVersion,
  removeInstalledCourse,
} from "@/lib/device-repository";
import {
  assessCourseUpdate,
  buildCourseLibrary,
  bundledCatalogCourses,
  upgradeCourseLearningRecord,
  type CourseLibraryEntry,
} from "@/lib/course-library";
import {
  courseFileName,
  MAX_COURSE_FILE_BYTES,
  parseCourseFile,
  serializeCourseFile,
} from "@/lib/course-file";
import {
  createLearnerBackup,
  learnerBackupFileName,
  MAX_LEARNER_BACKUP_BYTES,
  mergeLearnerRecords,
  parseLearnerBackup,
  serializeLearnerBackup,
} from "@/lib/learner-backup";
import {
  appendLesson,
  appendLessonStep,
  moveLesson,
  moveLessonStep,
  removeLesson,
  removeLessonStep,
} from "@/lib/course-authoring";
import {
  displayText,
  forkPublishedCourse,
  publishCourseDraft,
  sampleCourse,
  validateCourse,
  verifyPublishedCourseIntegrity,
  type CoursePack,
  type ExerciseKind,
  type ImportIssue,
  type LessonPhase,
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
import {
  APP_LOCALE_PREFERENCE_KEY,
  normalizeAppLocale,
  resolveStoredAppLocale,
  TEACHING_LOCALE_PREFERENCE_KEY,
  UI_LOCALE_PREFERENCE_KEY,
  uiText,
  type AppLocale,
} from "@/lib/i18n";

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
  enName: string;
  nativeName: string;
  accent: string;
  scriptCode: string;
  direction: LanguageDirection;
};

const AI_SESSION_KEY = "learn-language-ai-key-session-v1";

const defaultAiSettings: AiSettings = { provider: "openai", model: "", endpoint: "", apiKey: "" };
const defaultLanguageForm: LanguageForm = {
  id: "",
  zhName: "",
  enName: "",
  nativeName: "",
  accent: "Aa",
  scriptCode: "Latn",
  direction: "ltr",
};

const providerLabels: Record<AiProvider, [string, string]> = {
  openai: ["OpenAI", "OpenAI"],
  anthropic: ["Anthropic", "Anthropic"],
  gemini: ["Google Gemini", "Google Gemini"],
  compatible: ["OpenAI 兼容 / 本地模型", "OpenAI-compatible / local model"],
};

const sectionLabels: Array<[EditorSection, string, string]> = [
  ["overview", "基本信息", "Overview"],
  ["knowledge", "知识点", "Knowledge"],
  ["utterances", "例句", "Utterances"],
  ["exercises", "练习", "Exercises"],
  ["flow", "课节流程", "Lesson flow"],
];

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

function splitLines(value: string) {
  return value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean);
}

function localizedOptionLines(options: CoursePack["exercises"][number]["options"], locale: AppLocale) {
  return (options ?? []).map((option) => option[locale] ?? option.native ?? Object.values(option)[0] ?? "").join("\n");
}

function aiIsReady(settings: AiSettings) {
  return Boolean(settings.model.trim() && (settings.provider === "compatible" ? settings.endpoint.trim() : settings.apiKey.trim()));
}

const englishValidationMessages: Record<string, string> = {
  "JSON 格式无效": "Invalid JSON",
  "当前仅支持 schemaVersion 2": "Only schemaVersion 2 is supported",
  "缺少课程清单 manifest": "Course manifest is missing",
  "课程 ID 不能为空": "Course ID is required",
  "语言 ID 不能为空": "Language ID is required",
  "标题必须是多语言文本对象": "Title must be a localized text object",
  "已发布课程必须包含内容哈希": "Published courses must include a content hash",
  "已发布课程必须固定语言适配器版本": "Published courses must pin a language adapter version",
  "已发布课程必须明确内容许可证": "Published courses must declare a content license",
  "内容 ID 不能为空": "Content ID is required",
  "课程已经发布，不能再次覆盖发布": "This course is already published and cannot be overwritten",
  "发布前必须选择课程内容许可证": "Choose a course content license before publishing",
  "Language Pack 必须是 JSON 对象": "Language Pack must be a JSON object",
  "当前仅支持 schemaVersion 1": "Only schemaVersion 1 is supported",
  "id 只能包含字母、数字、点、下划线和连字符": "id may contain only letters, numbers, dots, underscores, and hyphens",
  "name 至少需要一个语言名称": "name must contain at least one language name",
  "scripts 至少需要一种书写系统": "scripts must contain at least one writing system",
  "书写系统需要 code 和有效的 direction": "Each writing system needs a code and valid direction",
  "segmentation.strategy 不能为空": "segmentation.strategy is required",
  "segmentation.strategy 不受支持": "segmentation.strategy is not supported",
  "请填写兼容服务的 API 地址。": "Enter the compatible service API endpoint.",
  "API 地址必须使用 HTTP 或 HTTPS。": "The API endpoint must use HTTP or HTTPS.",
  "公开网站不能直连 HTTP 地址；请使用 HTTPS 接口，或在本地运行 LearnLanguage。": "A public site cannot connect directly to an HTTP endpoint. Use HTTPS or run LearnLanguage locally.",
  "兼容服务没有返回文本内容。": "The compatible service returned no text.",
  "AI 服务没有返回文本内容。": "The AI service returned no text.",
  "请先填写模型 ID。": "Enter a model ID first.",
  "该服务商需要 API 密钥。": "This provider requires an API key.",
};

function localizeRuntimeMessage(message: string, locale: AppLocale) {
  if (locale !== "en") return message;
  if (englishValidationMessages[message]) return englishValidationMessages[message];
  if (message.startsWith("JSON 格式无效：")) return `Invalid JSON: ${message.slice("JSON 格式无效：".length)}`;
  if (message.endsWith(" 必须是数组")) return `${message.slice(0, -" 必须是数组".length)} must be an array`;
  if (message.startsWith("发现重复 ID：")) return `Duplicate ID: ${message.slice("发现重复 ID：".length)}`;
  if (message.startsWith("引用不存在：")) return `Missing reference: ${message.slice("引用不存在：".length)}`;
  if (message.startsWith("评分规则不存在：")) return `Missing rubric: ${message.slice("评分规则不存在：".length)}`;
  if (message.startsWith("入口步骤不存在：")) return `Missing entry step: ${message.slice("入口步骤不存在：".length)}`;
  if (message.startsWith("AI 服务请求失败（")) return message.replace("AI 服务请求失败", "AI service request failed");
  return message;
}

export function CourseStudio({ space = "studio" }: { space?: "learn" | "studio" }) {
  const [appLocale, setAppLocale] = useState<AppLocale>("zh-CN");
  const teachingLocale = appLocale;
  const uiLocale = appLocale;
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
  const [selectedStudioLessonId, setSelectedStudioLessonId] = useState("cafe-request");
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
  const [installedCourses, setInstalledCourses] = useState<CoursePack[]>([]);
  const [previewRecordsByCourse, setPreviewRecordsByCourse] = useState<Record<string, CourseLearningRecord>>({});
  const [learningContext, setLearningContext] = useState<"learn" | "preview">(space === "learn" ? "learn" : "preview");
  const [learningView, setLearningView] = useState<"studio" | "library" | "dashboard" | "lesson" | "review">(space === "learn" ? "library" : "studio");
  const [selectedLessonId, setSelectedLessonId] = useState<string>();
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([]);
  const t = (chinese: string, english: string) => uiText(uiLocale, chinese, english);

  const stats = useMemo(
    () => [
      [course.lessons.length, uiText(uiLocale, "课节", "Lessons")],
      [course.knowledge.length, uiText(uiLocale, "知识点", "Knowledge")],
      [course.exercises.length, uiText(uiLocale, "练习", "Exercises")],
      [course.lessons.reduce((count, lesson) => count + lesson.steps.length, 0), uiText(uiLocale, "学习步骤", "Learning steps")],
    ],
    [course, uiLocale],
  );
  const catalogCourses = useMemo(() => bundledCatalogCourses(), []);
  const learnCourses = installedCourses;
  const courseLibrary = useMemo(
    () => buildCourseLibrary(catalogCourses, installedCourses, recordsByCourse),
    [catalogCourses, installedCourses, recordsByCourse],
  );

  useEffect(() => {
    let active = true;
    async function hydrate() {
      const [storedHistory, storedAi, customPacks, storedRecords, storedInstalledCourses, storedAppLocale, storedTeachingLocale, storedUiLocale] = await Promise.all([
        getDeviceValue<HistoryItem[]>("drafts", "history"),
        getDeviceValue<AiSettings>("preferences", "ai"),
        getAllDeviceValues<LanguagePack>("languagePacks"),
        getAllDeviceValues<unknown>("courseRecords"),
        getAllDeviceValues<CoursePack>("installedCourses"),
        getDeviceValue<unknown>("preferences", APP_LOCALE_PREFERENCE_KEY),
        getDeviceValue<unknown>("preferences", TEACHING_LOCALE_PREFERENCE_KEY),
        getDeviceValue<unknown>("preferences", UI_LOCALE_PREFERENCE_KEY),
      ]);
      if (!active) return;
      const sessionKey = sessionStorage.getItem(AI_SESSION_KEY) ?? "";
      const hydratedAi = { ...defaultAiSettings, ...storedAi, apiKey: sessionKey };
      const normalizedRecords: Record<string, CourseLearningRecord> = {};
      for (const value of storedRecords) {
        const normalized = normalizeCourseLearningRecord(value);
        if (normalized) normalizedRecords[normalized.courseId] = normalized;
      }
      setHistory(storedHistory ?? []);
      setAiSettings(hydratedAi);
      setAiConfigured(aiIsReady(hydratedAi));
      setLanguagePacks([...builtInLanguagePacks, ...customPacks.filter((pack) => !builtInLanguagePacks.some((item) => item.id === pack.id))]);
      setRecordsByCourse(normalizedRecords);
      setInstalledCourses(storedInstalledCourses);
      const nextLocale = resolveStoredAppLocale(storedAppLocale, storedUiLocale, storedTeachingLocale);
      setAppLocale(nextLocale);
      if (storedAppLocale === undefined) void putDeviceValue("preferences", APP_LOCALE_PREFERENCE_KEY, nextLocale).catch(() => undefined);
      setNotice(space === "learn"
        ? uiText(nextLocale, "课程库已就绪；安装课程后即可开始学习", "The course library is ready. Install a course to begin learning.")
        : uiText(nextLocale, "示例课程已载入，可以直接编辑", "The sample course is ready to edit"));
      if (space === "learn" && storedInstalledCourses[0]) {
        setCourse(storedInstalledCourses[0]);
        setSource(JSON.stringify(storedInstalledCourses[0], null, 2));
        setLanguage(storedInstalledCourses[0].manifest.languageId);
        setLearningView("dashboard");
      }
    }
    void hydrate().catch(() => {
      const fallbackLocale = normalizeAppLocale(navigator.language.startsWith("en") ? "en" : "zh-CN");
      if (active) setNotice(uiText(fallbackLocale, "设备数据库无法打开；当前更改仅保留到页面关闭", "The device database could not be opened. Changes will last only until this page closes."));
    });
    return () => { active = false; };
  }, [space]);

  useEffect(() => {
    document.documentElement.lang = appLocale;
  }, [appLocale]);

  useEffect(() => {
    if (!course.lessons.some((lesson) => lesson.id === selectedStudioLessonId)) {
      setSelectedStudioLessonId(course.lessons[0]?.id ?? "");
    }
  }, [course.lessons, selectedStudioLessonId]);

  function changeAppLocale(locale: AppLocale) {
    setAppLocale(locale);
    void putDeviceValue("preferences", APP_LOCALE_PREFERENCE_KEY, locale).catch(() => setNotice(uiText(locale, "语言偏好保存失败", "Could not save the language preference")));
  }

  function commitCourse(next: CoursePack, message = t("可视化修改已同步到课程包", "Visual changes synced to the Course Pack")) {
    setCourse(next);
    setSource(JSON.stringify(next, null, 2));
    setIssues([]);
    setNotice(message);
  }

  function editCourse(change: (next: CoursePack) => void) {
    if (course.manifest.status === "published") {
      setNotice(t("已发布课程不可修改；请先创建派生草稿", "Published courses are read-only. Create a derived draft first."));
      return;
    }
    const next = cloneCourse(course);
    change(next);
    commitCourse(next);
  }

  function loadLanguage(pack: LanguagePack) {
    const next = sampleCourse(pack.id, languageName(pack, teachingLocale));
    setLanguage(pack.id);
    setEditorSection("overview");
    setDraftId(undefined);
    commitCourse(next, t(`${languageName(pack, "zh-CN")}示例已载入`, `${languageName(pack, "en")} sample loaded`));
  }

  function importSource() {
    const result = validateCourse(source);
    setIssues(result.issues);
    if (result.course) {
      setCourse(result.course);
      setLanguage(result.course.manifest.languageId);
      setNotice(t("课程包校验通过，预览已更新", "Course Pack validated and preview updated"));
    } else {
      setNotice(t(`发现 ${result.issues.length} 个需要修正的问题`, `${result.issues.length} issues need attention`));
    }
  }

  async function saveDraft() {
    if (course.manifest.status === "published") {
      setNotice(t("已发布课程不可覆盖保存；请创建派生草稿", "A published course cannot be overwritten. Create a derived draft."));
      return;
    }
    const result = validateCourse(source);
    if (!result.course) {
      setIssues(result.issues);
      setNotice(t("请先修正课程包问题", "Fix the Course Pack issues first"));
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
    try {
      await putDeviceValue("drafts", "history", nextHistory);
      setDraftId(nextDraftId);
      setHistory(nextHistory);
      setNotice(t(`已保存到当前设备 · 修订 ${local.revision}`, `Saved on this device · revision ${local.revision}`));
    } catch {
      setNotice(t("草稿保存失败；请检查浏览器是否允许设备存储", "Draft save failed. Check whether the browser allows device storage."));
    } finally {
      setSaving(false);
    }
  }

  async function publishCurrentCourse() {
    const result = validateCourse(source);
    setIssues(result.issues);
    if (!result.course) {
      setNotice(t("发布前请先修正课程包问题", "Fix the Course Pack issues before publishing"));
      return;
    }
    if (result.course.manifest.status === "published") {
      setNotice(t("当前课程已经发布", "This course is already published"));
      return;
    }
    setPublishing(true);
    try {
      const published = await publishCourseDraft(result.course);
      commitCourse(published, t(`已发布不可变版本 · ${published.manifest.contentHash.slice(0, 22)}…`, `Immutable version published · ${published.manifest.contentHash.slice(0, 22)}…`));
      setDraftId(undefined);
    } catch (error) {
      setNotice(error instanceof Error ? localizeRuntimeMessage(error.message, uiLocale) : t("课程发布失败", "Course publishing failed"));
    } finally {
      setPublishing(false);
    }
  }

  function forkCurrentCourse() {
    if (course.manifest.status !== "published") return;
    const draft = forkPublishedCourse(course as PublishedCoursePack);
    commitCourse(draft, t("已从发布版本创建新的私人草稿", "Created a new private draft from the published version"));
    setDraftId(undefined);
    setEditorSection("overview");
  }

  async function installCurrentCourse() {
    if (course.manifest.status !== "published") {
      setNotice(t("请先发布不可变课程版本，再安装到学习空间", "Publish an immutable course version before installing it in Learn"));
      return;
    }
    try {
      const integrity = await verifyPublishedCourseIntegrity(course);
      if (!integrity.valid) {
        setNotice(t("课程内容哈希校验失败，已拒绝安装", "Course content hash verification failed; installation was rejected"));
        return;
      }
      await putInstalledCourse(course);
      setInstalledCourses((current) => [course, ...current.filter((item) => item.manifest.id !== course.manifest.id)]);
      setNotice(t("已安装到学习空间；创作草稿和学习课程保持独立", "Installed in Learn; authoring drafts remain separate from learning courses"));
    } catch {
      setNotice(t("课程安装失败；请检查浏览器是否允许设备存储", "Course installation failed. Check whether the browser allows device storage."));
    }
  }

  async function installLibraryCourse(entry: CourseLibraryEntry) {
    try {
      const integrity = await verifyPublishedCourseIntegrity(entry.course);
      if (!integrity.valid) {
        setNotice(t("课程内容完整性校验失败，已拒绝安装", "Course integrity verification failed; installation was rejected"));
        return;
      }
      await putInstalledCourseVersion(entry.course);
      setInstalledCourses((current) => [entry.course, ...current.filter((item) => item.manifest.id !== entry.id)]);
      setNotice(t(`已安装「${displayText(entry.course.manifest.title, appLocale)}」`, `Installed “${displayText(entry.course.manifest.title, appLocale)}”`));
    } catch {
      setNotice(t("课程安装失败；请检查浏览器是否允许设备存储", "Course installation failed. Check whether device storage is available."));
    }
  }

  async function updateLibraryCourse(entry: CourseLibraryEntry) {
    const installed = entry.installedCourse;
    if (!installed) return;
    const currentRecord = recordsByCourse[entry.id];
    const assessment = assessCourseUpdate(installed, entry.course, currentRecord);
    if (!assessment.compatible) {
      setNotice(t("更新会破坏现有学习记录，已停止更新", "The update would break existing learning progress and was stopped"));
      return;
    }
    try {
      const integrity = await verifyPublishedCourseIntegrity(entry.course);
      if (!integrity.valid) {
        setNotice(t("新版本内容完整性校验失败，已停止更新", "The new version failed integrity verification; update stopped"));
        return;
      }
      const upgradedRecord = currentRecord ? upgradeCourseLearningRecord(currentRecord, entry.course) : undefined;
      await putInstalledCourseVersion(entry.course, upgradedRecord);
      setInstalledCourses((current) => [entry.course, ...current.filter((item) => item.manifest.id !== entry.id)]);
      if (upgradedRecord) setRecordsByCourse((current) => ({ ...current, [entry.id]: upgradedRecord }));
      if (course.manifest.id === entry.id) setCourse(entry.course);
      setNotice(t(`课程已更新至 v${entry.course.manifest.version}，学习进度已保留`, `Updated to v${entry.course.manifest.version}; learning progress was preserved`));
    } catch {
      setNotice(t("课程更新失败；原版本和学习记录没有改变", "Course update failed; the installed version and progress were not changed"));
    }
  }

  async function uninstallLibraryCourse(entry: CourseLibraryEntry) {
    const installed = entry.installedCourse;
    if (!installed) return;
    const title = displayText(installed.manifest.title, appLocale);
    const warning = entry.source === "user"
      ? t(`确定从学习空间移除「${title}」吗？学习记录会保留，但再次学习需要重新导入课程包。`, `Remove “${title}” from Learn? Progress is kept, but the Course Pack must be imported again to resume.`)
      : t(`确定卸载「${title}」吗？学习记录会保留，可以随时重新安装。`, `Remove “${title}”? Progress is kept and the course can be reinstalled at any time.`);
    if (!window.confirm(warning)) return;
    try {
      await removeInstalledCourse(entry.id);
      setInstalledCourses((current) => current.filter((item) => item.manifest.id !== entry.id));
      setNotice(t(`已卸载「${title}」；学习记录仍保存在当前设备`, `Removed “${title}”; learning progress remains on this device`));
    } catch {
      setNotice(t("课程卸载失败", "Course removal failed"));
    }
  }

  function openLibraryCourse(entry: CourseLibraryEntry) {
    const selected = entry.installedCourse ?? installedCourses.find((item) => item.manifest.id === entry.id);
    if (!selected) return;
    setCourse(selected);
    setSource(JSON.stringify(selected, null, 2));
    setLanguage(selected.manifest.languageId);
    setSelectedLessonId(undefined);
    setLearningContext("learn");
    setLearningView("dashboard");
  }

  async function importCourseFile(file: File) {
    if (file.size > MAX_COURSE_FILE_BYTES) {
      setNotice(t("课程文件超过 5 MB，已停止导入", "The course file is larger than 5 MB and was not imported"));
      return;
    }
    try {
      const parsed = await parseCourseFile(await file.text());
      if (!parsed.course) {
        const message = parsed.error === "not-published"
          ? t("只能直接安装已发布的不可变课程；草稿请在 Studio 中继续编辑", "Only immutable published courses can be installed directly. Continue editing drafts in Studio.")
          : parsed.error === "integrity-failed"
            ? t("课程文件内容哈希校验失败，已拒绝导入", "The course file failed its content-hash check and was rejected")
            : t(`课程文件格式无效${parsed.issues?.length ? `：${parsed.issues.length} 个问题` : ""}`, `Invalid course file${parsed.issues?.length ? `: ${parsed.issues.length} issues` : ""}`);
        setNotice(message);
        return;
      }

      const imported = parsed.course;
      const existing = installedCourses.find((item) => item.manifest.id === imported.manifest.id);
      const currentRecord = recordsByCourse[imported.manifest.id];
      if (existing) {
        const assessment = assessCourseUpdate(existing, imported, currentRecord);
        if (!assessment.newer) {
          setNotice(t("设备上已有相同或更新版本的课程", "The same or a newer course version is already installed"));
          return;
        }
        if (!assessment.compatible) {
          setNotice(t("导入版本与现有学习记录不兼容，已保留原课程", "The imported version is incompatible with existing progress; the installed course was kept"));
          return;
        }
        const upgradedRecord = currentRecord ? upgradeCourseLearningRecord(currentRecord, imported) : undefined;
        await putInstalledCourseVersion(imported, upgradedRecord);
        setInstalledCourses((current) => [imported, ...current.filter((item) => item.manifest.id !== imported.manifest.id)]);
        if (upgradedRecord) setRecordsByCourse((current) => ({ ...current, [imported.manifest.id]: upgradedRecord }));
        setNotice(t(`已从文件更新至 v${imported.manifest.version}，学习进度已保留`, `Updated from file to v${imported.manifest.version}; progress was preserved`));
        return;
      }

      await putInstalledCourseVersion(imported);
      setInstalledCourses((current) => [imported, ...current]);
      setNotice(t(`已导入并安装「${displayText(imported.manifest.title, appLocale)}」`, `Imported and installed “${displayText(imported.manifest.title, appLocale)}”`));
    } catch {
      setNotice(t("无法读取课程文件", "The course file could not be read"));
    }
  }

  function exportLibraryCourse(entry: CourseLibraryEntry) {
    const installed = entry.installedCourse ?? installedCourses.find((item) => item.manifest.id === entry.id);
    if (!installed || installed.manifest.status !== "published") {
      setNotice(t("只有已发布课程可以导出为可安装备份", "Only published courses can be exported as installable backups"));
      return;
    }
    const blob = new Blob([serializeCourseFile(installed as PublishedCoursePack)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = courseFileName(installed as PublishedCoursePack);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice(t("课程备份已导出到下载目录", "The course backup was exported to your downloads"));
  }

  function exportLearnerProfile() {
    const records = Object.values(recordsByCourse);
    if (records.length === 0) {
      setNotice(t("还没有可备份的学习记录", "There is no learning progress to back up yet"));
      return;
    }
    const backup = createLearnerBackup(records);
    const blob = new Blob([serializeLearnerBackup(backup)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = learnerBackupFileName(backup.exportedAt);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice(t(`已导出 ${records.length} 门课程的学习档案；未包含课程内容和 AI 设置`, `Exported learning records for ${records.length} courses without course content or AI settings`));
  }

  async function importLearnerProfile(file: File) {
    if (file.size > MAX_LEARNER_BACKUP_BYTES) {
      setNotice(t("学习档案超过 5 MB，已停止恢复", "The learning profile is larger than 5 MB and was not restored"));
      return;
    }
    try {
      const parsed = parseLearnerBackup(await file.text());
      if (!parsed.records) {
        const message = parsed.error === "unsupported-version"
          ? t("学习档案版本暂不受支持", "This learning-profile version is not supported")
          : t("学习档案格式无效或内容损坏", "The learning profile is invalid or damaged");
        setNotice(message);
        return;
      }
      const merged = mergeLearnerRecords(recordsByCourse, parsed.records);
      const changed = parsed.records.filter((record) => {
        const current = recordsByCourse[record.courseId];
        return !current || Date.parse(record.updatedAt) > Date.parse(current.updatedAt);
      });
      await putCourseRecords(changed);
      setRecordsByCourse(merged.records);
      setNotice(t(
        `学习档案已恢复：新增 ${merged.added}，更新 ${merged.replaced}，保留较新的本地记录 ${merged.skipped}。进行中的课节会从头开始。`,
        `Learning profile restored: ${merged.added} added, ${merged.replaced} updated, ${merged.skipped} newer local records kept. In-progress lessons restart from the beginning.`,
      ));
    } catch {
      setNotice(t("无法读取学习档案", "The learning profile could not be read"));
    }
  }

  function restore(item: HistoryItem) {
    const parsed = validateCourse(item.payload);
    if (!parsed.course) return;
    setSource(item.payload);
    setCourse(parsed.course);
    setLanguage(parsed.course.manifest.languageId);
    setDraftId(item.draftId);
    setIssues([]);
    setNotice(t(`已恢复修订 ${item.revision}`, `Restored revision ${item.revision}`));
  }

  function saveAiSettings() {
    void putDeviceValue("preferences", "ai", { ...aiSettings, apiKey: "" }).catch(() => setNotice(t("AI 偏好保存失败", "AI preferences could not be saved")));
    if (aiSettings.apiKey.trim()) sessionStorage.setItem(AI_SESSION_KEY, aiSettings.apiKey.trim());
    else sessionStorage.removeItem(AI_SESSION_KEY);
    setAiConfigured(aiIsReady(aiSettings));
    setAiOpen(false);
    setNotice(t(`${providerLabels[aiSettings.provider][0]} 配置已保存；密钥将在关闭标签页后清除`, `${providerLabels[aiSettings.provider][1]} settings saved; the key will be cleared when this tab closes`));
  }

  async function testCurrentAi() {
    setAiConnection({ state: "testing", message: t("正在连接所选 AI 服务……", "Connecting to the selected AI service…") });
    try {
      await testAiConnection(aiSettings);
      setAiConnection({ state: "success", message: t("连接成功，可以用于文本学习反馈。", "Connection successful. The service is ready for text feedback.") });
    } catch (error) {
      setAiConnection({ state: "error", message: error instanceof Error ? localizeRuntimeMessage(error.message, uiLocale) : t("连接失败，请检查配置。", "Connection failed. Check the settings.") });
    }
  }

  function storeCourseRecord(next: CourseLearningRecord) {
    if (learningContext === "preview") {
      setPreviewRecordsByCourse((current) => ({ ...current, [next.courseId]: next }));
      return;
    }
    setRecordsByCourse((current) => ({ ...current, [next.courseId]: next }));
    void putCourseRecord(next).catch(() => setNotice(t("学习记录保存失败", "Learning record could not be saved")));
  }

  function storeLessonProgress(progress: LearningProgress) {
    const activeRecords = learningContext === "preview" ? previewRecordsByCourse : recordsByCourse;
    const current = activeRecords[progress.courseId] ?? createCourseLearningRecord(course);
    const next = updateCourseLearningRecord(current, progress);
    if (learningContext === "preview") {
      setPreviewRecordsByCourse((records) => ({ ...records, [next.courseId]: next }));
      return;
    }
    setRecordsByCourse((records) => ({ ...records, [next.courseId]: next }));
    void persistLearningState(next, progress).catch(() => setNotice(t("学习事件保存失败；当前页面中的进度仍然可用", "Learning events could not be saved; progress remains available on this page")));
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
    if (progress !== existing) storeLessonProgress(progress);
    setSelectedLessonId(lessonId);
    setLearningView("lesson");
  }

  function openReview(tasks: ReviewTask[]) {
    setReviewTasks(tasks);
    setLearningView("review");
  }

  function enterLearningSpace() {
    window.location.assign("/learn");
  }

  function enterStudioPreview() {
    setLearningContext("preview");
    setLearningView("dashboard");
  }

  function selectLearningCourse(courseId: string) {
    const selected = learnCourses.find((item) => item.manifest.id === courseId);
    if (!selected) return;
    setCourse(selected);
    setSource(JSON.stringify(selected, null, 2));
    setLanguage(selected.manifest.languageId);
    setSelectedLessonId(undefined);
  }

  function addKnowledge() {
    editCourse((next) => next.knowledge.push({
      id: uniqueId("knowledge", next.knowledge.map((item) => item.id)),
      kind: "lexeme",
      form: "",
      meaning: { [teachingLocale]: "" },
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
      translation: { [teachingLocale]: "" },
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
      prompt: { [teachingLocale]: "" },
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

  function changeExerciseKind(index: number, kind: ExerciseKind) {
    editCourse((next) => {
      const exercise = next.exercises[index];
      if (!exercise) return;
      exercise.kind = kind;
      if (["single-choice", "multiple-choice", "ordering"].includes(kind) && !exercise.options?.length) {
        exercise.options = [{ [teachingLocale]: t("选项一", "Option one") }, { [teachingLocale]: t("选项二", "Option two") }];
      }
      if (kind === "single-choice") exercise.correctOptionIndex ??= 0;
      if (kind === "multiple-choice") exercise.correctOptionIndices ??= [0];
      if (kind === "ordering") exercise.correctOrder = exercise.options?.map((_, optionIndex) => optionIndex);
    });
  }

  function updateExerciseOptions(index: number, value: string) {
    editCourse((next) => {
      const exercise = next.exercises[index];
      if (!exercise) return;
      const lines = splitLines(value);
      exercise.options = lines.map((line, optionIndex) => ({ ...(exercise.options?.[optionIndex] ?? {}), [teachingLocale]: line }));
      if (exercise.correctOptionIndex !== undefined && exercise.correctOptionIndex >= lines.length) exercise.correctOptionIndex = 0;
      if (exercise.correctOptionIndices) exercise.correctOptionIndices = exercise.correctOptionIndices.filter((optionIndex) => optionIndex < lines.length);
      if (exercise.kind === "ordering") exercise.correctOrder = lines.map((_, optionIndex) => optionIndex);
    });
  }

  function selectedDraftLesson(next: CoursePack) {
    return next.lessons.find((lesson) => lesson.id === selectedStudioLessonId) ?? next.lessons[0];
  }

  function addCourseLesson() {
    let createdId = "";
    editCourse((next) => {
      createdId = appendLesson(next, appLocale, t("新课节", "New lesson"));
    });
    if (createdId) setSelectedStudioLessonId(createdId);
  }

  function moveCourseLesson(offset: -1 | 1) {
    editCourse((next) => { moveLesson(next, selectedStudioLessonId, offset); });
  }

  function deleteCourseLesson() {
    if (course.lessons.length <= 1) {
      setNotice(t("课程至少需要保留一个课节", "A course must keep at least one lesson"));
      return;
    }
    const selected = course.lessons.find((lesson) => lesson.id === selectedStudioLessonId);
    if (!selected || !window.confirm(t(`确定删除课节“${displayText(selected.title, appLocale)}”吗？`, `Delete the lesson “${displayText(selected.title, appLocale)}”?`))) return;
    let nextId: string | undefined;
    editCourse((next) => { nextId = removeLesson(next, selectedStudioLessonId); });
    if (nextId) setSelectedStudioLessonId(nextId);
  }

  function renameCourseLesson(id: string) {
    const previous = selectedStudioLessonId;
    editCourse((next) => {
      const lesson = next.lessons.find((item) => item.id === previous);
      if (lesson) lesson.id = id;
    });
    setSelectedStudioLessonId(id);
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
    const lesson = course.lessons.find((item) => item.id === selectedStudioLessonId) ?? course.lessons[0];
    if (!lesson || lesson.steps.length <= 1) {
      setNotice(t("每个课节至少需要保留一个学习步骤", "Each lesson must keep at least one learning step"));
      return;
    }
    editCourse((next) => {
      const selected = selectedDraftLesson(next);
      if (selected) removeLessonStep(selected, index);
    });
  }

  function saveLanguagePack() {
    let json = languageJson;
    if (languageMode === "quick") {
      json = JSON.stringify({
        schemaVersion: 1,
        id: languageForm.id.trim(),
        name: {
          "zh-CN": languageForm.zhName.trim(),
          en: languageForm.enName.trim(),
          native: languageForm.nativeName.trim() || languageForm.enName.trim() || languageForm.zhName.trim(),
        },
        accent: languageForm.accent.trim(),
        scripts: [{ code: languageForm.scriptCode.trim(), name: { "zh-CN": languageForm.scriptCode.trim() }, direction: languageForm.direction, primary: true }],
        readingSystems: [],
        segmentation: { strategy: languageForm.scriptCode === "Latn" ? "whitespace" : "grapheme" },
      });
    }
    const result = validateLanguagePack(json);
    if (!result.pack) {
      setLanguageError(result.error ? localizeRuntimeMessage(result.error, uiLocale) : t("Language Pack 无效", "Invalid Language Pack"));
      return;
    }
    const custom = languagePacks
      .filter((pack) => !builtInLanguagePacks.some((builtIn) => builtIn.id === pack.id) && pack.id !== result.pack?.id);
    const nextCustom = [...custom, result.pack];
    void putDeviceValue("languagePacks", result.pack.id, result.pack).catch(() => setNotice(t("Language Pack 保存失败", "Language Pack could not be saved")));
    setLanguagePacks([...builtInLanguagePacks, ...nextCustom]);
    setLanguageOpen(false);
    setLanguageError("");
    setLanguageForm(defaultLanguageForm);
    setLanguageJson("");
    loadLanguage(result.pack);
    setNotice(t(`${languageName(result.pack, "zh-CN")} Language Pack 已保存并创建入门课程`, `${languageName(result.pack, "en")} Language Pack saved and starter course created`));
  }

  const currentLanguage = languagePacks.find((item) => item.id === language);
  const selectedStudioLessonIndex = Math.max(0, course.lessons.findIndex((lesson) => lesson.id === selectedStudioLessonId));
  const selectedStudioLesson = course.lessons[selectedStudioLessonIndex];
  const flow = selectedStudioLesson?.steps ?? [];
  const activeRecords = learningContext === "preview" ? previewRecordsByCourse : recordsByCourse;
  const currentRecord = activeRecords[course.manifest.id];
  const currentPercent = courseLearningPercent(course, currentRecord);
  const dueReviewCount = currentRecord ? reviewsDue(currentRecord).length : 0;
  const ongoingLesson = course.lessons.find((lesson) => currentRecord?.lessonProgress[lesson.id]?.status === "active");
  const selectedProgress = selectedLessonId ? currentRecord?.lessonProgress[selectedLessonId] : undefined;

  if (learningView === "library") {
    return <CourseLibrary entries={courseLibrary} locale={appLocale} notice={notice} onLocaleChange={changeAppLocale} onBack={() => window.location.assign("/studio")} onInstall={(entry) => void installLibraryCourse(entry)} onUpdate={(entry) => void updateLibraryCourse(entry)} onUninstall={(entry) => void uninstallLibraryCourse(entry)} onOpen={openLibraryCourse} onImportFile={(file) => void importCourseFile(file)} onExport={exportLibraryCourse} recordCount={Object.keys(recordsByCourse).length} onExportProfile={exportLearnerProfile} onImportProfile={(file) => void importLearnerProfile(file)} />;
  }
  if (learningView === "dashboard") {
    return <LearningDashboard course={course} courses={learningContext === "learn" ? learnCourses : [course]} record={currentRecord} locale={appLocale} onLocaleChange={changeAppLocale} preview={learningContext === "preview"} onSelectCourse={selectLearningCourse} onOpenLibrary={() => setLearningView("library")} onBack={() => learningContext === "preview" ? setLearningView("studio") : window.location.assign("/studio")} onStartLesson={openLesson} onStartReview={openReview} />;
  }
  if (learningView === "lesson" && selectedProgress) {
    return <LearningPlayer course={course} languagePack={currentLanguage} locale={appLocale} initialProgress={selectedProgress} preview={learningContext === "preview"} aiSettings={aiConfigured ? aiSettings : undefined} onProgress={storeLessonProgress} onExit={() => setLearningView("dashboard")} />;
  }
  if (learningView === "review" && currentRecord) {
    return <ReviewPlayer course={course} locale={appLocale} initialRecord={currentRecord} tasks={reviewTasks} preview={learningContext === "preview"} onRecord={storeCourseRecord} onExit={() => setLearningView("dashboard")} />;
  }

  return (
    <main className="studio-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Languages size={20} /></div>
          <div><strong>LearnLanguage</strong><span>{t("课程工作台", "Course Studio")}</span></div>
        </div>
        <nav className="side-nav" aria-label={t("工作台导航", "Studio navigation")}>
          <a className="nav-item active" href="/studio"><BookOpen size={18} /><span>{t("课程编辑器", "Course editor")}</span></a>
          <button className="nav-item" onClick={enterLearningSpace}><GraduationCap size={18} /><span>{t("学习空间", "Learn")}</span>{dueReviewCount > 0 && <em>{dueReviewCount}</em>}</button>
          <button className="nav-item"><Clock3 size={18} /><span>{t("本地草稿", "Local drafts")}</span><em>{history.length}</em></button>
        </nav>
        <div className="section-label">{t("目标语言", "Target language")}</div>
        <div className="language-list">
          {languagePacks.map((item) => (
            <button key={item.id} className={`language-button ${language === item.id ? "selected" : ""}`} onClick={() => loadLanguage(item)}>
              <span className="language-glyph">{item.accent}</span>
              <span><strong>{languageName(item, "native")}</strong><small>{languageName(item, uiLocale)}</small></span>
              {language === item.id && <Check size={16} />}
            </button>
          ))}
          <button className="language-button add-language" onClick={() => setLanguageOpen(true)}>
            <Plus size={17} />
            <span><strong>{t("添加语言", "Add language")}</strong><small>{t("创建或导入 Language Pack", "Create or import a Language Pack")}</small></span>
          </button>
        </div>
        <div className="sidebar-note">
          <Sparkles size={16} />
          <p>{t("语言只是内容包。学习流程、掌握度与复习机制由同一套引擎驱动。", "Languages are content packs. One engine drives learning flow, mastery, and review.")}</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <div className="eyebrow"><span className="status-dot" />{t("无需登录 · 设备本地", "No sign-in · device local")}</div>
            <h1>{displayText(course.manifest.title, teachingLocale)}</h1>
          </div>
          <div className="top-actions">
            <div className="locale-selectors studio-locale-selectors"><label className="teaching-language-select"><Languages size={16} /><span>{t("语言", "Language")}</span><select value={appLocale} onChange={(event) => changeAppLocale(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label></div>
            <button className="ai-button" onClick={() => setAiOpen(true)}><Bot size={17} />{t("AI 设置", "AI settings")}<span className={`ai-state ${aiConfigured ? "configured" : ""}`} /></button>
            {course.manifest.status === "published" ? <><button className="outline-button" onClick={installCurrentCourse}><GraduationCap size={17} />{t("安装到学习空间", "Install in Learn")}</button><button className="save-button" onClick={forkCurrentCourse}><RotateCcw size={17} />{t("创建派生草稿", "Create derived draft")}</button></> : <><button className="outline-button" onClick={publishCurrentCourse} disabled={publishing}>{publishing ? t("正在发布…", "Publishing…") : t("校验并发布", "Validate and publish")}</button><button className="save-button" onClick={saveDraft} disabled={saving}><Save size={17} />{saving ? t("正在保存…", "Saving…") : t("保存草稿", "Save draft")}</button></>}
          </div>
        </header>

        <div className="status-strip">
          <div><ShieldCheck size={16} /><span>{notice}</span></div>
          <span className="schema-pill">Schema v{course.schemaVersion}</span>
        </div>

        <div className="work-grid">
          <section className="editor-panel panel">
            <div className="panel-heading editor-heading">
              <div><span className="kicker">COURSE PACK</span><h2>{t("课程内容编辑", "Course content editor")}</h2></div>
              <div className="mode-switch" aria-label={t("编辑方式", "Editing mode")}>
                <button className={editorMode === "visual" ? "active" : ""} onClick={() => setEditorMode("visual")}><BookOpen size={14} />{t("可视化", "Visual")}</button>
                <button className={editorMode === "json" ? "active" : ""} onClick={() => setEditorMode("json")}><Braces size={14} />JSON</button>
              </div>
            </div>

            {editorMode === "visual" ? (
              <>
                <div className="section-tabs">
                  {sectionLabels.map(([id, chinese, english]) => <button key={id} className={editorSection === id ? "active" : ""} onClick={() => setEditorSection(id)}>{t(chinese, english)}</button>)}
                </div>
                <div className="visual-editor">
                  {editorSection === "overview" && (
                    <div className="form-section">
                      <div className="section-intro"><div><h3>{t("课程基本信息", "Course overview")}</h3><p>{t(`界面与课程内容已统一为${appLocale === "en" ? "英文" : "中文"}；切换右上角语言可维护另一版本。`, `The interface and course content are both using ${appLocale === "en" ? "English" : "Chinese"}. Use the Language selector to maintain the other version.`)}</p></div></div>
                      <div className="form-grid two-column">
                        <label><span>{t("课程 ID", "Course ID")}</span><input value={course.manifest.id} onChange={(event) => editCourse((next) => { next.manifest.id = event.target.value; })} /></label>
                        <label><span>{t("版本", "Version")}</span><input value={course.manifest.version} onChange={(event) => editCourse((next) => { next.manifest.version = event.target.value; })} /></label>
                        <label className="wide"><span>{t("课程名称", "Course title")}（{teachingLocale === "en" ? "English" : "中文"}）</span><input value={course.manifest.title[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.manifest.title[teachingLocale] = event.target.value; })} /></label>
                        <label className="wide"><span>{t("课程简介", "Course description")}（{teachingLocale === "en" ? "English" : "中文"}）</span><textarea value={course.manifest.description[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.manifest.description[teachingLocale] = event.target.value; })} /></label>
                        <label><span>{t("状态", "Status")}</span><input value={course.manifest.status === "published" ? t("已发布 · 只读", "Published · read-only") : t("草稿", "Draft")} readOnly /></label>
                        <label><span>{t("作者显示名", "Author display name")}</span><input value={course.manifest.author.displayName} onChange={(event) => editCourse((next) => { next.manifest.author.displayName = event.target.value; })} /></label>
                        <label><span>{t("课程内容许可证", "Course content license")}</span><select value={course.manifest.license?.id ?? ""} onChange={(event) => editCourse((next) => { const id = event.target.value; if (id) next.manifest.license = { id }; else delete next.manifest.license; })}><option value="">{t("发布前必须选择", "Required before publishing")}</option><option value="CC-BY-4.0">CC BY 4.0</option><option value="CC-BY-SA-4.0">CC BY-SA 4.0</option><option value="CC0-1.0">CC0 1.0</option><option value="ARR">{t("保留所有权利", "All rights reserved")}</option></select></label>
                      </div>
                    </div>
                  )}

                  {editorSection === "knowledge" && (
                    <div className="form-section">
                      <div className="section-intro"><div><h3>{t("知识点", "Knowledge")}</h3><p>{t("维护词汇、语法、字符或文化知识。", "Maintain vocabulary, grammar, script, and pragmatic knowledge.")}</p></div><button className="outline-button" onClick={addKnowledge}><Plus size={15} />{t("添加知识点", "Add knowledge")}</button></div>
                      <div className="item-stack">
                        {course.knowledge.map((item, index) => (
                          <article className="edit-card" key={`${item.id}-${index}`}>
                            <div className="edit-card-heading"><span>{t(`知识点 ${index + 1}`, `Knowledge ${index + 1}`)}</span><button onClick={() => removeKnowledge(index)} aria-label={t(`删除知识点 ${index + 1}`, `Delete knowledge ${index + 1}`)}><Trash2 size={15} /></button></div>
                            <div className="form-grid three-column">
                              <label><span>ID</span><input value={item.id} onChange={(event) => editCourse((next) => {
                                const previous = next.knowledge[index].id;
                                const current = event.target.value;
                                next.knowledge[index].id = current;
                                next.utterances.forEach((entry) => { entry.knowledgeRefs = entry.knowledgeRefs.map((id) => id === previous ? current : id); });
                                next.exercises.forEach((entry) => { entry.knowledgeRefs = entry.knowledgeRefs.map((id) => id === previous ? current : id); });
                                next.lessons.forEach((lesson) => lesson.steps.forEach((step) => { step.knowledgeRefs = step.knowledgeRefs.map((id) => id === previous ? current : id); }));
                              })} /></label>
                              <label><span>{t("类型", "Type")}</span><select value={item.kind} onChange={(event) => editCourse((next) => { next.knowledge[index].kind = event.target.value as typeof item.kind; })}><option value="lexeme">{t("词汇", "Vocabulary")}</option><option value="grammar">{t("语法", "Grammar")}</option><option value="script">{t("文字系统", "Script")}</option><option value="pragmatics">{t("语用文化", "Pragmatics")}</option></select></label>
                              <label><span>{t("目标语形式", "Target-language form")}</span><input value={item.form} dir={currentLanguage?.scripts[0]?.direction ?? "ltr"} onChange={(event) => editCourse((next) => { next.knowledge[index].form = event.target.value; })} /></label>
                              <label className="wide"><span>{teachingLocale === "en" ? "English meaning" : t("中文释义", "Chinese meaning")}</span><input value={item.meaning[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.knowledge[index].meaning[teachingLocale] = event.target.value; })} /></label>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {editorSection === "utterances" && (
                    <div className="form-section">
                      <div className="section-intro"><div><h3>{t("例句与表达", "Utterances")}</h3><p>{t("添加学习者会听到、读到和练习的自然表达。", "Add natural expressions learners will read and practise.")}</p></div><button className="outline-button" onClick={addUtterance}><Plus size={15} />{t("添加例句", "Add utterance")}</button></div>
                      <div className="item-stack">
                        {course.utterances.map((item, index) => (
                          <article className="edit-card" key={`${item.id}-${index}`}>
                            <div className="edit-card-heading"><span>{t(`例句 ${index + 1}`, `Utterance ${index + 1}`)}</span><button onClick={() => removeUtterance(index)} aria-label={t(`删除例句 ${index + 1}`, `Delete utterance ${index + 1}`)}><Trash2 size={15} /></button></div>
                            <div className="form-grid two-column">
                              <label><span>ID</span><input value={item.id} onChange={(event) => editCourse((next) => {
                                const previous = next.utterances[index].id;
                                const current = event.target.value;
                                next.utterances[index].id = current;
                                next.exercises.forEach((entry) => { entry.utteranceRefs = entry.utteranceRefs.map((id) => id === previous ? current : id); });
                                next.lessons.forEach((lesson) => lesson.steps.forEach((step) => { step.utteranceRefs = step.utteranceRefs.map((id) => id === previous ? current : id); }));
                              })} /></label>
                              <label><span>{t("关联知识点（逗号分隔）", "Knowledge references (comma-separated)")}</span><input value={item.knowledgeRefs.join(", ")} onChange={(event) => editCourse((next) => { next.utterances[index].knowledgeRefs = splitRefs(event.target.value); })} /></label>
                              <label className="wide"><span>{t("目标语例句", "Target-language utterance")}</span><textarea dir={currentLanguage?.scripts[0]?.direction ?? "ltr"} value={item.text} onChange={(event) => editCourse((next) => { next.utterances[index].text = event.target.value; })} /></label>
                              <label className="wide"><span>{teachingLocale === "en" ? "English translation" : t("中文翻译", "Chinese translation")}</span><input value={item.translation?.[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.utterances[index].translation = { ...(next.utterances[index].translation ?? {}), [teachingLocale]: event.target.value }; })} /></label>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {editorSection === "exercises" && (
                    <div className="form-section">
                      <div className="section-intro"><div><h3>{t("练习", "Exercises")}</h3><p>{t("定义理解、产出和角色扮演任务。", "Define comprehension, production, and role-play tasks.")}</p></div><button className="outline-button" onClick={addExercise}><Plus size={15} />{t("添加练习", "Add exercise")}</button></div>
                      <div className="item-stack">
                        {course.exercises.map((item, index) => (
                          <article className="edit-card" key={`${item.id}-${index}`}>
                            <div className="edit-card-heading"><span>{t(`练习 ${index + 1}`, `Exercise ${index + 1}`)}</span><button onClick={() => removeExercise(index)} aria-label={t(`删除练习 ${index + 1}`, `Delete exercise ${index + 1}`)}><Trash2 size={15} /></button></div>
                            <div className="form-grid two-column">
                              <label><span>ID</span><input value={item.id} onChange={(event) => editCourse((next) => {
                                const previous = next.exercises[index].id;
                                const current = event.target.value;
                                next.exercises[index].id = current;
                                next.lessons.forEach((lesson) => lesson.steps.forEach((step) => { step.exerciseRefs = step.exerciseRefs.map((id) => id === previous ? current : id); }));
                              })} /></label>
                              <label><span>{t("类型", "Type")}</span><select value={item.kind} onChange={(event) => changeExerciseKind(index, event.target.value as ExerciseKind)}><option value="single-choice">{t("单选理解", "Single choice")}</option><option value="multiple-choice">{t("多选理解", "Multiple choice")}</option><option value="ordering">{t("排序", "Ordering")}</option><option value="fill-blank">{t("填空", "Fill in the blank")}</option><option value="short-input">{t("简短输入", "Short input")}</option><option value="cloze">{t("完形填空", "Cloze")}</option><option value="substitution">{t("替换表达", "Substitution")}</option><option value="reconstruction">{t("重组表达", "Reconstruction")}</option><option value="matching">{t("匹配", "Matching")}</option><option value="role-play">{t("角色扮演", "Role-play")}</option><option value="free-response">{t("自由回答", "Free response")}</option></select></label>
                              <label className="wide"><span>{t("任务提示", "Task prompt")}（{teachingLocale === "en" ? "English" : "中文"}）</span><textarea value={item.prompt[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.exercises[index].prompt[teachingLocale] = event.target.value; })} /></label>
                              {["single-choice", "multiple-choice", "ordering"].includes(item.kind) && <label className="wide"><span>{t("选项（每行一个）", "Options (one per line)")}（{teachingLocale === "en" ? "English" : "中文"}）</span><textarea value={localizedOptionLines(item.options, teachingLocale)} onChange={(event) => updateExerciseOptions(index, event.target.value)} placeholder={t("第一项\n第二项", "First item\nSecond item")} /></label>}
                              {item.kind === "single-choice" && <label><span>{t("正确选项", "Correct option")}</span><select value={item.correctOptionIndex ?? 0} onChange={(event) => editCourse((next) => { next.exercises[index].correctOptionIndex = Number(event.target.value); })}>{(item.options ?? []).map((option, optionIndex) => <option value={optionIndex} key={optionIndex}>{optionIndex + 1}. {displayText(option, teachingLocale)}</option>)}</select></label>}
                              {item.kind === "multiple-choice" && <label><span>{t("正确选项序号（逗号分隔）", "Correct option numbers (comma-separated)")}</span><input value={(item.correctOptionIndices ?? []).map((value) => value + 1).join(", ")} onChange={(event) => editCourse((next) => { next.exercises[index].correctOptionIndices = [...new Set(splitRefs(event.target.value).map(Number).filter((value) => Number.isInteger(value) && value > 0).map((value) => value - 1))]; })} placeholder="1, 3" /></label>}
                              {item.kind === "ordering" && <label><span>{t("正确顺序", "Correct order")}</span><input value={t("按上方行顺序", "Same as the line order above")} readOnly /></label>}
                              {!["single-choice", "multiple-choice", "ordering"].includes(item.kind) && <label className="wide"><span>{t("可接受答案（可选，每行一个）", "Accepted answers (optional, one per line)")}</span><textarea value={item.acceptedAnswers?.join("\n") ?? ""} onChange={(event) => editCourse((next) => { const answers = splitLines(event.target.value); if (answers.length) next.exercises[index].acceptedAnswers = answers; else delete next.exercises[index].acceptedAnswers; })} placeholder={t("留空时使用自评或 AI 反馈", "Leave empty to use self-assessment or AI feedback")} /></label>}
                              <label className="wide"><span>{t("作答提示（可选）", "Learner support (optional)")}（{teachingLocale === "en" ? "English" : "中文"}）</span><textarea value={item.guidance?.[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.exercises[index].guidance = { ...(next.exercises[index].guidance ?? {}), [teachingLocale]: event.target.value }; })} /></label>
                              <label><span>{t("关联知识点（逗号分隔）", "Knowledge references (comma-separated)")}</span><input value={item.knowledgeRefs.join(", ")} onChange={(event) => editCourse((next) => { next.exercises[index].knowledgeRefs = splitRefs(event.target.value); })} /></label>
                              <label><span>{t("关联例句（逗号分隔）", "Utterance references (comma-separated)")}</span><input value={item.utteranceRefs.join(", ")} onChange={(event) => editCourse((next) => { next.exercises[index].utteranceRefs = splitRefs(event.target.value); })} /></label>
                              <label><span>{t("所需语言能力（逗号分隔）", "Required language capabilities (comma-separated)")}</span><input placeholder={t("例如 token-comparison", "For example: token-comparison")} value={item.requiredCapabilities?.join(", ") ?? ""} onChange={(event) => editCourse((next) => { const capabilities = splitRefs(event.target.value) as NonNullable<CoursePack["exercises"][number]["requiredCapabilities"]>; if (capabilities.length) next.exercises[index].requiredCapabilities = capabilities; else delete next.exercises[index].requiredCapabilities; })} /></label>
                              <label><span>{t("能力不足时", "When capabilities are missing")}</span><select value={item.capabilityFallback ?? "self-assessment"} onChange={(event) => editCourse((next) => { next.exercises[index].capabilityFallback = event.target.value as NonNullable<CoursePack["exercises"][number]["capabilityFallback"]>; })}><option value="self-assessment">{t("学习者自评", "Learner self-assessment")}</option><option value="reference-answer">{t("显示参考答案", "Show reference answer")}</option><option value="disabled">{t("跳过且不计证据", "Skip without evidence")}</option></select></label>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {editorSection === "flow" && (
                    <div className="form-section">
                      <div className="section-intro"><div><h3>{t("课节与学习流程", "Lessons and learning flow")}</h3><p>{t("先选择课节，再独立维护它的标题、目标和学习步骤。", "Select a lesson, then maintain its title, goals, and learning steps independently.")}</p></div><div className="section-actions"><button className="outline-button" onClick={addCourseLesson}><Plus size={15} />{t("添加课节", "Add lesson")}</button><button className="outline-button" onClick={addStep}><Plus size={15} />{t("添加步骤", "Add step")}</button></div></div>
                      <div className="lesson-sequence" role="tablist" aria-label={t("课程课节顺序", "Course lesson order")}>
                        {course.lessons.map((lesson, index) => <button type="button" role="tab" aria-selected={lesson.id === selectedStudioLesson?.id} className={lesson.id === selectedStudioLesson?.id ? "active" : ""} key={`${lesson.id}-${index}`} onClick={() => setSelectedStudioLessonId(lesson.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{displayText(lesson.title, teachingLocale)}</strong><small>{lesson.id} · {t(`${lesson.steps.length} 步`, `${lesson.steps.length} steps`)}</small></div></button>)}
                      </div>
                      {selectedStudioLesson && <div className="selected-lesson-panel">
                        <div className="selected-lesson-heading"><div><span>{t(`正在编辑第 ${selectedStudioLessonIndex + 1} 课`, `Editing lesson ${selectedStudioLessonIndex + 1}`)}</span><strong>{displayText(selectedStudioLesson.title, teachingLocale)}</strong></div><div><button type="button" onClick={() => moveCourseLesson(-1)} disabled={selectedStudioLessonIndex === 0} aria-label={t("课节前移", "Move lesson earlier")}><ArrowUp size={15} /></button><button type="button" onClick={() => moveCourseLesson(1)} disabled={selectedStudioLessonIndex === course.lessons.length - 1} aria-label={t("课节后移", "Move lesson later")}><ArrowDown size={15} /></button><button type="button" className="danger" onClick={deleteCourseLesson} disabled={course.lessons.length <= 1} aria-label={t("删除当前课节", "Delete current lesson")}><Trash2 size={15} /></button></div></div>
                        <div className="form-grid three-column lesson-fields">
                          <label><span>{t("课节 ID", "Lesson ID")}</span><input value={selectedStudioLesson.id} onChange={(event) => renameCourseLesson(event.target.value)} /></label>
                          <label><span>{t("课节名称", "Lesson title")}（{teachingLocale === "en" ? "English" : "中文"}）</span><input value={selectedStudioLesson.title[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.title[teachingLocale] = event.target.value; })} /></label>
                          <label><span>{t("能力目标（逗号分隔）", "Can-do goals (comma-separated)")}</span><input value={selectedStudioLesson.canDoGoalRefs.join(", ")} onChange={(event) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.canDoGoalRefs = splitRefs(event.target.value); })} /></label>
                        </div>
                      </div>}
                      <div className="item-stack compact">
                        {flow.map((step, index) => (
                          <article className="edit-card flow-edit-card" key={`${step.id}-${index}`}>
                            <div className="step-number">{String(index + 1).padStart(2, "0")}</div>
                            <div className="form-grid three-column">
                              <label><span>ID</span><input value={step.id} onChange={(event) => editCourse((next) => {
                                const lesson = selectedDraftLesson(next);
                                if (!lesson) return;
                                const previous = lesson.steps[index].id;
                                const current = event.target.value;
                                lesson.steps[index].id = current;
                                if (lesson.entryStepId === previous) lesson.entryStepId = current;
                                lesson.steps.forEach((entry) => { entry.next = entry.next.map((id) => id === previous ? current : id); });
                              })} /></label>
                              <label><span>{t("阶段", "Phase")}</span><select value={step.phase} onChange={(event) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.steps[index].phase = event.target.value as LessonPhase; })}><option value="diagnostic">{t("诊断", "Diagnostic")}</option><option value="preteach">{t("预教", "Pre-teaching")}</option><option value="supported-input">{t("支持性输入", "Supported input")}</option><option value="comprehension">{t("独立理解", "Comprehension")}</option><option value="guided-output">{t("引导输出", "Guided output")}</option><option value="independent-task">{t("独立任务", "Independent task")}</option><option value="feedback-retry">{t("反馈重试", "Feedback retry")}</option><option value="delayed-transfer">{t("延迟迁移", "Delayed transfer")}</option></select></label>
                              <label><span>{t("显示标题", "Display title")}（{teachingLocale === "en" ? "English" : "中文"}）</span><input value={step.title[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.steps[index].title[teachingLocale] = event.target.value; })} /></label>
                            </div>
                            <div className="step-actions"><button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label={t(`上移步骤 ${index + 1}`, `Move step ${index + 1} up`)}><ArrowUp size={14} /></button><button type="button" onClick={() => moveStep(index, 1)} disabled={index === flow.length - 1} aria-label={t(`下移步骤 ${index + 1}`, `Move step ${index + 1} down`)}><ArrowDown size={14} /></button><button type="button" className="danger" onClick={() => removeStep(index)} disabled={flow.length <= 1} aria-label={t(`删除步骤 ${index + 1}`, `Delete step ${index + 1}`)}><Trash2 size={14} /></button></div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="editor-toolbar"><div><FileJson size={16} /><span>{course.manifest.id}.json</span></div><span>{t(`${source.split("\n").length} 行`, `${source.split("\n").length} lines`)}</span></div>
                <textarea className="json-source" aria-label={t("课程包 JSON", "Course Pack JSON")} value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} />
                <div className="editor-footer"><button className="primary-button" onClick={importSource}><Braces size={16} />{t("校验并预览", "Validate and preview")}</button><span>{t("支持任何符合 Course Pack v2 的语言内容", "Supports content in any language that follows Course Pack v2")}</span></div>
              </>
            )}

            {issues.length > 0 && (
              <div className="issue-box">
                <div className="issue-title"><TriangleAlert size={17} /><strong>{t(`${issues.length} 个问题`, `${issues.length} issues`)}</strong></div>
                {issues.slice(0, 5).map((issue, index) => <div className="issue-row" key={`${issue.path}-${index}`}><span>{issue.stage}</span><code>{issue.path}</code><p>{localizeRuntimeMessage(issue.message, uiLocale)}</p></div>)}
              </div>
            )}
          </section>

          <aside className="preview-column">
            <section className="course-card panel">
              <div className="course-cover"><span>{currentLanguage?.accent ?? language.slice(0, 2)}</span><div className="cover-orbit orbit-one" /><div className="cover-orbit orbit-two" /></div>
              <div className="course-info">
                <div className="course-meta"><span>{currentLanguage ? languageName(currentLanguage, "native") : language}</span><span>·</span><span>{course.manifest.status}</span></div>
                <h2>{displayText(course.manifest.title, teachingLocale)}</h2><p>{displayText(course.manifest.description, teachingLocale)}</p>
                <div className="stat-grid">{stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
                <div className="learning-launch">
                  {currentRecord && <div className="mini-progress"><span><i style={{ width: `${currentPercent}%` }} /></span><small>{ongoingLesson ? t(`正在学习：${displayText(ongoingLesson.title, teachingLocale)}`, `Learning: ${displayText(ongoingLesson.title, teachingLocale)}`) : t(`课程进度 ${currentPercent}%`, `Course progress ${currentPercent}%`)}{dueReviewCount > 0 ? t(` · ${dueReviewCount} 个待复习`, ` · ${dueReviewCount} reviews due`) : ""}</small></div>}
                  <button onClick={enterStudioPreview}><Play size={15} fill="currentColor" />{t("预览学习流程", "Preview learning flow")}</button>
                  <small>{t("预览使用临时档案，不会写入真实学习进度。", "Preview uses a temporary profile and never changes real learning progress.")}</small>
                </div>
              </div>
            </section>
            <section className="flow-panel panel">
              <div className="panel-heading"><div><span className="kicker">LEARNING FLOW</span><h2>{t("课程流程预览", "Course flow preview")}</h2></div><span className="count-badge">{t(`${flow.length} 步`, `${flow.length} steps`)}</span></div>
              <div className="flow-list">{flow.map((step, index) => <div className="flow-step" key={`${step.id}-${index}`}><div className="step-index">{String(index + 1).padStart(2, "0")}</div><div><strong>{displayText(step.title, teachingLocale)}</strong><span>{step.phase}</span></div>{index < flow.length - 1 && <ChevronRight size={15} />}</div>)}</div>
            </section>
            <section className="history-panel panel">
              <div className="panel-heading"><div><span className="kicker">VERSION HISTORY</span><h2>{t("当前设备的修订", "Revisions on this device")}</h2></div></div>
              {history.length === 0 ? <div className="empty-history"><Clock3 size={20} /><p>{t("保存草稿后，修订记录会保留在这个浏览器中。", "Saved draft revisions will appear here in this browser.")}</p></div> : <div className="history-list">{history.slice(0, 4).map((item) => <button key={`${item.draftId}-${item.revision}`} onClick={() => restore(item)}><span className="revision">v{item.revision}</span><span><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleString(uiLocale === "en" ? "en-US" : "zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></span><RotateCcw size={14} /></button>)}</div>}
            </section>
          </aside>
        </div>
      </section>

      {languageOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="ai-dialog language-dialog" role="dialog" aria-modal="true" aria-labelledby="language-dialog-title">
            <div className="dialog-heading"><div className="dialog-icon"><Languages size={20} /></div><div><span className="kicker">LANGUAGE PACK</span><h2 id="language-dialog-title">{t("添加目标语言", "Add target language")}</h2></div><button className="icon-button" onClick={() => setLanguageOpen(false)} aria-label={t("关闭添加语言", "Close add language")}><X size={18} /></button></div>
            <div className="dialog-tabs"><button className={languageMode === "quick" ? "active" : ""} onClick={() => { setLanguageMode("quick"); setLanguageError(""); }}>{t("快速创建", "Quick create")}</button><button className={languageMode === "import" ? "active" : ""} onClick={() => { setLanguageMode("import"); setLanguageError(""); }}><Upload size={14} />{t("导入 JSON", "Import JSON")}</button></div>
            <div className="dialog-body">
              {languageMode === "quick" ? (
                <div className="form-grid two-column">
                  <label><span>{t("语言 ID", "Language ID")}</span><input value={languageForm.id} onChange={(event) => setLanguageForm((current) => ({ ...current, id: event.target.value }))} placeholder={t("例如：fr 或 ar-EG", "For example: fr or ar-EG")} /></label>
                  <label><span>{t("语言符号", "Language badge")}</span><input value={languageForm.accent} maxLength={2} onChange={(event) => setLanguageForm((current) => ({ ...current, accent: event.target.value }))} placeholder="Fr" /></label>
                  <label><span>{t("中文名称", "Chinese name")}</span><input value={languageForm.zhName} onChange={(event) => setLanguageForm((current) => ({ ...current, zhName: event.target.value }))} placeholder={t("例如：法语", "For example: 法语")} /></label>
                  <label><span>{t("英文名称", "English name")}</span><input value={languageForm.enName} onChange={(event) => setLanguageForm((current) => ({ ...current, enName: event.target.value }))} placeholder={t("例如：French", "For example: French")} /></label>
                  <label><span>{t("本地名称", "Native name")}</span><input value={languageForm.nativeName} onChange={(event) => setLanguageForm((current) => ({ ...current, nativeName: event.target.value }))} placeholder={t("例如：Français", "For example: Français")} /></label>
                  <label><span>{t("书写系统代码", "Script code")}</span><input value={languageForm.scriptCode} onChange={(event) => setLanguageForm((current) => ({ ...current, scriptCode: event.target.value }))} placeholder="Latn" /></label>
                  <label><span>{t("书写方向", "Writing direction")}</span><select value={languageForm.direction} onChange={(event) => setLanguageForm((current) => ({ ...current, direction: event.target.value as LanguageDirection }))}><option value="ltr">{t("从左到右", "Left to right")}</option><option value="rtl">{t("从右到左", "Right to left")}</option><option value="ttb">{t("从上到下", "Top to bottom")}</option></select></label>
                </div>
              ) : (
                <label className="json-import-field"><span>Language Pack JSON</span><textarea value={languageJson} onChange={(event) => setLanguageJson(event.target.value)} placeholder={'{\n  "schemaVersion": 1,\n  "id": "fr",\n  ...\n}'} spellCheck={false} /></label>
              )}
              {languageError && <div className="language-error"><TriangleAlert size={16} />{languageError}</div>}
              <div className="privacy-note"><ShieldCheck size={17} /><p>{t("自定义语言包只保存在当前浏览器。创建后会自动生成一份可编辑的入门课程，之后可继续补充语料。", "Custom language packs stay in this browser. Creating one also generates an editable starter course for your content.")}</p></div>
            </div>
            <div className="dialog-footer"><button className="text-button" onClick={() => setLanguageOpen(false)}>{t("取消", "Cancel")}</button><button className="primary-button" onClick={saveLanguagePack}>{t("保存并创建课程", "Save and create course")}</button></div>
          </section>
        </div>
      )}

      {aiOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-dialog-title">
            <div className="dialog-heading"><div className="dialog-icon"><Settings2 size={20} /></div><div><span className="kicker">PERSONAL AI</span><h2 id="ai-dialog-title">{t("选择你使用的 AI", "Choose your AI")}</h2></div><button className="icon-button" onClick={() => setAiOpen(false)} aria-label={t("关闭 AI 设置", "Close AI settings")}><X size={18} /></button></div>
            <div className="dialog-body">
              <label><span>{t("AI 服务商", "AI provider")}</span><select value={aiSettings.provider} onChange={(event) => setAiSettings((current) => ({ ...current, provider: event.target.value as AiProvider }))}>{Object.entries(providerLabels).map(([value, labels]) => <option key={value} value={value}>{t(...labels)}</option>)}</select></label>
              <label><span>{t("模型 ID", "Model ID")}</span><input value={aiSettings.model} onChange={(event) => setAiSettings((current) => ({ ...current, model: event.target.value }))} placeholder={t("例如：你账户中可用的模型名称", "For example: a model available to your account")} /></label>
              <label><span>{t("API 地址（可选）", "API endpoint (optional)")}</span><input value={aiSettings.endpoint} onChange={(event) => setAiSettings((current) => ({ ...current, endpoint: event.target.value }))} placeholder={t("自定义或本地服务地址", "Custom or local service endpoint")} /></label>
              <label><span>{t("API 密钥（兼容服务可不填）", "API key (optional for compatible services)")}</span><div className="key-input"><KeyRound size={16} /><input type="password" value={aiSettings.apiKey} onChange={(event) => { setAiSettings((current) => ({ ...current, apiKey: event.target.value })); setAiConnection({ state: "idle" }); }} placeholder={t("关闭当前标签页后自动清除", "Cleared when this tab closes")} autoComplete="off" /></div></label>
              {aiConnection.state !== "idle" && <div className={`ai-connection-status ${aiConnection.state}`}>{aiConnection.message}</div>}
              <div className="privacy-note"><ShieldCheck size={17} /><p>{t("服务商、模型和地址保存在当前设备；密钥只保留在当前标签页会话中。官方服务请求经过 LearnLanguage 转发但不会保存密钥，兼容服务直接连接你填写的地址。", "Provider, model, and endpoint stay on this device; the key stays only in this tab session. Official requests are relayed without saving the key, while compatible services connect directly to your endpoint.")}</p></div>
            </div>
            <div className="dialog-footer ai-dialog-actions"><button className="text-button" onClick={() => setAiOpen(false)}>{t("取消", "Cancel")}</button><button className="outline-button" onClick={testCurrentAi} disabled={aiConnection.state === "testing"}>{aiConnection.state === "testing" ? t("正在测试…", "Testing…") : t("测试连接", "Test connection")}</button><button className="primary-button" onClick={saveAiSettings}>{t("保存设置", "Save settings")}</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
