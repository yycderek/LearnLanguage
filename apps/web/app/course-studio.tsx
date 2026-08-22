"use client";

import { useEffect, useMemo, useState } from "react";
import { LearningPlanApplicationService, type CreateLearningPlanCommand, type LearningPlan } from "@learn-language/application";
import {
  BuiltInLanguagePackMutationError,
  CourseLibraryApplicationService,
  DraftApplicationService,
  LanguagePackApplicationService,
  LanguagePackInUseError,
  ProfileBackupApplicationService,
} from "@learn-language/application/workspace";
import { assessCourseTrust, type CourseTrustReport } from "@learn-language/application/trust";
import { courseAdaptiveAgenda } from "@/lib/adaptive-agenda";
import type { SyncConflict } from "@learn-language/protocol";
import { assessCourseLanguageCompatibility, languageAdapterPin, type LanguageCompatibilityReport } from "@learn-language/language-runtime";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Bot,
  Braces,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Copy,
  FileJson,
  FileText,
  GraduationCap,
  KeyRound,
  Languages,
  LayoutTemplate,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { LearningPlayer } from "@/app/learning-player";
import { LearningDashboard } from "@/app/learning-dashboard";
import { LearningPlanSetup } from "@/app/learning-plan-setup";
import { CourseLibrary } from "@/app/course-library";
import { DraftManager } from "@/app/draft-manager";
import { LanguagePackManager } from "@/app/language-pack-manager";
import { ReviewPlayer } from "@/app/review-player";
import { ProductGuide, type ProductGuideAudience } from "@/app/product-guide";
import { StudioStart } from "@/app/studio-start";
import { testAiConnection, type AiProvider, type AiSettings } from "@/lib/ai";
import {
  getAllDeviceValues,
  getDeviceValue,
  IndexedDbDraftRepository,
  IndexedDbInstalledCourseRepository,
  IndexedDbLearningProfileRepository,
  IndexedDbLanguagePackRepository,
  IndexedDbLearningPlanRepository,
  persistLearningState,
  putCourseRecord,
  putDeviceValue,
  putInstalledCourseVersion,
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
  parseLearnerBackup,
  serializeLearnerBackup,
} from "@/lib/learner-backup";
import {
  draftFileName,
  groupDraftRevisions,
  MAX_DRAFT_FILE_BYTES,
  normalizeDraftHistory,
  parseDraftFile,
  type DraftRevision,
} from "@/lib/draft-library";
import {
  languagePackFileName,
  languagePackUsage,
  MAX_LANGUAGE_PACK_FILE_BYTES,
  parseLanguagePackFile,
  serializeLanguagePackFile,
} from "@/lib/language-pack-file";
import {
  appendLesson,
  appendLessonStep,
  appendUnit,
  assignLessonToUnit,
  duplicateLesson,
  ensureCourseUnits,
  moveLesson,
  moveLessonStep,
  moveUnit,
  removeLesson,
  removeLessonStep,
  removeUnit,
  renameUnit,
} from "@/lib/course-authoring";
import { courseTemplates, createCourseFromTemplate, type CourseTemplateId } from "@/lib/course-templates";
import { assessPublishReadiness, canPublish } from "@/lib/publish-readiness";
import { analyzeCourseMaterial, createCourseDraftFromMaterials, MAX_MATERIAL_CHARACTERS } from "@/lib/material-course";
import { extractMaterialFile, fetchMaterialUrl, MAX_MATERIALS, type CourseMaterial, type MaterialKind } from "@/lib/material-import";
import { applyCourseAuthoringEnhancement, requestCourseAuthoringEnhancement } from "@/lib/course-ai";
import { clearStudioWorkingCopy, loadStudioWorkingCopy, saveStudioWorkingCopy } from "@/lib/studio-working-copy";
import { runDeviceSync, type DeviceSyncSettings } from "@/lib/sync";
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
const SYNC_TOKEN_SESSION_KEY = "learn-language-sync-token-session-v1";
const PRODUCT_GUIDE_SEEN_KEY = "product-guide-seen-v1";
const BUILT_IN_LANGUAGE_IDS = new Set(builtInLanguagePacks.map((pack) => pack.id));
const draftApplication = new DraftApplicationService(new IndexedDbDraftRepository());
const AUTOSAVE_DELAY_MS = 900;
const languagePackApplication = new LanguagePackApplicationService(new IndexedDbLanguagePackRepository(), BUILT_IN_LANGUAGE_IDS);
const installedCourseRepository = new IndexedDbInstalledCourseRepository();
const profileBackupApplication = new ProfileBackupApplicationService<CourseLearningRecord>(new IndexedDbLearningProfileRepository());
const learningPlanApplication = new LearningPlanApplicationService(new IndexedDbLearningPlanRepository());

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
  "语言名称必须是非空文本": "Language names must be non-empty text",
  "每种书写系统至少需要一个名称": "Each writing system needs at least one name",
  "Language Pack 必须且只能有一种主要书写系统": "A Language Pack must have exactly one primary writing system",
  "adapter 需要 id 和 version": "adapter requires an id and version",
  "adapter.capabilities 必须是数组": "adapter.capabilities must be an array",
  "adapter.capabilities 包含不受支持的能力": "adapter.capabilities contains an unsupported capability",
  "adapter 分词策略需要 adapter 定义": "The adapter segmentation strategy requires an adapter definition",
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
  if (message.startsWith("书写系统 code 重复：")) return `Duplicate writing-system code: ${message.slice("书写系统 code 重复：".length)}`;
  if (message.endsWith(" 必须是数组")) return `${message.slice(0, -" 必须是数组".length)} must be an array`;
  if (message.startsWith("发现重复 ID：")) return `Duplicate ID: ${message.slice("发现重复 ID：".length)}`;
  if (message.startsWith("引用不存在：")) return `Missing reference: ${message.slice("引用不存在：".length)}`;
  if (message.startsWith("评分规则不存在：")) return `Missing rubric: ${message.slice("评分规则不存在：".length)}`;
  if (message.startsWith("入口步骤不存在：")) return `Missing entry step: ${message.slice("入口步骤不存在：".length)}`;
  if (message.startsWith("AI 服务请求失败（")) return message.replace("AI 服务请求失败", "AI service request failed");
  return message;
}

function ReferencePicker({
  label,
  options,
  selected,
  emptyLabel,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  emptyLabel: string;
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="reference-picker wide">
      <legend>{label}</legend>
      {options.length === 0 ? <p>{emptyLabel}</p> : <div>{options.map((option) => {
        const active = selected.includes(option.id);
        return (
          <button
            type="button"
            key={option.id}
            className={active ? "selected" : ""}
            aria-pressed={active}
            onClick={() => onChange(active ? selected.filter((id) => id !== option.id) : [...selected, option.id])}
          >
            {active && <Check size={12} />}
            <span>{option.label}</span>
          </button>
        );
      })}</div>}
    </fieldset>
  );
}

