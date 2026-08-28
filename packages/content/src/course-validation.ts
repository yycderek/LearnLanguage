import type { CoursePack, ImportIssue, LocalizedText } from "@learn-language/protocol";

const localized = (value: unknown): value is LocalizedText =>
  Boolean(value && typeof value === "object" && Object.values(value as object).every((item) => typeof item === "string"));

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
  for (const collection of [course.goals, course.knowledge, course.utterances, course.exercises, course.rubrics, course.units ?? [], course.lessons]) {
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
    const optionCount = item.options?.length ?? 0;
    if ((item.kind === "multiple-choice" || item.kind === "ordering") && optionCount < 2) issues.push({ stage: "domain", path: `/exercises/${i}/options`, message: "多选与排序练习至少需要两个选项" });
    if (item.correctOptionIndex !== undefined && item.correctOptionIndex >= optionCount) issues.push({ stage: "domain", path: `/exercises/${i}/correctOptionIndex`, message: "正确答案序号超出选项范围" });
    if (item.kind === "multiple-choice" && !item.correctOptionIndices?.length) issues.push({ stage: "domain", path: `/exercises/${i}/correctOptionIndices`, message: "多选练习至少需要一个正确答案" });
    if (item.correctOptionIndices?.some((index) => index >= optionCount)) issues.push({ stage: "domain", path: `/exercises/${i}/correctOptionIndices`, message: "多选答案序号超出选项范围" });
    if (item.kind === "ordering" && item.correctOrder) {
      const actual = [...item.correctOrder].sort((left, right) => left - right);
      if (actual.length !== optionCount || actual.some((value, index) => value !== index)) issues.push({ stage: "domain", path: `/exercises/${i}/correctOrder`, message: "排序答案必须完整包含每个选项且不能重复" });
    }
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
  if (course.units) {
    const lessonIds = ids(course.lessons);
    const assigned = new Set<string>();
    course.units.forEach((unit, index) => {
      checkRefs(unit.canDoGoalRefs ?? [], goalIds, `/units/${index}/canDoGoalRefs`);
      checkRefs(unit.lessonRefs ?? [], lessonIds, `/units/${index}/lessonRefs`);
      unit.lessonRefs.forEach((lessonId) => {
        if (assigned.has(lessonId)) issues.push({ stage: "domain", path: `/units/${index}/lessonRefs`, message: `课节被重复分配：${lessonId}` });
        assigned.add(lessonId);
      });
    });
    course.lessons.forEach((lesson) => {
      if (!assigned.has(lesson.id)) issues.push({ stage: "domain", path: "/units", message: `课节尚未分配单元：${lesson.id}` });
    });
  }
  return issues.length ? { issues } : { course, issues: [] };
}

export function canonicalizeCourse(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalizeCourse).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "contentHash")
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalizeCourse(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}