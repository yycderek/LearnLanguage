import type {
  CoursePack,
  CourseStep,
  ExerciseKind,
  ImportIssue,
  LessonPhase,
  LocalizedText,
  PublishedCoursePack,
  SupportLevel,
} from "@learn-language/protocol";
import { localizedText, type TeachingLocale } from "./i18n.ts";

export type {
  CoursePack,
  CourseStep,
  ExerciseKind,
  ImportIssue,
  LessonPhase,
  LocalizedText,
  PublishedCoursePack,
  SupportLevel,
} from "@learn-language/protocol";

const localized = (value: unknown): value is LocalizedText =>
  Boolean(value && typeof value === "object" && Object.values(value as object).every((item) => typeof item === "string"));

export function displayText(value?: LocalizedText, locale: TeachingLocale = "zh-CN") {
  return localizedText(value, locale);
}

export function validateCourse(input: string): { course?: CoursePack; issues: ImportIssue[] } {
  let data: unknown;
  try { data = JSON.parse(input); }
  catch (error) {
    return { issues: [{ stage: "json", path: "/", message: error instanceof Error ? error.message : "JSON 格式无效" }] };
  }
  const value = data as Partial<CoursePack>;
  const issues: ImportIssue[] = [];
  if (value.schemaVersion !== 2) issues.push({ stage: "schema", path: "/schemaVersion", message: "当前仅支持 schemaVersion 2" });
  if (!value.manifest || typeof value.manifest !== "object") issues.push({ stage: "schema", path: "/manifest", message: "缺少课程清单 manifest" });
  else {
    if (!value.manifest.id) issues.push({ stage: "schema", path: "/manifest/id", message: "课程 ID 不能为空" });
    if (!value.manifest.languageId) issues.push({ stage: "schema", path: "/manifest/languageId", message: "语言 ID 不能为空" });
    if (!localized(value.manifest.title)) issues.push({ stage: "schema", path: "/manifest/title", message: "标题必须是多语言文本对象" });
    if (value.manifest.status === "published" && !value.manifest.contentHash) issues.push({ stage: "domain", path: "/manifest/contentHash", message: "已发布课程必须包含内容哈希" });
    if (value.manifest.status === "published" && !value.manifest.languageAdapter) issues.push({ stage: "domain", path: "/manifest/languageAdapter", message: "已发布课程必须固定语言适配器版本" });
    if (value.manifest.status === "published" && !value.manifest.license?.id) issues.push({ stage: "domain", path: "/manifest/license", message: "已发布课程必须明确内容许可证" });
  }
  for (const key of ["goals", "knowledge", "utterances", "exercises", "rubrics", "lessons"] as const) {
    if (!Array.isArray(value[key])) issues.push({ stage: "schema", path: `/${key}`, message: `${key} 必须是数组` });
  }
  if (issues.length) return { issues };
  const course = value as CoursePack;
  const ids = <T extends { id: string }>(items: T[]) => new Set(items.map((item) => item.id));
  const knowledgeIds = ids(course.knowledge);
  const utteranceIds = ids(course.utterances);
  const exerciseIds = ids(course.exercises);
  const goalIds = ids(course.goals);
  const rubricIds = ids(course.rubrics);
  const seen = new Set<string>();
  for (const collection of [course.goals, course.knowledge, course.utterances, course.exercises, course.rubrics, course.lessons]) {
    for (const item of collection) {
      const key = `${collection === course.lessons ? "lesson" : "item"}:${item.id}`;
      if (!item.id) issues.push({ stage: "domain", path: "/", message: "内容 ID 不能为空" });
      if (seen.has(key)) issues.push({ stage: "domain", path: `/${item.id}`, message: `发现重复 ID：${item.id}` });
      seen.add(key);
    }
  }
  const checkRefs = (refs: string[], allowed: Set<string>, path: string) => refs.forEach((ref) => {
    if (!allowed.has(ref)) issues.push({ stage: "domain", path, message: `引用不存在：${ref}` });
  });
  course.utterances.forEach((item, i) => checkRefs(item.knowledgeRefs ?? [], knowledgeIds, `/utterances/${i}/knowledgeRefs`));
  course.exercises.forEach((item, i) => {
    checkRefs(item.knowledgeRefs ?? [], knowledgeIds, `/exercises/${i}/knowledgeRefs`);
    checkRefs(item.utteranceRefs ?? [], utteranceIds, `/exercises/${i}/utteranceRefs`);
    if (item.rubricRef && !rubricIds.has(item.rubricRef)) issues.push({ stage: "domain", path: `/exercises/${i}/rubricRef`, message: `评分规则不存在：${item.rubricRef}` });
  });
  course.lessons.forEach((lesson, i) => {
    checkRefs(lesson.canDoGoalRefs ?? [], goalIds, `/lessons/${i}/canDoGoalRefs`);
    const stepIds = ids(lesson.steps ?? []);
    if (!stepIds.has(lesson.entryStepId)) issues.push({ stage: "domain", path: `/lessons/${i}/entryStepId`, message: `入口步骤不存在：${lesson.entryStepId}` });
    lesson.steps?.forEach((step, j) => {
      checkRefs(step.knowledgeRefs ?? [], knowledgeIds, `/lessons/${i}/steps/${j}/knowledgeRefs`);
      checkRefs(step.utteranceRefs ?? [], utteranceIds, `/lessons/${i}/steps/${j}/utteranceRefs`);
      checkRefs(step.exerciseRefs ?? [], exerciseIds, `/lessons/${i}/steps/${j}/exerciseRefs`);
      checkRefs(step.next ?? [], stepIds, `/lessons/${i}/steps/${j}/next`);
    });
  });
  return issues.length ? { issues } : { course, issues: [] };
}