export function CourseStudio({ space = "studio" }: { space?: "learn" | "studio" }) {
  const [appLocale, setAppLocale] = useState<AppLocale>("zh-CN");
  const teachingLocale = appLocale;
  const uiLocale = appLocale;
  const [studioStarted, setStudioStarted] = useState(space === "learn");
  const [language, setLanguage] = useState("");
  const [languagePacks, setLanguagePacks] = useState<LanguagePack[]>(builtInLanguagePacks);
  const [source, setSource] = useState(() => JSON.stringify(sampleCourse("und", "Target language"), null, 2));
  const [course, setCourse] = useState<CoursePack>(() => sampleCourse("und", "Target language"));
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [history, setHistory] = useState<DraftRevision[]>([]);
  const [draftId, setDraftId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState(() => space === "learn"
    ? "选择一门课程，点击“一键开始学习”即可直接进入第一课"
    : "选择、创建或导入目标语言后开始设计课程");
  const [editorMode, setEditorMode] = useState<"visual" | "json">("visual");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [articleOpen, setArticleOpen] = useState(false);
  const [articleForm, setArticleForm] = useState<{ languageId: string; title: string; text: string; url: string; kind: MaterialKind; useAi: boolean; rightsConfirmed: boolean }>({ languageId: "", title: "", text: "", url: "", kind: "article", useAi: false, rightsConfirmed: false });
  const [articleMaterials, setArticleMaterials] = useState<CourseMaterial[]>([]);
  const [articleBusy, setArticleBusy] = useState(false);
  const [articleError, setArticleError] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("unit-1");
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
  const [plansByCourse, setPlansByCourse] = useState<Record<string, LearningPlan>>({});
  const [previewRecordsByCourse, setPreviewRecordsByCourse] = useState<Record<string, CourseLearningRecord>>({});
  const [learningContext, setLearningContext] = useState<"learn" | "preview">(space === "learn" ? "learn" : "preview");
  const [learningView, setLearningView] = useState<"studio" | "drafts" | "languages" | "library" | "plan" | "dashboard" | "lesson" | "review">(space === "learn" ? "library" : "studio");
  const [selectedLessonId, setSelectedLessonId] = useState<string>();
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([]);
  const [syncSettings, setSyncSettings] = useState<DeviceSyncSettings>({ endpoint: "", profileId: "local-profile", deviceId: "" });
  const [syncToken, setSyncToken] = useState("");
  const [syncStatus, setSyncStatus] = useState<{ state: "idle" | "syncing" | "success" | "error" | "conflict"; message?: string; conflicts?: readonly SyncConflict[] }>({ state: "idle" });
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideAudience, setGuideAudience] = useState<ProductGuideAudience>(space);
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
  const draftLanguageIds = useMemo(
    () => groupDraftRevisions(history).map((group) => group.latest.languageId),
    [history],
  );
  const courseLibraryApplication = useMemo(() => new CourseLibraryApplicationService(installedCourseRepository, {
    assess: (candidate) => assessCourseLanguageCompatibility(candidate, languagePacks.find((pack) => pack.id === candidate.manifest.languageId)),
  }), [languagePacks]);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      const [storedHistory, storedAi, customPacks, storedRecords, storedInstalledCourses, storedAppLocale, storedTeachingLocale, storedUiLocale, storedSync, guideSeen, storedPlans, workingCopy] = await Promise.all([
        draftApplication.list(),
        getDeviceValue<AiSettings>("preferences", "ai"),
        languagePackApplication.list(),
        getAllDeviceValues<unknown>("courseRecords"),
        installedCourseRepository.list(),
        getDeviceValue<unknown>("preferences", APP_LOCALE_PREFERENCE_KEY),
        getDeviceValue<unknown>("preferences", TEACHING_LOCALE_PREFERENCE_KEY),
        getDeviceValue<unknown>("preferences", UI_LOCALE_PREFERENCE_KEY),
        getDeviceValue<Partial<DeviceSyncSettings>>("preferences", "sync-settings"),
        getDeviceValue<boolean>("preferences", PRODUCT_GUIDE_SEEN_KEY),
        learningPlanApplication.list(),
        space === "studio" ? loadStudioWorkingCopy() : Promise.resolve(undefined),
      ]);
      if (!active) return;
      const sessionKey = sessionStorage.getItem(AI_SESSION_KEY) ?? "";
      const syncSessionToken = sessionStorage.getItem(SYNC_TOKEN_SESSION_KEY) ?? "";
      const hydratedAi = { ...defaultAiSettings, ...storedAi, apiKey: sessionKey };
      const normalizedRecords: Record<string, CourseLearningRecord> = {};
      for (const value of storedRecords) {
        const normalized = normalizeCourseLearningRecord(value);
        if (normalized) normalizedRecords[normalized.courseId] = normalized;
      }
      setHistory(normalizeDraftHistory(storedHistory));
      setAiSettings(hydratedAi);
      setAiConfigured(aiIsReady(hydratedAi));
      const hydratedSync = { endpoint: "", profileId: "local-profile", deviceId: crypto.randomUUID(), ...storedSync } as DeviceSyncSettings;
      if (!hydratedSync.deviceId) hydratedSync.deviceId = crypto.randomUUID();
      setSyncSettings(hydratedSync);
      setSyncToken(syncSessionToken);
      if (!storedSync?.deviceId) void putDeviceValue("preferences", "sync-settings", hydratedSync).catch(() => undefined);
      const availableLanguagePacks = [...builtInLanguagePacks, ...customPacks.filter((pack) => !builtInLanguagePacks.some((item) => item.id === pack.id))];
      setLanguagePacks(availableLanguagePacks);
      setRecordsByCourse(normalizedRecords);
      setInstalledCourses([...storedInstalledCourses]);
      setPlansByCourse(Object.fromEntries(storedPlans.map((plan) => [plan.courseId, plan])));
      const nextLocale = resolveStoredAppLocale(storedAppLocale, storedUiLocale, storedTeachingLocale);
      setAppLocale(nextLocale);
      if (!guideSeen) {
        setGuideAudience(space);
        setGuideOpen(true);
      }
      if (storedAppLocale === undefined) void putDeviceValue("preferences", APP_LOCALE_PREFERENCE_KEY, nextLocale).catch(() => undefined);
      const recovered = workingCopy ? validateCourse(JSON.stringify(workingCopy.course)) : undefined;
      if (space === "studio" && recovered?.course) {
        ensureCourseUnits(recovered.course, nextLocale);
        setCourse(recovered.course);
        setSource(JSON.stringify(recovered.course, null, 2));
        setLanguage(recovered.course.manifest.languageId);
        setStudioStarted(true);
        setDraftId(workingCopy!.draftId);
        setSelectedStudioLessonId(recovered.course.lessons[0]?.id ?? "");
        setSelectedUnitId(recovered.course.units?.[0]?.id ?? "unit-1");
        setNotice(uiText(nextLocale, "已恢复自动保存的修改", "Recovered auto-saved changes"));
      } else {
        setNotice(space === "learn" ? uiText(nextLocale, "选择一门课程，点击“一键开始学习”即可直接进入第一课", "Choose a course and select Start learning to enter the first lesson.") : uiText(nextLocale, "示例课程已载入，可以直接编辑", "The sample course is ready to edit"));
      }
      setHydrated(true);
      if (space === "learn" && storedInstalledCourses[0]) {
        const firstCourse = storedInstalledCourses[0];
        const compatibility = assessCourseLanguageCompatibility(firstCourse, availableLanguagePacks.find((pack) => pack.id === firstCourse.manifest.languageId));
        if (compatibility.status === "blocked") {
          setLearningView("library");
          setNotice(uiText(nextLocale, "已安装课程缺少兼容的 Language Pack 或语言适配器；请先修复语言运行时", "An installed course is missing a compatible Language Pack or language adapter. Repair its language runtime first."));
        } else {
          setCourse(firstCourse);
          setSource(JSON.stringify(firstCourse, null, 2));
          setLanguage(firstCourse.manifest.languageId);
          setLearningView("dashboard");
        }
      }
    }
    void hydrate().catch(() => {
      const fallbackLocale = normalizeAppLocale(navigator.language.startsWith("en") ? "en" : "zh-CN");
      if (active) {
        setHydrated(true);
        setNotice(uiText(fallbackLocale, "设备数据库无法打开；当前更改仅保留到页面关闭", "The device database could not be opened. Changes will last only until this page closes."));
      }
    });
    return () => { active = false; };
  }, [space]);

  useEffect(() => {
    document.documentElement.lang = appLocale;
  }, [appLocale]);

  function changeAppLocale(locale: AppLocale) {
    setAppLocale(locale);
    void putDeviceValue("preferences", APP_LOCALE_PREFERENCE_KEY, locale).catch(() => setNotice(uiText(locale, "语言偏好保存失败", "Could not save the language preference")));

  }

  useEffect(() => {
    if (!hydrated || space !== "studio" || !studioStarted || course.manifest.status !== "draft") return;
    const timeout = window.setTimeout(() => {
      setAutoSaveState("saving");
      const workingDraftId = draftId ?? `working-${course.manifest.id}`;
      void saveStudioWorkingCopy({ draftId: workingDraftId, updatedAt: new Date().toISOString(), course: cloneCourse(course) }).then(() => setAutoSaveState("saved")).catch(() => setAutoSaveState("error"));
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [course, draftId, hydrated, space, studioStarted]);

  function openProductGuide(audience: ProductGuideAudience) {
    setGuideAudience(audience);
    setGuideOpen(true);
  }

  function closeProductGuide() {
    setGuideOpen(false);
    void putDeviceValue("preferences", PRODUCT_GUIDE_SEEN_KEY, true).catch(() => undefined);
  }

  function commitCourse(next: CoursePack, message = t("可视化修改已同步到课程包", "Visual changes synced to the Course Pack")) {
    const normalized = cloneCourse(next);
    if (normalized.manifest.status === "draft") ensureCourseUnits(normalized, appLocale);
    setCourse(normalized);
    setSource(JSON.stringify(normalized, null, 2));
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
    setAutoSaveState("idle");
    commitCourse(next);
  }

  function loadLanguage(pack: LanguagePack) {
    const next = sampleCourse(pack.id, languageName(pack, teachingLocale));
    setLanguage(pack.id);
    setStudioStarted(true);
    setEditorSection("overview");
    setDraftId(crypto.randomUUID());
    commitCourse(next, t(`${languageName(pack, "zh-CN")}示例已载入`, `${languageName(pack, "en")} sample loaded`));
  }

  function importSource() {
    const result = validateCourse(source);
    setIssues(result.issues);
    if (result.course) {
      setLanguage(result.course.manifest.languageId);
      setSelectedStudioLessonId(result.course.lessons[0]?.id ?? "");
      commitCourse(result.course, t("课程包校验通过，预览已更新", "Course Pack validated and preview updated"));
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
    try {
      const saved = await draftApplication.saveRevision({
        draftId: nextDraftId,
        title: displayText(result.course.manifest.title),
        languageId: result.course.manifest.languageId,
        payload: source,
        updatedAt: new Date().toISOString(),
      });
      setDraftId(nextDraftId);
      setHistory(normalizeDraftHistory(saved.history));
      setNotice(t(`已保存到当前设备 · 修订 ${saved.revision.revision}`, `Saved on this device · revision ${saved.revision.revision}`));
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
      const publishingDraft = cloneCourse(result.course);
      const publishingLanguage = languagePacks.find((pack) => pack.id === publishingDraft.manifest.languageId);
      if (!publishingLanguage) {
        compatibilityBlocked(assessCourseLanguageCompatibility(publishingDraft, undefined));
        return;
      }
      const readiness = assessPublishReadiness(publishingDraft, appLocale, result.issues, true);
      if (!canPublish(readiness)) {
        setEditorMode("visual");
        setEditorSection("overview");
        setNotice(t("发布检查仍有未完成项", "The publishing checklist still has blockers"));
        return;
      }
      publishingDraft.manifest.languageAdapter = languageAdapterPin(publishingLanguage);
      const published = await publishCourseDraft(publishingDraft);
      const compatibility = languageCompatibility(published);
      if (compatibilityBlocked(compatibility)) return;
      commitCourse(published, t(`已发布不可变版本 · ${published.manifest.contentHash.slice(0, 22)}…`, `Immutable version published · ${published.manifest.contentHash.slice(0, 22)}…`) + compatibilitySuffix(compatibility));
      setDraftId(undefined);
      void clearStudioWorkingCopy().catch(() => undefined);
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
    setDraftId(crypto.randomUUID());
    setEditorSection("overview");
  }

  function languageCompatibility(candidate: CoursePack) {
    return assessCourseLanguageCompatibility(candidate, languagePacks.find((pack) => pack.id === candidate.manifest.languageId));
  }

  function compatibilityBlocked(report: LanguageCompatibilityReport) {
    if (report.status !== "blocked") return false;
    const first = report.issues.find((issue) => issue.severity === "blocked");
    const message = first?.code === "language-pack-missing"
      ? t(`缺少课程所需的 ${report.languageId} Language Pack；请先在 Studio 导入语言包`, `The ${report.languageId} Language Pack is missing. Import it in Studio before continuing.`)
      : first?.code === "exercise-capability-missing"
        ? t(`练习 ${first.exerciseId ?? ""} 缺少 ${first.capability ?? ""} 能力且没有显式降级规则`, `Exercise ${first.exerciseId ?? ""} requires ${first.capability ?? ""} but has no explicit fallback.`)
        : t("课程固定的语言适配器与当前 Language Pack 或已安装运行时不兼容", "The course's pinned language adapter is incompatible with the current Language Pack or installed runtime.");
    setNotice(message);
    return true;
  }

  function compatibilitySuffix(report: LanguageCompatibilityReport) {
    const degraded = report.issues.filter((issue) => issue.severity === "degraded").length;
    return degraded > 0
      ? t(`；${degraded} 项练习将使用显式降级方式`, `; ${degraded} exercises will use explicit fallbacks`)
      : "";
  }

  function confirmCourseTrust(candidate: CoursePack, report: CourseTrustReport = assessCourseTrust(candidate)) {
    if (!report.canInstall) {
      setNotice(t("课程来源、许可证或发布完整性校验未通过，已拒绝安装", "The course failed provenance, license, or publication checks and was blocked"));
      return false;
    }
    if (!report.requiresConfirmation) return true;
    const sourceLabel = candidate.manifest.source.title ?? candidate.manifest.source.url ?? t("未提供外部来源", "No external source provided");
    return window.confirm(t(
      `这是由「${candidate.manifest.author.displayName}」提供的非官方课程。许可证：${candidate.manifest.license?.id ?? "-"}；来源：${sourceLabel}。仅在信任作者和内容时安装。继续吗？`,
      `This is a non-official course from “${candidate.manifest.author.displayName}”. License: ${candidate.manifest.license?.id ?? "-"}; source: ${sourceLabel}. Install only if you trust the author and content. Continue?`,
    ));
  }

  async function installCurrentCourse() {
    if (course.manifest.status !== "published") {
      setNotice(t("请先发布不可变课程版本，再安装到学习空间", "Publish an immutable course version before installing it in Learn"));
      return;
    }
    const compatibility = languageCompatibility(course);
    if (compatibilityBlocked(compatibility)) return;
    if (!confirmCourseTrust(course)) return;
    try {
      const integrity = await verifyPublishedCourseIntegrity(course);
      if (!integrity.valid) {
        setNotice(t("课程内容哈希校验失败，已拒绝安装", "Course content hash verification failed; installation was rejected"));
        return;
      }
      await courseLibraryApplication.install(course);
      setInstalledCourses((current) => [course, ...current.filter((item) => item.manifest.id !== course.manifest.id)]);
      setNotice(t("已安装到学习空间；创作草稿和学习课程保持独立", "Installed in Learn; authoring drafts remain separate from learning courses") + compatibilitySuffix(compatibility));
    } catch {
      setNotice(t("课程安装失败；请检查浏览器是否允许设备存储", "Course installation failed. Check whether the browser allows device storage."));
    }
  }

  async function installLibraryCourse(entry: CourseLibraryEntry) {
    const compatibility = languageCompatibility(entry.course);
    if (compatibilityBlocked(compatibility)) return false;
    if (!confirmCourseTrust(entry.course, entry.trust)) return false;
    try {
      const integrity = await verifyPublishedCourseIntegrity(entry.course);
      if (!integrity.valid) {
        setNotice(t("课程内容完整性校验失败，已拒绝安装", "Course integrity verification failed; installation was rejected"));
        return false;
      }
      await courseLibraryApplication.install(entry.course);
      setInstalledCourses((current) => [entry.course, ...current.filter((item) => item.manifest.id !== entry.id)]);
      setNotice(t(`已安装「${displayText(entry.course.manifest.title, appLocale)}」`, `Installed “${displayText(entry.course.manifest.title, appLocale)}”`) + compatibilitySuffix(compatibility));
      return true;
    } catch {
      setNotice(t("课程安装失败；请检查浏览器是否允许设备存储", "Course installation failed. Check whether device storage is available."));
      return false;
    }
  }

  async function startLibraryCourse(entry: CourseLibraryEntry) {
    const selected = entry.installedCourse ?? entry.course;
    if (entry.status === "available" && !await installLibraryCourse(entry)) return;
    if (compatibilityBlocked(languageCompatibility(selected))) return;

    setCourse(selected);
    setSource(JSON.stringify(selected, null, 2));
    setLanguage(selected.manifest.languageId);
    setLearningContext("learn");

    const existingRecord = recordsByCourse[selected.manifest.id];
    const existingPlan = plansByCourse[selected.manifest.id];
    if (!existingRecord && !existingPlan) {
      setSelectedLessonId(undefined);
      setLearningView("plan");
      return;
    }

    const record = existingRecord ?? createCourseLearningRecord(selected);
    const activeLesson = selected.lessons.find((lesson) => record.lessonProgress[lesson.id]?.status === "active");
    const plannedLesson = existingPlan && record.completedLessonIds.length === 0
      ? selected.lessons.find((lesson) => lesson.id === existingPlan.startingLessonId)
      : undefined;
    const nextLesson = activeLesson ?? plannedLesson ?? selected.lessons.find((lesson, index) =>
      !record.completedLessonIds.includes(lesson.id)
      && (index === 0 || record.completedLessonIds.includes(selected.lessons[index - 1]!.id)));
    if (!nextLesson) {
      setSelectedLessonId(undefined);
      setLearningView("dashboard");
      return;
    }

    const existing = record.lessonProgress[nextLesson.id];
    const compatible = Boolean(existing
      && existing.courseVersion === selected.manifest.version
      && (existing.status === "completed" || nextLesson.steps.some((step) => step.id === existing.currentStepId)));
    const progress = compatible && existing ? existing : startLearning(selected, nextLesson.id);
    const nextRecord = updateCourseLearningRecord(record, progress);
    setRecordsByCourse((current) => ({ ...current, [selected.manifest.id]: nextRecord }));
    void persistLearningState(nextRecord, progress).catch(() => setNotice(t("学习记录保存失败；当前页面中的进度仍然可用", "Learning progress could not be saved; it remains available on this page")));
    setSelectedLessonId(nextLesson.id);
    setLearningView("lesson");
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
    const runtimeCompatibility = languageCompatibility(entry.course);
    if (compatibilityBlocked(runtimeCompatibility)) return;
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
      setNotice(t(`课程已更新至 v${entry.course.manifest.version}，学习进度已保留`, `Updated to v${entry.course.manifest.version}; learning progress was preserved`) + compatibilitySuffix(runtimeCompatibility));
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
      await courseLibraryApplication.remove(entry.id);
      setInstalledCourses((current) => current.filter((item) => item.manifest.id !== entry.id));
      setNotice(t(`已卸载「${title}」；学习记录仍保存在当前设备`, `Removed “${title}”; learning progress remains on this device`));
    } catch {
      setNotice(t("课程卸载失败", "Course removal failed"));
    }
  }

  function openLibraryCourse(entry: CourseLibraryEntry) {
    const selected = entry.installedCourse ?? installedCourses.find((item) => item.manifest.id === entry.id);
    if (!selected) return;
    if (compatibilityBlocked(languageCompatibility(selected))) return;
    setCourse(selected);
    setSource(JSON.stringify(selected, null, 2));
    setLanguage(selected.manifest.languageId);
    setSelectedLessonId(undefined);
    setLearningContext("learn");
    setLearningView("dashboard");
  }

  function returnToLearningHome() {
    const selected = installedCourses.find((item) => item.manifest.id === course.manifest.id) ?? installedCourses[0];
    if (!selected) {
      setNotice(t("选择一门课程，点击“一键开始学习”即可直接进入第一课", "Choose a course and select Start learning to enter the first lesson."));
      return;
    }
    setCourse(selected);
    setSource(JSON.stringify(selected, null, 2));
    setLanguage(selected.manifest.languageId);
    setLearningContext("learn");
    setSelectedLessonId(undefined);
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
      if (!confirmCourseTrust(imported)) return;
      const runtimeCompatibility = languageCompatibility(imported);
      if (compatibilityBlocked(runtimeCompatibility)) return;
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
        setNotice(t(`已从文件更新至 v${imported.manifest.version}，学习进度已保留`, `Updated from file to v${imported.manifest.version}; progress was preserved`) + compatibilitySuffix(runtimeCompatibility));
        return;
      }

      await courseLibraryApplication.install(imported);
      setInstalledCourses((current) => [imported, ...current]);
      setNotice(t(`已导入并安装「${displayText(imported.manifest.title, appLocale)}」`, `Imported and installed “${displayText(imported.manifest.title, appLocale)}”`) + compatibilitySuffix(runtimeCompatibility));
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
    const plans = Object.values(plansByCourse);
    if (records.length === 0 && plans.length === 0) {
      setNotice(t("还没有可备份的学习记录", "There is no learning progress to back up yet"));
      return;
    }
    const backup = createLearnerBackup(records, plans);
    const blob = new Blob([serializeLearnerBackup(backup)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = learnerBackupFileName(backup.exportedAt);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice(t(`已导出 ${records.length} 门课程记录和 ${plans.length} 个个人计划；未包含课程内容和 AI 设置`, `Exported ${records.length} course records and ${plans.length} personal plans without course content or AI settings`));
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
      const [merged, restoredPlans] = await Promise.all([
        profileBackupApplication.restore(parsed.records),
        learningPlanApplication.restore(parsed.plans ?? []),
      ]);
      setRecordsByCourse(merged.records);
      setPlansByCourse(restoredPlans.plans);
      setNotice(t(
        `学习档案已恢复：课程记录新增 ${merged.added}、更新 ${merged.replaced}；个人计划新增 ${restoredPlans.added}、更新 ${restoredPlans.replaced}。进行中的课节会从头开始。`,
        `Learning profile restored: ${merged.added} course records added, ${merged.replaced} updated; ${restoredPlans.added} personal plans added, ${restoredPlans.replaced} updated. In-progress lessons restart from the beginning.`,
      ));
    } catch {
      setNotice(t("无法读取学习档案", "The learning profile could not be read"));
    }
  }

  function restore(item: DraftRevision) {
    const parsed = validateCourse(item.payload);
    if (!parsed.course) return;
    const restored = cloneCourse(parsed.course);
    ensureCourseUnits(restored, appLocale);
    setSource(JSON.stringify(restored, null, 2));
    setCourse(restored);
    setLanguage(restored.manifest.languageId);
    setSelectedStudioLessonId(restored.lessons[0]?.id ?? "");
    setSelectedUnitId(restored.units?.[0]?.id ?? "unit-1");
    setStudioStarted(true);
    setDraftId(item.draftId);
    setIssues([]);
    setNotice(t(`已恢复修订 ${item.revision}`, `Restored revision ${item.revision}`));
  }

  function restoreFromDraftManager(item: DraftRevision) {
    restore(item);
    setEditorSection("overview");
    setLearningView("studio");
  }

  async function importDraftFile(file: File) {
    if (file.size > MAX_DRAFT_FILE_BYTES) {
      setNotice(t("草稿文件超过 5 MB，已停止导入", "The draft file is larger than 5 MB and was not imported"));
      return;
    }
    try {
      const parsed = parseDraftFile(await file.text());
      if (!parsed.course || !parsed.payload) {
        const message = parsed.error === "not-editable"
          ? t("已发布或已归档课程不能作为草稿导入；发布课程请从课程库安装或在 Studio 创建派生草稿", "Published or archived courses cannot be imported as drafts. Install published courses from Learn, or create a derived draft in Studio.")
          : t(`草稿文件格式无效${parsed.issues?.length ? `：${parsed.issues.length} 个问题` : ""}`, `Invalid draft file${parsed.issues?.length ? `: ${parsed.issues.length} issues` : ""}`);
        setNotice(message);
        return;
      }
      const nextDraftId = crypto.randomUUID();
      const saved = await draftApplication.saveRevision({
        draftId: nextDraftId,
        title: displayText(parsed.course.manifest.title),
        languageId: parsed.course.manifest.languageId,
        payload: parsed.payload,
        updatedAt: new Date().toISOString(),
      });
      const imported = saved.revision;
      setHistory(normalizeDraftHistory(saved.history));
      restore(imported);
      setEditorSection("overview");
      setLearningView("studio");
      setNotice(t(`已导入「${imported.title}」并保存为新的本地草稿`, `Imported “${imported.title}” as a new local draft`));
    } catch {
      setNotice(t("无法读取草稿文件", "The draft file could not be read"));
    }
  }

  function exportDraftRevision(item: DraftRevision) {
    const parsed = parseDraftFile(item.payload);
    if (!parsed.payload) {
      setNotice(t("这个修订已损坏，无法导出", "This revision is damaged and cannot be exported"));
      return;
    }
    const blob = new Blob([parsed.payload], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = draftFileName(item);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice(t(`已导出「${item.title}」修订 ${item.revision}`, `Exported “${item.title}” revision ${item.revision}`));
  }

  async function deleteLocalDraft(targetDraftId: string) {
    const target = history.find((item) => item.draftId === targetDraftId);
    if (!target) return;
    const warning = t(`确定删除「${target.title}」的全部本地修订吗？此操作无法撤销。`, `Delete every local revision of “${target.title}”? This cannot be undone.`);
    if (!window.confirm(warning)) return;
    try {
      const nextHistory = await draftApplication.deleteDraft(targetDraftId);
      setHistory(normalizeDraftHistory(nextHistory));
      if (draftId === targetDraftId) setDraftId(undefined);
      setNotice(t(`已删除「${target.title}」的本地草稿；当前编辑内容未被清空`, `Deleted the local draft “${target.title}”; the open editor content was kept`));
    } catch {
      setNotice(t("草稿删除失败", "The draft could not be deleted"));
    }
  }

  function usageForLanguagePack(languageId: string) {
    return languagePackUsage(
      languageId,
      course.manifest.languageId,
      draftLanguageIds,
      installedCourses.map((item) => item.manifest.languageId),
    );
  }

  async function importLanguagePackFile(file: File) {
    if (file.size > MAX_LANGUAGE_PACK_FILE_BYTES) {
      setNotice(t("Language Pack 文件超过 1 MB，已停止导入", "The Language Pack file is larger than 1 MB and was not imported"));
      return;
    }
    try {
      const parsed = parseLanguagePackFile(await file.text());
      if (!parsed.pack) {
        setNotice(parsed.error ? localizeRuntimeMessage(parsed.error, uiLocale) : t("Language Pack 无效", "Invalid Language Pack"));
        return;
      }
      const existing = languagePacks.find((item) => item.id === parsed.pack?.id);
      if (existing) {
        const usage = usageForLanguagePack(existing.id);
        const warning = usage.draftCount > 0 || usage.installedCourseCount > 0 || usage.activeEditor
          ? t(`「${languageName(existing, appLocale)}」仍被课程引用。替换定义可能改变分词和书写规则，确定继续吗？`, `“${languageName(existing, appLocale)}” is still referenced by courses. Replacing it may change segmentation and script behavior. Continue?`)
          : t(`确定替换现有的「${languageName(existing, appLocale)}」Language Pack 吗？`, `Replace the existing “${languageName(existing, appLocale)}” Language Pack?`);
        if (!window.confirm(warning)) return;
      }
      await languagePackApplication.import(parsed.pack, Boolean(existing));
      setLanguagePacks((current) => [...builtInLanguagePacks, parsed.pack!, ...current.filter((item) => !BUILT_IN_LANGUAGE_IDS.has(item.id) && item.id !== parsed.pack?.id)]);
      setNotice(t(`已导入「${languageName(parsed.pack, "zh-CN")}」Language Pack`, `Imported the “${languageName(parsed.pack, "en")}” Language Pack`));
    } catch (error) {
      if (error instanceof BuiltInLanguagePackMutationError) {
        setNotice(t("不能用文件覆盖应用内置 Language Pack", "A file cannot overwrite a built-in Language Pack"));
        return;
      }
      setNotice(t("无法读取 Language Pack 文件", "The Language Pack file could not be read"));
    }
  }

  function exportLanguagePack(pack: LanguagePack) {
    const blob = new Blob([serializeLanguagePackFile(pack)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = languagePackFileName(pack);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice(t(`已导出「${languageName(pack, "zh-CN")}」Language Pack`, `Exported the “${languageName(pack, "en")}” Language Pack`));
  }

  async function deleteLanguagePack(pack: LanguagePack) {
    const usage = usageForLanguagePack(pack.id);
    if (!usage.canDelete) {
      setNotice(t("这个 Language Pack 仍被当前编辑内容、草稿或已安装课程引用，不能删除", "This Language Pack is still used by the editor, a draft, or an installed course and cannot be deleted"));
      return;
    }
    if (!window.confirm(t(`确定删除「${languageName(pack, appLocale)}」Language Pack 吗？`, `Delete the “${languageName(pack, appLocale)}” Language Pack?`))) return;
    try {
      await languagePackApplication.remove(pack.id, usage);
      setLanguagePacks((current) => current.filter((item) => item.id !== pack.id));
      setNotice(t(`已删除「${languageName(pack, "zh-CN")}」Language Pack`, `Deleted the “${languageName(pack, "en")}” Language Pack`));
    } catch (error) {
      if (error instanceof BuiltInLanguagePackMutationError || error instanceof LanguagePackInUseError) {
        setNotice(t("这个 Language Pack 仍受内置保护或被课程引用，不能删除", "This Language Pack is built-in or still referenced by a course and cannot be deleted"));
        return;
      }
      setNotice(t("Language Pack 删除失败", "The Language Pack could not be deleted"));
    }
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

  async function saveLearningPlan(command: CreateLearningPlanCommand) {
    const plan = await learningPlanApplication.create(course, command);
    setPlansByCourse((current) => ({ ...current, [plan.courseId]: plan }));
    setNotice(t("个人学习计划已保存到当前设备", "Your learning plan was saved on this device"));
    return plan;
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
    if (compatibilityBlocked(languageCompatibility(course))) return;
    setLearningContext("preview");
    setLearningView("dashboard");
  }

  function selectLearningCourse(courseId: string) {
    const selected = learnCourses.find((item) => item.manifest.id === courseId);
    if (!selected) return;
    if (compatibilityBlocked(languageCompatibility(selected))) return;
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

  function activeStudioLessonId(next: CoursePack = course) {
    return next.lessons.find((lesson) => lesson.id === selectedStudioLessonId)?.id ?? next.lessons[0]?.id ?? "";
  }

  function addCourseLesson() {
    let createdId = "";
    editCourse((next) => {
      createdId = appendLesson(next, appLocale, t("新课节", "New lesson"));
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

  function openArticleImporter() {
    const languageId = language || languagePacks[0]?.id || "";
    setArticleForm({ languageId, title: "", text: "", url: "", kind: "article", useAi: false, rightsConfirmed: false });
    setArticleMaterials([]);
    setArticleError("");
    setArticleOpen(true);
  }

  function materialError(error: unknown) {
    const code = error instanceof Error ? error.message : "material-invalid";
    if (code === "material-file-too-large") return t("单个文件不能超过 10 MB", "Each file must be 10 MB or smaller");
    if (code === "material-file-unsupported") return t("不支持该文件格式；请使用 TXT、Markdown、HTML、SRT、VTT、LRC、PDF 或 DOCX", "Unsupported format. Use TXT, Markdown, HTML, SRT, VTT, LRC, PDF, or DOCX");
    if (code === "material-file-empty") return t("素材没有足够的可读文本", "The material does not contain enough readable text");
    return code.startsWith("material-") ? t("无法读取这份素材", "This material could not be read") : code;
  }

  function addPastedMaterial() {
    if (articleForm.text.trim().length < 20) { setArticleError(t("请至少粘贴一个完整段落", "Paste at least one complete paragraph")); return; }
    if (articleMaterials.length >= MAX_MATERIALS) { setArticleError(t("一门课程最多导入 12 份素材", "A course can contain up to 12 materials")); return; }
    const nextTitle = articleForm.title.trim() || t("粘贴素材 " + (articleMaterials.length + 1), "Pasted material " + (articleMaterials.length + 1));
    setArticleMaterials((current) => [...current, { id: crypto.randomUUID(), title: nextTitle, text: articleForm.text.trim(), kind: articleForm.kind, sourceLabel: t("粘贴文本", "Pasted text") }]);
    setArticleForm((current) => ({ ...current, text: "" }));
    setArticleError("");
  }

  async function importMaterialFiles(files: FileList | null) {
    if (!files?.length) return;
    setArticleBusy(true); setArticleError("");
    try {
      if (files.length > MAX_MATERIALS - articleMaterials.length) throw new Error(t("一门课程最多导入 12 份素材", "A course can contain up to 12 materials"));
      const imported = await Promise.all([...files].map((file) => extractMaterialFile(file)));
      setArticleMaterials((current) => [...current, ...imported]);
      if (!articleForm.title.trim() && imported[0]) setArticleForm((current) => ({ ...current, title: imported[0]!.title }));
    } catch (error) { setArticleError(materialError(error)); }
    finally { setArticleBusy(false); }
  }

  async function importMaterialUrl() {
    if (!articleForm.url.trim()) { setArticleError(t("请输入网页地址", "Enter a web address")); return; }
    if (articleMaterials.length >= MAX_MATERIALS) { setArticleError(t("一门课程最多导入 12 份素材", "A course can contain up to 12 materials")); return; }
    setArticleBusy(true); setArticleError("");
    try {
      const imported = await fetchMaterialUrl(articleForm.url.trim());
      setArticleMaterials((current) => [...current, imported]);
      setArticleForm((current) => ({ ...current, url: "", title: current.title || imported.title }));
    } catch (error) { setArticleError(materialError(error)); }
    finally { setArticleBusy(false); }
  }

  async function createArticleCourse() {
    const pack = languagePacks.find((item) => item.id === articleForm.languageId);
    if (!pack) { setArticleError(t("请先选择目标语言", "Choose a target language")); return; }
    if (!articleForm.rightsConfirmed) { setArticleError(t("请先确认你有权使用这些素材", "Confirm that you have permission to use these materials")); return; }
    const pending = articleForm.text.trim().length >= 20 ? [{ id: crypto.randomUUID(), title: articleForm.title.trim() || t("粘贴素材", "Pasted material"), text: articleForm.text.trim(), kind: articleForm.kind, sourceLabel: t("粘贴文本", "Pasted text") } satisfies CourseMaterial] : [];
    const materials = [...articleMaterials, ...pending];
    if (!materials.length) { setArticleError(t("请粘贴、上传或导入至少一份素材", "Paste, upload, or import at least one material")); return; }
    setArticleBusy(true); setArticleError("");
    try {
      let next = createCourseDraftFromMaterials({ languageId: pack.id, languageName: languageName(pack, appLocale), locale: appLocale, title: articleForm.title, materials });
      let aiWarning = "";
      if (articleForm.useAi) {
        if (!aiConfigured) throw new Error(t("请先在“个人 AI”中完成设置和连接测试", "Configure and test Personal AI first"));
        try {
          const enhancement = await requestCourseAuthoringEnhancement(aiSettings, next, teachingLocale);
          next = applyCourseAuthoringEnhancement(next, enhancement, teachingLocale);
        } catch (error) { aiWarning = t("；AI 增强失败，已保留本地结果：" + materialError(error), "; AI enhancement failed; local output was kept: " + materialError(error)); }
      }
      setLanguage(pack.id); setStudioStarted(true); setDraftId(crypto.randomUUID());
      setSelectedStudioLessonId(next.lessons[0]!.id); setSelectedUnitId(next.units?.[0]?.id ?? "unit-1");
      setEditorMode("visual"); setEditorSection("overview");
      commitCourse(next, t("已生成 " + next.units!.length + " 个单元、" + next.knowledge.length + " 个候选知识点和 " + next.exercises.length + " 个练习；发布前请复核难度、释义与答案" + aiWarning, "Created " + next.units!.length + " units, " + next.knowledge.length + " candidate knowledge items, and " + next.exercises.length + " exercises. Review level, meanings, and answers before publishing" + aiWarning));
      setArticleOpen(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : "article-invalid";
      setArticleError(code === "article-title-required" ? t("请填写课程标题", "Enter a course title") : code === "article-too-short" ? t("素材内容过短，请至少提供一个完整段落", "The material is too short. Provide at least one complete paragraph") : code === "article-too-large" ? t("全部素材合计不能超过 " + MAX_MATERIAL_CHARACTERS.toLocaleString() + " 个字符", "Combined materials cannot exceed " + MAX_MATERIAL_CHARACTERS.toLocaleString() + " characters") : materialError(error));
    } finally { setArticleBusy(false); }
  }

  async function performDeviceSync(resolution?: "keep-local" | "use-remote") {
    if (!syncSettings.endpoint.trim() || !syncSettings.profileId.trim()) {
      setSyncStatus({ state: "error", message: t("请填写同步服务地址和档案 ID", "Enter a sync endpoint and profile ID") });
      return;
    }
    try {
      const endpoint = new URL(syncSettings.endpoint);
      const localEndpoint = ["localhost", "127.0.0.1", "::1"].includes(endpoint.hostname);
      if (window.location.protocol === "https:" && endpoint.protocol !== "https:" && !localEndpoint) {
        throw new Error(t("公开网站只能连接 HTTPS 同步服务", "The public site can connect only to an HTTPS sync service"));
      }
    } catch (error) {
      setSyncStatus({ state: "error", message: error instanceof Error ? error.message : t("同步服务地址无效", "The sync endpoint is invalid") });
      return;
    }
    setSyncStatus({ state: "syncing", message: t("正在安全同步…", "Syncing safely…") });
    await putDeviceValue("preferences", "sync-settings", syncSettings);
    if (syncToken.trim()) sessionStorage.setItem(SYNC_TOKEN_SESSION_KEY, syncToken.trim());
    else sessionStorage.removeItem(SYNC_TOKEN_SESSION_KEY);
    try {
      const result = await runDeviceSync(syncSettings, syncToken.trim() || undefined, resolution ? syncStatus.conflicts : undefined, resolution);
      if (result.conflicts.length > 0) {
        setSyncStatus({ state: "conflict", conflicts: result.conflicts, message: t(`${result.conflicts.length} 项内容在其他设备上也有修改，请选择保留哪一侧`, `${result.conflicts.length} items were also changed on another device. Choose which side to keep`) });
        return;
      }
      const [nextHistory, customPacks, nextRecords, nextCourses] = await Promise.all([
        draftApplication.list(), languagePackApplication.list(), profileBackupApplication.snapshot(), installedCourseRepository.list(),
      ]);
      setHistory(normalizeDraftHistory(nextHistory));
      setLanguagePacks([...builtInLanguagePacks, ...customPacks.filter((pack) => !BUILT_IN_LANGUAGE_IDS.has(pack.id))]);
      setRecordsByCourse(Object.fromEntries(nextRecords.map((record) => [record.courseId, record])));
      setInstalledCourses([...nextCourses]);
      setSyncStatus({ state: "success", message: t(`同步完成：上传 ${result.pushed} 项，接收 ${result.pulled} 项`, `Sync complete: ${result.pushed} uploaded, ${result.pulled} received`) });
    } catch (error) {
      setSyncStatus({ state: "error", message: error instanceof Error ? error.message : t("同步失败，请检查服务配置", "Sync failed. Check the service settings") });
    }
  }

  function applyCourseTemplate(templateId: CourseTemplateId) {
    if (!window.confirm(t("应用模板会替换当前编辑器内容，尚未保存的修改将丢失。继续吗？", "Applying a template replaces the editor contents and discards unsaved changes. Continue?"))) return;
    const next = createCourseFromTemplate(templateId, language, appLocale);
    setDraftId(crypto.randomUUID());
    setSelectedStudioLessonId(next.lessons[0]?.id ?? "");
    commitCourse(next, t("课程模板已载入", "Course template loaded"));
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

  async function saveLanguagePack() {
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
    const result = parseLanguagePackFile(json);
    if (!result.pack) {
      setLanguageError(result.error ? localizeRuntimeMessage(result.error, uiLocale) : t("Language Pack 无效", "Invalid Language Pack"));
      return;
    }
    const pack = result.pack;
    const existing = languagePacks.find((item) => !BUILT_IN_LANGUAGE_IDS.has(item.id) && item.id === pack.id);
    if (existing && !window.confirm(t(`确定替换现有的「${languageName(existing, appLocale)}」Language Pack 吗？`, `Replace the existing “${languageName(existing, appLocale)}” Language Pack?`))) return;
    try {
      await languagePackApplication.import(pack, Boolean(existing));
    } catch (error) {
      setLanguageError(error instanceof BuiltInLanguagePackMutationError
        ? t("不能覆盖应用内置 Language Pack", "A built-in Language Pack cannot be overwritten")
        : t("Language Pack 保存失败", "The Language Pack could not be saved"));
      return;
    }
    const custom = languagePacks.filter((item) => !BUILT_IN_LANGUAGE_IDS.has(item.id) && item.id !== pack.id);
    const nextCustom = [...custom, pack];
    setLanguagePacks([...builtInLanguagePacks, ...nextCustom]);
    setLanguageOpen(false);
    setLanguageError("");
    setLanguageForm(defaultLanguageForm);
    setLanguageJson("");
    loadLanguage(pack);
    setNotice(t(`${languageName(pack, "zh-CN")} Language Pack 已保存并创建入门课程`, `${languageName(pack, "en")} Language Pack saved and starter course created`));
  }

  const currentLanguage = languagePacks.find((item) => item.id === language);
  const liveValidationIssues = useMemo(() => validateCourse(source).issues, [source]);
  const publishReadiness = useMemo(
    () => assessPublishReadiness(course, appLocale, liveValidationIssues, Boolean(currentLanguage)),
    [course, appLocale, liveValidationIssues, currentLanguage],
  );
  const selectedStudioLessonIndex = Math.max(0, course.lessons.findIndex((lesson) => lesson.id === selectedStudioLessonId));
  const selectedStudioLesson = course.lessons[selectedStudioLessonIndex];
  const flow = selectedStudioLesson?.steps ?? [];
  const knowledgeOptions = course.knowledge.map((item) => ({ id: item.id, label: item.form || t("未命名知识点", "Untitled knowledge") }));
  const utteranceOptions = course.utterances.map((item, index) => ({ id: item.id, label: item.text || t("Utterance " + (index + 1), "Utterance " + (index + 1)) }));
  const exerciseOptions = course.exercises.map((item, index) => ({ id: item.id, label: displayText(item.prompt, teachingLocale) || t("Exercise " + (index + 1), "Exercise " + (index + 1)) }));
  const goalOptions = course.goals.map((item, index) => ({ id: item.id, label: displayText(item.description, teachingLocale) || t("Goal " + (index + 1), "Can-do goal " + (index + 1)) }));
  const activeRecords = learningContext === "preview" ? previewRecordsByCourse : recordsByCourse;
  const currentRecord = activeRecords[course.manifest.id];
  const currentPlan = learningContext === "learn" ? plansByCourse[course.manifest.id] : undefined;
  const currentAgenda = hydrated && currentPlan ? courseAdaptiveAgenda(course, currentRecord, currentPlan) : undefined;
  const currentPercent = courseLearningPercent(course, currentRecord);
  const dueReviewCount = currentRecord ? reviewsDue(currentRecord).length : 0;
  const ongoingLesson = course.lessons.find((lesson) => currentRecord?.lessonProgress[lesson.id]?.status === "active");
  const selectedProgress = selectedLessonId ? currentRecord?.lessonProgress[selectedLessonId] : undefined;
  const productGuide = <ProductGuide key={`${guideAudience}:${guideOpen ? "open" : "closed"}`} open={guideOpen} audience={guideAudience} locale={appLocale} onClose={closeProductGuide} />;

  if (learningView === "library") {
    return <><CourseLibrary entries={courseLibrary} languagePacks={languagePacks} locale={appLocale} notice={notice} onLocaleChange={changeAppLocale} onOpenHelp={() => openProductGuide("learn")} onBack={returnToLearningHome} onStart={(entry) => void startLibraryCourse(entry)} onUpdate={(entry) => void updateLibraryCourse(entry)} onUninstall={(entry) => void uninstallLibraryCourse(entry)} onOpen={openLibraryCourse} onImportFile={(file) => void importCourseFile(file)} onCreateCourse={() => window.location.assign("/studio")} onExport={exportLibraryCourse} recordCount={Object.keys(recordsByCourse).length} planCount={Object.keys(plansByCourse).length} onExportProfile={exportLearnerProfile} onImportProfile={(file) => void importLearnerProfile(file)} syncSettings={syncSettings} syncToken={syncToken} syncStatus={syncStatus} onSyncSettingsChange={setSyncSettings} onSyncTokenChange={setSyncToken} onSync={() => void performDeviceSync()} onResolveSync={(resolution) => void performDeviceSync(resolution)} />{productGuide}</>;
  }
  if (learningView === "drafts") {
    return <><DraftManager history={history} locale={appLocale} notice={notice} onLocaleChange={changeAppLocale} onBack={() => setLearningView("studio")} onRestore={restoreFromDraftManager} onDelete={(targetDraftId) => void deleteLocalDraft(targetDraftId)} onImport={(file) => void importDraftFile(file)} onExport={exportDraftRevision} />{productGuide}</>;
  }
  if (learningView === "languages") {
    return <><LanguagePackManager packs={languagePacks} builtInIds={BUILT_IN_LANGUAGE_IDS} locale={appLocale} notice={notice} usageFor={usageForLanguagePack} onLocaleChange={changeAppLocale} onBack={() => setLearningView("studio")} onCreate={() => { setLearningView("studio"); setLanguageOpen(true); }} onImport={(file) => void importLanguagePackFile(file)} onExport={exportLanguagePack} onDelete={(pack) => void deleteLanguagePack(pack)} />{productGuide}</>;
  }
  if (learningView === "plan") {
    return <><LearningPlanSetup course={course} locale={appLocale} existingPlan={plansByCourse[course.manifest.id]} onSave={saveLearningPlan} onStart={openLesson} onCancel={() => setLearningView(recordsByCourse[course.manifest.id] ? "dashboard" : "library")} />{productGuide}</>;
  }
  if (learningView === "dashboard") {
    return <><LearningDashboard course={course} courses={learningContext === "learn" ? learnCourses : [course]} languagePack={currentLanguage} record={currentRecord} learningPlan={currentPlan} agenda={currentAgenda} locale={appLocale} onLocaleChange={changeAppLocale} preview={learningContext === "preview"} onSelectCourse={selectLearningCourse} onOpenLibrary={() => setLearningView("library")} onOpenPlan={learningContext === "learn" ? () => setLearningView("plan") : undefined} onOpenHelp={() => openProductGuide(learningContext === "preview" ? "studio" : "learn")} onBack={() => learningContext === "preview" ? setLearningView("studio") : window.location.assign("/studio")} onStartLesson={openLesson} onStartReview={openReview} />{productGuide}</>;
  }
  if (learningView === "lesson" && selectedProgress) {
    return <><LearningPlayer course={course} languagePack={currentLanguage} locale={appLocale} initialProgress={selectedProgress} preview={learningContext === "preview"} aiSettings={aiConfigured ? aiSettings : undefined} onProgress={storeLessonProgress} onExit={() => setLearningView("dashboard")} />{productGuide}</>;
  }
  if (learningView === "review" && currentRecord) {
    return <><ReviewPlayer course={course} locale={appLocale} initialRecord={currentRecord} tasks={reviewTasks} preview={learningContext === "preview"} onRecord={storeCourseRecord} onExit={() => setLearningView("dashboard")} />{productGuide}</>;
  }

  return (
    <main className={`studio-shell ${!studioStarted ? "studio-start-mode" : ""}`}>
      {!studioStarted ? (
        <StudioStart packs={languagePacks} locale={appLocale} draftCount={history.length} onLocaleChange={changeAppLocale} onCreateLanguage={() => setLanguageOpen(true)} onImportDraft={(file) => void importDraftFile(file)} onImportArticle={openArticleImporter} onUseLanguage={loadLanguage} onOpenDrafts={() => setLearningView("drafts")} />
      ) : <>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Languages size={20} /></div>
          <div><strong>LearnLanguage</strong><span>COURSE STUDIO</span></div>
        </div>
        <div className="product-mode-switch studio-mode-switch" aria-label={t("切换产品空间", "Switch product space")}>
          <button type="button" onClick={enterLearningSpace}><GraduationCap size={16} /><span>{t("学习", "Learn")}</span></button>
          <button className="active" type="button"><BookOpen size={16} /><span>Studio</span></button>
        </div>
        <nav className="side-nav" aria-label={t("工作台导航", "Studio navigation")}>
          <a className="nav-item active" href="/studio"><BookOpen size={18} /><span>{t("课程编辑器", "Course editor")}</span></a>
          <button className="nav-item" onClick={() => setLearningView("drafts")}><Clock3 size={18} /><span>{t("本地草稿", "Local drafts")}</span><em>{history.length}</em></button>
          <button className="nav-item" onClick={() => setLearningView("languages")}><Languages size={18} /><span>{t("语言包管理", "Language Packs")}</span><em>{languagePacks.length}</em></button>
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
        <nav className="mobile-workspace-nav studio-mobile-nav" aria-label={t("工作台导航", "Studio navigation")}>
          <a className="active" href="/studio"><BookOpen size={15} />{t("课程编辑器", "Course editor")}</a>
          <button type="button" onClick={() => setLearningView("drafts")}><Clock3 size={15} />{t("本地草稿", "Local drafts")}</button>
          <button type="button" onClick={() => setLearningView("languages")}><Languages size={15} />{t("语言包", "Language Packs")}</button>
        </nav>

        <header className="topbar">
          <div>
            <div className="eyebrow"><span className="status-dot" />{t("无需登录 · 设备本地", "No sign-in · device local")}</div>
            <h1>{displayText(course.manifest.title, teachingLocale)}</h1>
          </div>
          <div className="top-actions">
            <div className="locale-selectors studio-locale-selectors"><label className="teaching-language-select"><Languages size={16} /><span>{t("界面与讲解", "Interface & instruction")}</span><select value={appLocale} onChange={(event) => changeAppLocale(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label></div>
            <button className="outline-button help-button" onClick={() => openProductGuide("studio")}><CircleHelp size={17} />{t("使用帮助", "Guide")}</button>
            <button className="outline-button" onClick={openArticleImporter}><FileText size={17} />{t("素材生成课程", "Materials to course")}</button>
            <button className="ai-button" onClick={() => setAiOpen(true)}><Bot size={17} />{t("AI 设置", "AI settings")}<span className={`ai-state ${aiConfigured ? "configured" : ""}`} /></button>
            {course.manifest.status === "published" ? <><button className="outline-button" onClick={installCurrentCourse}><GraduationCap size={17} />{t("安装到学习空间", "Install in Learn")}</button><button className="save-button" onClick={forkCurrentCourse}><RotateCcw size={17} />{t("创建派生草稿", "Create derived draft")}</button></> : <><button className="outline-button" onClick={publishCurrentCourse} disabled={publishing}>{publishing ? t("正在发布…", "Publishing…") : t("校验并发布", "Validate and publish")}</button><button className="save-button" onClick={saveDraft} disabled={saving}><Save size={17} />{saving ? t("正在保存…", "Saving…") : t("保存草稿", "Save draft")}</button></>}
          </div>
        </header>

        <div className="status-strip">
          <div><ShieldCheck size={16} /><span>{notice}</span></div>
          <span className="schema-pill">Schema v{course.schemaVersion}</span>
          {course.manifest.status === "draft" && <span className={`autosave-state ${autoSaveState}`}>{autoSaveState === "saving" ? t("自动保存中…", "Auto-saving…") : autoSaveState === "error" ? t("自动保存失败", "Auto-save failed") : autoSaveState === "saved" ? t("修改已自动保存", "Changes auto-saved") : t("等待自动保存", "Waiting to auto-save")}</span>}
        </div>

        <div className="work-grid">
          <section className="editor-panel panel">
            <div className="panel-heading editor-heading">
              <div><span className="kicker">COURSE PACK</span><h2>{t("课程内容编辑", "Course content editor")}</h2></div>
              <div className="mode-switch" aria-label={t("编辑方式", "Editing mode")}>
                <button className={editorMode === "visual" ? "active" : ""} onClick={() => setEditorMode("visual")}><BookOpen size={14} />{t("可视化", "Visual")}</button>
                <button className={editorMode === "json" ? "active" : ""} onClick={() => setEditorMode("json")}><Braces size={14} />JSON</button>
                {editorMode === "visual" && <button className={showAdvanced ? "active" : ""} onClick={() => setShowAdvanced((value) => !value)}><SlidersHorizontal size={14} />{t("进阶字段", "Advanced")}</button>}
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
                      {course.manifest.status !== "published" && <div className="template-strip"><div><LayoutTemplate size={17} /><span><strong>{t("从课程模板开始", "Start from a course template")}</strong><small>{t("模板只创建可编辑内容，不会覆盖已保存草稿", "Templates create editable content and do not overwrite saved drafts")}</small></span></div><aside>{courseTemplates.map((template) => <button key={template.id} type="button" onClick={() => applyCourseTemplate(template.id)} title={t(template.descriptionZh, template.descriptionEn)}>{t(template.zh, template.en)}</button>)}</aside></div>}
                      <div className="form-grid two-column">
                        {showAdvanced && <label><span>{t("课程 ID", "Course ID")}</span><input value={course.manifest.id} onChange={(event) => editCourse((next) => { next.manifest.id = event.target.value; })} /></label>}
                        {showAdvanced && <label><span>{t("版本", "Version")}</span><input value={course.manifest.version} onChange={(event) => editCourse((next) => { next.manifest.version = event.target.value; })} /></label>}
                        <label className="wide"><span>{t("课程名称", "Course title")}（{teachingLocale === "en" ? "English" : "中文"}）</span><input value={course.manifest.title[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.manifest.title[teachingLocale] = event.target.value; })} /></label>
                        <label className="wide"><span>{t("课程简介", "Course description")}（{teachingLocale === "en" ? "English" : "中文"}）</span><textarea value={course.manifest.description[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.manifest.description[teachingLocale] = event.target.value; })} /></label>
                        {showAdvanced && <label><span>{t("状态", "Status")}</span><input value={course.manifest.status === "published" ? t("已发布 · 只读", "Published · read-only") : t("草稿", "Draft")} readOnly /></label>}
                        <label><span>{t("作者显示名", "Author display name")}</span><input value={course.manifest.author.displayName} onChange={(event) => editCourse((next) => { next.manifest.author.displayName = event.target.value; })} /></label>
                        <label><span>{t("课程内容许可证", "Course content license")}</span><select value={course.manifest.license?.id ?? ""} onChange={(event) => editCourse((next) => { const id = event.target.value; if (id) next.manifest.license = { id }; else delete next.manifest.license; })}><option value="">{t("发布前必须选择", "Required before publishing")}</option><option value="CC-BY-4.0">CC BY 4.0</option><option value="CC-BY-SA-4.0">CC BY-SA 4.0</option><option value="CC0-1.0">CC0 1.0</option><option value="ARR">{t("保留所有权利", "All rights reserved")}</option></select></label>
                      </div>
                      {course.manifest.status !== "published" && <section className="publish-checklist"><header><div><ClipboardCheck size={18} /><span><strong>{t("发布检查清单", "Publishing checklist")}</strong><small>{t("阻塞项全部完成后才可发布；建议项不会阻止发布", "Complete every blocker before publishing; recommendations do not block publishing")}</small></span></div><em className={canPublish(publishReadiness) ? "ready" : "blocked"}>{canPublish(publishReadiness) ? t("可以发布", "Ready") : t("需要完善", "Needs work")}</em></header><div>{publishReadiness.map((check) => <p className={check.status} key={check.id}>{check.status === "pass" ? <Check size={14} /> : <TriangleAlert size={14} />}<span>{t(check.zh, check.en)}</span></p>)}</div></section>}
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
                              <ReferencePicker label={t("关联知识点", "Related knowledge")} options={knowledgeOptions} selected={item.knowledgeRefs} emptyLabel={t("请先添加知识点", "Add knowledge first")} onChange={(ids) => editCourse((next) => { next.utterances[index].knowledgeRefs = ids; })} />
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
                              <label><span>{t("类型", "Type")}</span><select value={item.kind} onChange={(event) => changeExerciseKind(index, event.target.value as ExerciseKind)}><option value="single-choice">{t("单选理解", "Single choice")}</option><option value="multiple-choice">{t("多选理解", "Multiple choice")}</option><option value="ordering">{t("排序", "Ordering")}</option><option value="fill-blank">{t("填空", "Fill in the blank")}</option><option value="short-input">{t("简短输入", "Short input")}</option><option value="cloze">{t("完形填空", "Cloze")}</option><option value="substitution">{t("替换表达", "Substitution")}</option><option value="reconstruction">{t("重组表达", "Reconstruction")}</option><option value="matching">{t("匹配", "Matching")}</option><option value="role-play">{t("角色扮演", "Role-play")}</option><option value="free-response">{t("自由回答", "Free response")}</option></select></label>
                              <label className="wide"><span>{t("任务提示", "Task prompt")}（{teachingLocale === "en" ? "English" : "中文"}）</span><textarea value={item.prompt[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.exercises[index].prompt[teachingLocale] = event.target.value; })} /></label>
                              {["single-choice", "multiple-choice", "ordering"].includes(item.kind) && <label className="wide"><span>{t("选项（每行一个）", "Options (one per line)")}（{teachingLocale === "en" ? "English" : "中文"}）</span><textarea value={localizedOptionLines(item.options, teachingLocale)} onChange={(event) => updateExerciseOptions(index, event.target.value)} placeholder={t("第一项\n第二项", "First item\nSecond item")} /></label>}
                              {item.kind === "single-choice" && <label><span>{t("正确选项", "Correct option")}</span><select value={item.correctOptionIndex ?? 0} onChange={(event) => editCourse((next) => { next.exercises[index].correctOptionIndex = Number(event.target.value); })}>{(item.options ?? []).map((option, optionIndex) => <option value={optionIndex} key={optionIndex}>{optionIndex + 1}. {displayText(option, teachingLocale)}</option>)}</select></label>}
                              {item.kind === "multiple-choice" && <label><span>{t("正确选项序号（逗号分隔）", "Correct option numbers (comma-separated)")}</span><input value={(item.correctOptionIndices ?? []).map((value) => value + 1).join(", ")} onChange={(event) => editCourse((next) => { next.exercises[index].correctOptionIndices = [...new Set(splitRefs(event.target.value).map(Number).filter((value) => Number.isInteger(value) && value > 0).map((value) => value - 1))]; })} placeholder="1, 3" /></label>}
                              {item.kind === "ordering" && <label><span>{t("正确顺序", "Correct order")}</span><input value={t("按上方行顺序", "Same as the line order above")} readOnly /></label>}
                              {!["single-choice", "multiple-choice", "ordering"].includes(item.kind) && <label className="wide"><span>{t("可接受答案（可选，每行一个）", "Accepted answers (optional, one per line)")}</span><textarea value={item.acceptedAnswers?.join("\n") ?? ""} onChange={(event) => editCourse((next) => { const answers = splitLines(event.target.value); if (answers.length) next.exercises[index].acceptedAnswers = answers; else delete next.exercises[index].acceptedAnswers; })} placeholder={t("留空时使用自评或 AI 反馈", "Leave empty to use self-assessment or AI feedback")} /></label>}
                              <label className="wide"><span>{t("作答提示（可选）", "Learner support (optional)")}（{teachingLocale === "en" ? "English" : "中文"}）</span><textarea value={item.guidance?.[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { next.exercises[index].guidance = { ...(next.exercises[index].guidance ?? {}), [teachingLocale]: event.target.value }; })} /></label>
                              <ReferencePicker label={t("练习涉及的知识点", "Knowledge used by this exercise")} options={knowledgeOptions} selected={item.knowledgeRefs} emptyLabel={t("暂无知识点，可稍后添加", "No knowledge yet; you can add it later")} onChange={(ids) => editCourse((next) => { next.exercises[index].knowledgeRefs = ids; })} />
                              <ReferencePicker label={t("练习使用的例句", "Utterances used by this exercise")} options={utteranceOptions} selected={item.utteranceRefs} emptyLabel={t("请先添加例句", "Add utterances first")} onChange={(ids) => editCourse((next) => { next.exercises[index].utteranceRefs = ids; })} />
                              {showAdvanced && <><label><span>{t("所需语言能力（逗号分隔）", "Required language capabilities (comma-separated)")}</span><input placeholder={t("例如 token-comparison", "For example: token-comparison")} value={item.requiredCapabilities?.join(", ") ?? ""} onChange={(event) => editCourse((next) => { const capabilities = splitRefs(event.target.value) as NonNullable<CoursePack["exercises"][number]["requiredCapabilities"]>; if (capabilities.length) next.exercises[index].requiredCapabilities = capabilities; else delete next.exercises[index].requiredCapabilities; })} /></label><label><span>{t("能力不足时", "When capabilities are missing")}</span><select value={item.capabilityFallback ?? "self-assessment"} onChange={(event) => editCourse((next) => { next.exercises[index].capabilityFallback = event.target.value as NonNullable<CoursePack["exercises"][number]["capabilityFallback"]>; })}><option value="self-assessment">{t("学习者自评", "Learner self-assessment")}</option><option value="reference-answer">{t("显示参考答案", "Show reference answer")}</option><option value="disabled">{t("跳过且不计证据", "Skip without evidence")}</option></select></label></>}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {editorSection === "flow" && (
                    <div className="form-section">
                      <div className="section-intro"><div><h3>{t("课程单元与课节", "Course units and lessons")}</h3><p>{t("先用单元组织课程，再为每个课节选择目标、材料和练习。技术 ID 会由系统自动维护。", "Organize the course into units, then choose goals, materials, and exercises for each lesson. Technical IDs are managed automatically.")}</p></div><div className="section-actions"><button className="outline-button" onClick={addCourseUnit}><Plus size={15} />{t("添加单元", "Add unit")}</button><button className="outline-button" onClick={addCourseLesson}><Plus size={15} />{t("添加课节", "Add lesson")}</button><button className="outline-button" onClick={addStep}><Plus size={15} />{t("添加步骤", "Add step")}</button></div></div>
                      <section className="unit-manager" aria-label={t("课程单元", "Course units")}>
                        {(course.units ?? []).map((unit, index) => (
                          <article className={unit.id === selectedUnitId ? "unit-card active" : "unit-card"} key={unit.id} onClick={() => setSelectedUnitId(unit.id)}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <label><small>{t("单元名称", "Unit title")}</small><input value={unit.title[teachingLocale] ?? ""} onFocus={() => setSelectedUnitId(unit.id)} onChange={(event) => editCourse((next) => { renameUnit(next, unit.id, teachingLocale, event.target.value); })} /></label>
                            <em>{t(unit.lessonRefs.length + " 课", unit.lessonRefs.length + " lessons")}</em>
                            <div className="unit-actions"><button type="button" onClick={(event) => { event.stopPropagation(); moveCourseUnit(unit.id, -1); }} disabled={index === 0} aria-label={t("单元前移", "Move unit earlier")}><ArrowUp size={14} /></button><button type="button" onClick={(event) => { event.stopPropagation(); moveCourseUnit(unit.id, 1); }} disabled={index === (course.units?.length ?? 0) - 1} aria-label={t("单元后移", "Move unit later")}><ArrowDown size={14} /></button><button type="button" className="danger" onClick={(event) => { event.stopPropagation(); deleteCourseUnit(unit.id); }} disabled={(course.units?.length ?? 0) <= 1} aria-label={t("删除单元", "Delete unit")}><Trash2 size={14} /></button></div>
                          </article>
                        ))}
                      </section>
                      <div className="lesson-sequence" role="tablist" aria-label={t("课程课节顺序", "Course lesson order")}>
                        {course.lessons.map((lesson, index) => <button type="button" role="tab" aria-selected={lesson.id === selectedStudioLesson?.id} className={lesson.id === selectedStudioLesson?.id ? "active" : ""} key={lesson.id} onClick={() => setSelectedStudioLessonId(lesson.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{displayText(lesson.title, teachingLocale)}</strong><small>{t(lesson.steps.length + " 步", lesson.steps.length + " steps")}</small></div></button>)}
                      </div>
                      {selectedStudioLesson && <div className="selected-lesson-panel">
                        <div className="selected-lesson-heading"><div><span>{t("正在编辑第 " + (selectedStudioLessonIndex + 1) + " 课", "Editing lesson " + (selectedStudioLessonIndex + 1))}</span><strong>{displayText(selectedStudioLesson.title, teachingLocale)}</strong></div><div><button type="button" onClick={duplicateCourseLesson} aria-label={t("复制当前课节", "Duplicate current lesson")}><Copy size={15} /></button><button type="button" onClick={() => moveCourseLesson(-1)} disabled={selectedStudioLessonIndex === 0} aria-label={t("课节前移", "Move lesson earlier")}><ArrowUp size={15} /></button><button type="button" onClick={() => moveCourseLesson(1)} disabled={selectedStudioLessonIndex === course.lessons.length - 1} aria-label={t("课节后移", "Move lesson later")}><ArrowDown size={15} /></button><button type="button" className="danger" onClick={deleteCourseLesson} disabled={course.lessons.length <= 1} aria-label={t("删除当前课节", "Delete current lesson")}><Trash2 size={15} /></button></div></div>
                        <div className="form-grid two-column lesson-fields">
                          <label><span>{t("课节名称", "Lesson title")} ({teachingLocale === "en" ? "English" : "中文"})</span><input value={selectedStudioLesson.title[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.title[teachingLocale] = event.target.value; })} /></label>
                          <label><span>{t("所属单元", "Unit")}</span><select value={(course.units ?? []).find((unit) => unit.lessonRefs.includes(selectedStudioLesson.id))?.id ?? ""} onChange={(event) => setLessonUnit(selectedStudioLesson.id, event.target.value)}>{(course.units ?? []).map((unit) => <option key={unit.id} value={unit.id}>{displayText(unit.title, teachingLocale)}</option>)}</select></label>
                          <ReferencePicker label={t("本课学习目标", "Learning goals for this lesson")} options={goalOptions} selected={selectedStudioLesson.canDoGoalRefs} emptyLabel={t("暂无能力目标，可在 JSON 进阶模式补充", "No can-do goals yet; add them in advanced JSON mode")} onChange={(ids) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.canDoGoalRefs = ids; })} />
                        </div>
                      </div>}
                      <div className="item-stack compact">
                        {flow.map((step, index) => (
                          <article className="edit-card flow-edit-card" key={step.id}>
                            <div className="step-number">{String(index + 1).padStart(2, "0")}</div>
                            <div className="form-grid two-column">
                              <label><span>{t("阶段", "Phase")}</span><select value={step.phase} onChange={(event) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.steps[index].phase = event.target.value as LessonPhase; })}><option value="diagnostic">{t("诊断", "Diagnostic")}</option><option value="preteach">{t("预教", "Pre-teaching")}</option><option value="supported-input">{t("支持性输入", "Supported input")}</option><option value="comprehension">{t("独立理解", "Comprehension")}</option><option value="guided-output">{t("引导输出", "Guided output")}</option><option value="independent-task">{t("独立任务", "Independent task")}</option><option value="feedback-retry">{t("反馈重试", "Feedback retry")}</option><option value="delayed-transfer">{t("延迟迁移", "Delayed transfer")}</option></select></label>
                              <label><span>{t("显示标题", "Display title")} ({teachingLocale === "en" ? "English" : "中文"})</span><input value={step.title[teachingLocale] ?? ""} onChange={(event) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.steps[index].title[teachingLocale] = event.target.value; })} /></label>
                              <ReferencePicker label={t("本步骤知识点", "Knowledge in this step")} options={knowledgeOptions} selected={step.knowledgeRefs} emptyLabel={t("暂无知识点", "No knowledge yet")} onChange={(ids) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.steps[index].knowledgeRefs = ids; })} />
                              <ReferencePicker label={t("本步骤例句", "Utterances in this step")} options={utteranceOptions} selected={step.utteranceRefs} emptyLabel={t("暂无例句", "No utterances yet")} onChange={(ids) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.steps[index].utteranceRefs = ids; })} />
                              <ReferencePicker label={t("本步骤练习", "Exercises in this step")} options={exerciseOptions} selected={step.exerciseRefs} emptyLabel={t("暂无练习", "No exercises yet")} onChange={(ids) => editCourse((next) => { const lesson = selectedDraftLesson(next); if (lesson) lesson.steps[index].exerciseRefs = ids; })} />
                            </div>
                            <div className="step-actions"><button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label={t("上移步骤 " + (index + 1), "Move step " + (index + 1) + " up")}><ArrowUp size={14} /></button><button type="button" onClick={() => moveStep(index, 1)} disabled={index === flow.length - 1} aria-label={t("下移步骤 " + (index + 1), "Move step " + (index + 1) + " down")}><ArrowDown size={14} /></button><button type="button" className="danger" onClick={() => removeStep(index)} disabled={flow.length <= 1} aria-label={t("删除步骤 " + (index + 1), "Delete step " + (index + 1))}><Trash2 size={14} /></button></div>
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
      </>}

      {articleOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="ai-dialog article-dialog material-dialog" role="dialog" aria-modal="true" aria-labelledby="article-dialog-title">
            <div className="dialog-heading"><div className="dialog-icon"><FileText size={20} /></div><div><span className="kicker">MATERIAL TO COURSE</span><h2 id="article-dialog-title">{t("导入素材生成课程草稿", "Create a course draft from materials")}</h2></div><button className="icon-button" onClick={() => setArticleOpen(false)} aria-label={t("关闭素材导入", "Close material import")}><X size={18} /></button></div>
            <div className="dialog-body">
              <div className="form-grid two-column">
                <label><span>{t("目标语言", "Target language")}</span><select value={articleForm.languageId} onChange={(event) => setArticleForm((current) => ({ ...current, languageId: event.target.value }))}><option value="">{t("请选择", "Choose a language")}</option>{languagePacks.map((pack) => <option key={pack.id} value={pack.id}>{languageName(pack, appLocale)}</option>)}</select></label>
                <label><span>{t("课程标题", "Course title")}</span><input value={articleForm.title} onChange={(event) => setArticleForm((current) => ({ ...current, title: event.target.value }))} placeholder={t("例如：城市生活素材课", "For example: City life materials")} /></label>
              </div>
              <div className="material-source-grid">
                <section className="material-source-card">
                  <div className="material-card-heading"><strong>{t("粘贴文本", "Paste text")}</strong><select aria-label={t("素材类型", "Material type")} value={articleForm.kind} onChange={(event) => setArticleForm((current) => ({ ...current, kind: event.target.value as MaterialKind }))}><option value="article">{t("文章", "Article")}</option><option value="dialogue">{t("对话", "Dialogue")}</option><option value="lyrics">{t("歌词", "Lyrics")}</option><option value="subtitle">{t("字幕", "Subtitles")}</option><option value="document">{t("文档", "Document")}</option></select></div>
                  <textarea aria-label={t("素材正文", "Material text")} className="article-textarea" dir={languagePacks.find((pack) => pack.id === articleForm.languageId)?.scripts[0]?.direction ?? "ltr"} value={articleForm.text} maxLength={MAX_MATERIAL_CHARACTERS} onChange={(event) => { setArticleForm((current) => ({ ...current, text: event.target.value })); setArticleError(""); }} placeholder={t("粘贴你有权使用的文章、对话、歌词或字幕。歌词和字幕会保留原分行。", "Paste an article, dialogue, lyrics, or subtitles you can use. Lyrics and subtitles keep their line breaks.")} />
                  <div className="material-card-actions"><small>{articleForm.text.length.toLocaleString()} {t("字符", "characters")}</small><button className="outline-button compact" type="button" onClick={addPastedMaterial}>{t("加入素材列表", "Add material")}</button></div>
                </section>
                <section className="material-source-card">
                  <strong>{t("上传文件", "Upload files")}</strong>
                  <label className="material-upload"><Upload size={18} /><span>{t("选择 TXT、Markdown、HTML、字幕、LRC、PDF 或 DOCX，可多选", "Choose TXT, Markdown, HTML, subtitles, LRC, PDF, or DOCX; multiple files allowed")}</span><input type="file" multiple accept=".txt,.md,.markdown,.html,.htm,.srt,.vtt,.lrc,.pdf,.docx" onChange={(event) => { void importMaterialFiles(event.target.files); event.target.value = ""; }} /></label>
                  <strong>{t("导入网页", "Import a web page")}</strong>
                  <div className="material-url-row"><input aria-label={t("网页地址", "Web address")} type="url" value={articleForm.url} onChange={(event) => setArticleForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://example.com/article" /><button className="outline-button compact" type="button" onClick={() => void importMaterialUrl()} disabled={articleBusy}>{t("读取", "Fetch")}</button></div>
                  <small>{t("网页只提取可读文本；PDF 和 Word 链接请先下载再上传。", "Web import extracts readable text only. Download PDF or Word links before uploading.")}</small>
                </section>
              </div>
              {articleMaterials.length > 0 && <section className="material-queue"><div className="material-queue-heading"><strong>{t("已加入素材", "Materials added")}</strong><span>{articleMaterials.length} / {MAX_MATERIALS}</span></div>{articleMaterials.map((material) => { const analysis = analyzeCourseMaterial(material.text, articleForm.languageId, material.kind); return <div className="material-queue-item" key={material.id}><div><strong>{material.title}</strong><small>{material.sourceLabel ?? material.kind} · {analysis.characterCount.toLocaleString()} {t("字符", "characters")} · {analysis.sentenceCount} {t("条内容", "items")} · {t("暂估", "estimated")} {analysis.estimatedLevel}{analysis.repeatedLines.length ? t(" · 检出重复分行", " · repeated lines found") : ""}</small></div><button className="icon-button" type="button" onClick={() => setArticleMaterials((current) => current.filter((item) => item.id !== material.id))} aria-label={t("移除素材", "Remove material")}><X size={15} /></button></div>; })}</section>}
              <div className="article-meta"><span>{(articleMaterials.reduce((total, item) => total + item.text.length, 0) + articleForm.text.length).toLocaleString()} / {MAX_MATERIAL_CHARACTERS.toLocaleString()} {t("字符", "characters")}</span><span>{t("每份素材会生成一个单元和四个可编辑练习", "Each material becomes one unit with four editable exercises")}</span></div>
              <label className="material-check"><input type="checkbox" checked={articleForm.useAi} disabled={!aiConfigured} onChange={(event) => setArticleForm((current) => ({ ...current, useAi: event.target.checked }))} /><span><strong>{t("使用个人 AI 补充翻译、语法、释义和难度判断", "Use Personal AI for translations, grammar, meanings, and level")}</strong><small>{aiConfigured ? t("素材会发送给你配置的 AI 服务；密钥仍只保留在当前会话。", "Materials are sent to your configured AI service; the key remains session-only.") : t("需要先完成个人 AI 设置和连接测试；不启用也能生成完整可编辑骨架。", "Configure and test Personal AI first. A complete editable structure can still be generated without it.")}</small></span></label>
              <label className="material-check rights-check"><input type="checkbox" checked={articleForm.rightsConfirmed} onChange={(event) => setArticleForm((current) => ({ ...current, rightsConfirmed: event.target.checked }))} /><span><strong>{t("我确认有权将这些素材用于自己的课程", "I confirm I may use these materials in my course")}</strong><small>{t("系统不会自动判断版权。公开发布前仍需填写合适的来源、署名与许可证。", "The app cannot determine copyright. Add appropriate source, attribution, and license before public publishing.")}</small></span></label>
              {articleError && <div className="language-error"><TriangleAlert size={16} />{articleError}</div>}
              <div className="privacy-note"><ShieldCheck size={17} /><p>{articleForm.useAi ? t("基础分析、拆分与确定性答案在浏览器内完成；只有 AI 增强会把素材发送给你选择的服务。生成结果始终先保存为私有草稿。", "Core analysis, splitting, and deterministic answers run in the browser. Only AI enhancement sends material to your chosen service. The result always starts as a private draft.") : t("分析与生成在当前浏览器内完成，不调用 AI。网页导入只由本站读取该公开页面；结果先保存为私有草稿。", "Analysis and generation run in this browser without AI. For URL import, this site only reads the public page. The result starts as a private draft.")}</p></div>
            </div>
            <div className="dialog-footer"><button className="text-button" onClick={() => setArticleOpen(false)} disabled={articleBusy}>{t("取消", "Cancel")}</button><button className="primary-button" onClick={() => void createArticleCourse()} disabled={articleBusy}>{articleBusy ? t("正在处理…", "Processing…") : t("生成可编辑草稿", "Create editable draft")}</button></div>
          </section>
        </div>
      )}

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
            <div className="dialog-footer"><button className="text-button" onClick={() => setLanguageOpen(false)}>{t("取消", "Cancel")}</button><button className="primary-button" onClick={() => void saveLanguagePack()}>{t("保存并创建课程", "Save and create course")}</button></div>
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

      {productGuide}
    </main>
  );
}
