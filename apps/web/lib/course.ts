export type LocalizedText = Record<string, string>;

export interface CourseStep {
  id: string;
  phase: string;
  title: LocalizedText;
  supportLevel?: string;
  knowledgeRefs: string[];
  utteranceRefs: string[];
  exerciseRefs: string[];
  next: string[];
}

export interface CoursePack {
  schemaVersion: number;
  manifest: {
    id: string;
    version: string;
    languageId: string;
    title: LocalizedText;
    description: LocalizedText;
    author: { id: string; displayName: string };
    visibility: string;
    status: string;
    source: { kind: string };
  };
  goals: Array<{ id: string; description: LocalizedText }>;
  knowledge: Array<{ id: string; kind: string; form: string; meaning: LocalizedText }>;
  utterances: Array<{ id: string; text: string; knowledgeRefs: string[] }>;
  exercises: Array<{ id: string; kind: string; prompt: LocalizedText; knowledgeRefs: string[]; utteranceRefs: string[]; rubricRef?: string }>;
  rubrics: Array<{ id: string; dimensions: string[]; retryRequired: boolean }>;
  lessons: Array<{ id: string; title: LocalizedText; canDoGoalRefs: string[]; entryStepId: string; steps: CourseStep[] }>;
}

export interface ImportIssue { stage: "json" | "schema" | "domain"; path: string; message: string }

const localized = (value: unknown): value is LocalizedText =>
  Boolean(value && typeof value === "object" && Object.values(value as object).every((item) => typeof item === "string"));

export function displayText(value?: LocalizedText) {
  if (!value) return "未命名";
  return value["zh-CN"] ?? value.zh ?? value.en ?? Object.values(value)[0] ?? "未命名";
}

export function validateCourse(input: string): { course?: CoursePack; issues: ImportIssue[] } {
  let data: unknown;
  try { data = JSON.parse(input); }
  catch (error) {
    return { issues: [{ stage: "json", path: "/", message: error instanceof Error ? error.message : "JSON 格式无效" }] };
  }
  const value = data as Partial<CoursePack>;
  const issues: ImportIssue[] = [];
  if (value.schemaVersion !== 1) issues.push({ stage: "schema", path: "/schemaVersion", message: "当前仅支持 schemaVersion 1" });
  if (!value.manifest || typeof value.manifest !== "object") issues.push({ stage: "schema", path: "/manifest", message: "缺少课程清单 manifest" });
  else {
    if (!value.manifest.id) issues.push({ stage: "schema", path: "/manifest/id", message: "课程 ID 不能为空" });
    if (!value.manifest.languageId) issues.push({ stage: "schema", path: "/manifest/languageId", message: "语言 ID 不能为空" });
    if (!localized(value.manifest.title)) issues.push({ stage: "schema", path: "/manifest/title", message: "标题必须是多语言文本对象" });
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

const steps: CourseStep[] = [
  ["diagnose", "diagnostic", "检查已有知识", "full"],
  ["preteach", "preteach", "最小知识预教", "full"],
  ["supported-input", "supported-input", "带翻译理解场景", "full"],
  ["target-input", "supported-input", "只看目标语言", "target-language-only"],
  ["independent-input", "comprehension", "独立理解", "none"],
  ["guided-output", "guided-output", "替换并重组表达", "target-language-only"],
  ["independent-task", "independent-task", "独立完成任务", "none"],
  ["feedback-retry", "feedback-retry", "根据反馈重试", "none"],
  ["delayed-transfer", "delayed-transfer", "延迟迁移", "none"],
].map(([id, phase, title, supportLevel], index, all) => ({
  id, phase, title: { "zh-CN": title }, supportLevel,
  knowledgeRefs: ["drink", "request-pattern"],
  utteranceRefs: id.includes("input") || id === "guided-output" ? ["request-drink"] : [],
  exerciseRefs: id === "independent-input" ? ["understand-request"] : id.includes("task") || id.includes("retry") || id.includes("transfer") ? ["independent-request"] : [],
  next: index < all.length - 1 ? [all[index + 1][0]] : [],
}));

export function sampleCourse(languageId = "ja"): CoursePack {
  const japanese = languageId === "ja";
  return {
    schemaVersion: 1,
    manifest: {
      id: `private.${languageId}.cafe-request`, version: "0.1.0", languageId,
      title: { "zh-CN": japanese ? "日语咖啡店点单" : "粤语咖啡店点单" },
      description: { "zh-CN": "在咖啡店礼貌地请求一杯饮料。" },
      author: { id: "local-author", displayName: "课程作者" }, visibility: "private", status: "draft", source: { kind: "original" },
    },
    goals: [{ id: "order-drink", description: { "zh-CN": "能够在咖啡店请求一杯饮料。" } }],
    knowledge: [
      { id: "drink", kind: "lexeme", form: japanese ? "コーヒー" : "咖啡", meaning: { "zh-CN": "咖啡" } },
      { id: "request-pattern", kind: "grammar", form: japanese ? "〜をお願いします" : "我想要〜", meaning: { "zh-CN": "礼貌提出请求" } },
    ],
    utterances: [{ id: "request-drink", text: japanese ? "コーヒーを一つお願いします。" : "唔該，我想要一杯咖啡。", knowledgeRefs: ["drink", "request-pattern"] }],
    exercises: [
      { id: "understand-request", kind: "single-choice", prompt: { "zh-CN": "说话人想要什么？" }, knowledgeRefs: ["drink"], utteranceRefs: ["request-drink"] },
      { id: "independent-request", kind: "role-play", prompt: { "zh-CN": "向店员点一杯饮料。" }, knowledgeRefs: ["drink", "request-pattern"], utteranceRefs: [], rubricRef: "request-rubric" },
    ],
    rubrics: [{ id: "request-rubric", dimensions: ["task-completion", "comprehensibility", "target-language"], retryRequired: true }],
    lessons: [{ id: "cafe-request", title: { "zh-CN": "在咖啡店提出请求" }, canDoGoalRefs: ["order-drink"], entryStepId: "diagnose", steps }],
  };
}