const stepBlueprints: Array<[string, LessonPhase, string, string, SupportLevel]> = [
  ["diagnose", "diagnostic", "检查已有知识", "Check prior knowledge", "full"],
  ["preteach", "preteach", "最小知识预教", "Learn the essentials", "full"],
  ["supported-input", "supported-input", "带翻译理解场景", "Understand with translation", "full"],
  ["target-input", "supported-input", "只看目标语言", "Target language only", "target-language-only"],
  ["independent-input", "comprehension", "独立理解", "Independent comprehension", "none"],
  ["guided-output", "guided-output", "替换并重组表达", "Rebuild the expression", "target-language-only"],
  ["independent-task", "independent-task", "独立完成任务", "Complete the task independently", "none"],
  ["feedback-retry", "feedback-retry", "根据反馈重试", "Retry with feedback", "none"],
  ["delayed-transfer", "delayed-transfer", "延迟迁移", "Delayed transfer", "none"],
];

const steps: CourseStep[] = stepBlueprints.map(([id, phase, chineseTitle, englishTitle, supportLevel], index, all) => ({
  id, phase, title: { "zh-CN": chineseTitle, en: englishTitle }, supportLevel,
  knowledgeRefs: ["drink", "request-pattern"],
  utteranceRefs: id.includes("input") || id === "guided-output" ? ["request-drink"] : [],
  exerciseRefs: id === "independent-input" ? ["understand-request"] : id.includes("task") || id.includes("retry") || id.includes("transfer") ? ["independent-request"] : [],
  next: index < all.length - 1 ? [all[index + 1][0]] : [],
}));

export function sampleCourse(languageId = "ja", languageName?: string): CoursePack {
  const japanese = languageId === "ja";
  const cantonese = languageId === "yue-Hant-HK";
  const targetName = languageName ?? (japanese ? "日语" : cantonese ? "粤语" : languageId);
  const targetEnglishName = japanese ? "Japanese" : cantonese ? "Cantonese" : languageId;
  const drink = japanese ? "コーヒー" : cantonese ? "咖啡" : "目标语词汇";
  const requestPattern = japanese ? "〜をお願いします" : cantonese ? "我想要〜" : "目标语请求句型";
  const utterance = japanese ? "コーヒーを一つお願いします。" : cantonese ? "唔該，我想要一杯咖啡。" : "请在这里填写目标语言示例表达。";
  const lessonSteps = () => steps.map((step) => ({
    ...step,
    title: { ...step.title },
    knowledgeRefs: [...step.knowledgeRefs],
    utteranceRefs: [...step.utteranceRefs],
    exerciseRefs: [...step.exerciseRefs],
    next: [...step.next],
  }));
  return {
    schemaVersion: 2,
    manifest: {
      id: `private.${languageId}.cafe-request`, version: "0.1.0", languageId,
      title: { "zh-CN": `${targetName}咖啡店点单`, en: `${targetEnglishName} Café Ordering` },
      description: { "zh-CN": "在咖啡店礼貌地请求一杯饮料。", en: "Politely order a drink in a café." },
      author: { id: "local-author", displayName: "课程作者" }, visibility: "private", status: "draft", source: { kind: "original" },
      languageAdapter: {
        id: japanese ? "core.japanese" : cantonese ? "core.cantonese" : "core.generic",
        version: "1.0.0",
      },
    },
    goals: [{ id: "order-drink", description: { "zh-CN": "能够在咖啡店请求一杯饮料。", en: "Can order a drink in a café." } }],
    knowledge: [
      { id: "drink", kind: "lexeme", form: drink, meaning: { "zh-CN": "咖啡", en: "coffee" } },
      { id: "request-pattern", kind: "grammar", form: requestPattern, meaning: { "zh-CN": "礼貌提出请求", en: "make a polite request" } },
    ],
    utterances: [{ id: "request-drink", text: utterance, translation: { "zh-CN": "请给我一杯咖啡。", en: "One coffee, please." }, knowledgeRefs: ["drink", "request-pattern"] }],
    exercises: [
      {
        id: "understand-request",
        kind: "single-choice",
        prompt: { "zh-CN": "说话人想要什么？", en: "What does the speaker want?" },
        options: [{ "zh-CN": "一杯咖啡", en: "A coffee" }, { "zh-CN": "一杯茶", en: "A tea" }, { "zh-CN": "一份甜点", en: "A dessert" }],
        correctOptionIndex: 0,
        guidance: { "zh-CN": "留意句子中的饮料名称。", en: "Look for the name of the drink." },
        knowledgeRefs: ["drink"],
        utteranceRefs: ["request-drink"],
      },
      {
        id: "independent-request",
        kind: "role-play",
        prompt: { "zh-CN": "向店员点一杯饮料。", en: "Order a drink from the server." },
        guidance: { "zh-CN": "尝试使用课程中的饮料词汇和礼貌请求句型。", en: "Use the drink word and polite request pattern from this lesson." },
        knowledgeRefs: ["drink", "request-pattern"],
        utteranceRefs: [],
        rubricRef: "request-rubric",
        requiredCapabilities: ["token-comparison"],
        capabilityFallback: "self-assessment",
      },
    ],
    rubrics: [{ id: "request-rubric", dimensions: ["task-completion", "comprehensibility", "target-language"], retryRequired: true }],
    lessons: [
      { id: "cafe-request", title: { "zh-CN": "在咖啡店提出请求", en: "Make a request in a café" }, canDoGoalRefs: ["order-drink"], entryStepId: "diagnose", steps: lessonSteps() },
      { id: "polite-variation", title: { "zh-CN": "变化饮料与礼貌程度", en: "Vary the drink and politeness" }, canDoGoalRefs: ["order-drink"], entryStepId: "diagnose", steps: lessonSteps() },
      { id: "transfer-scenario", title: { "zh-CN": "迁移到新的点单场景", en: "Transfer to a new ordering scenario" }, canDoGoalRefs: ["order-drink"], entryStepId: "diagnose", steps: lessonSteps() },
    ],
  };
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "contentHash")
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function publishCourseDraft(course: CoursePack): Promise<PublishedCoursePack> {
  if (course.manifest.status === "published") throw new Error("课程已经发布，不能再次覆盖发布");
  if (!course.manifest.license?.id) throw new Error("发布前必须选择课程内容许可证");
  const candidate = structuredClone(course) as CoursePack;
  candidate.manifest.status = "published";
  candidate.manifest.languageAdapter ??= { id: "core.generic", version: "1.0.0" };
  delete candidate.manifest.contentHash;
  candidate.manifest.contentHash = await calculateCourseHash(candidate);
  return candidate as PublishedCoursePack;
}

export async function calculateCourseHash(course: CoursePack): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(course));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function verifyPublishedCourseIntegrity(course: CoursePack): Promise<{ valid: boolean; expected: string; actual?: string }> {
  const expected = await calculateCourseHash(course);
  return { valid: course.manifest.status === "published" && course.manifest.contentHash === expected, expected, ...(course.manifest.contentHash ? { actual: course.manifest.contentHash } : {}) };
}

export function forkPublishedCourse(course: PublishedCoursePack): CoursePack {
  const draft = structuredClone(course) as CoursePack;
  const sourceId = course.manifest.id;
  draft.manifest.id = `${sourceId}.fork`;
  draft.manifest.status = "draft";
  draft.manifest.visibility = "private";
  draft.manifest.source = { kind: "forked", derivedFromCourseId: sourceId };
  delete draft.manifest.contentHash;
  return draft;
}
