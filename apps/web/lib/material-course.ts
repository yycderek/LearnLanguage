import type { CoursePack } from "./course.ts";
import type { AppLocale } from "./i18n.ts";
import type { CourseMaterial, MaterialKind } from "./material-import.ts";

export const MAX_MATERIAL_CHARACTERS = 30_000;
export const MAX_MATERIAL_SENTENCES = 40;

export type MaterialAnalysis = {
  sentenceCount: number;
  characterCount: number;
  uniqueWordRatio: number;
  averageWordsPerSentence: number;
  estimatedLevel: "A1" | "A2" | "B1" | "B2" | "C1";
  vocabulary: string[];
  repeatedLines: string[];
};

export type MaterialCourseInput = {
  languageId: string;
  languageName: string;
  locale: AppLocale;
  title: string;
  materials: CourseMaterial[];
  courseId?: string;
};

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has", "have", "he", "her", "his", "i", "in", "is", "it", "not", "of", "on", "or", "she", "that", "the", "their", "they", "this", "to", "was", "we", "were", "with", "you", "your",
  "的", "了", "和", "是", "在", "我", "你", "他", "她", "它", "们", "这", "那", "有", "也", "都", "就", "不", "很", "吗", "呢", "啊",
  "は", "が", "を", "に", "で", "と", "も", "の", "へ", "や", "から", "まで", "です", "ます", "する", "いる", "ある", "これ", "それ", "あれ",
]);

function normalizeText(text: string) {
  return text.replace(/\r\n?/gu, "\n").replace(/[ \t]+\n/gu, "\n").trim();
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.-]+/gu, "-").replace(/^-+|-+$/gu, "") || "material";
}

function words(text: string, languageId: string) {
  try {
    return [...new Intl.Segmenter(languageId || undefined, { granularity: "word" }).segment(text)]
      .filter((item) => item.isWordLike).map((item) => item.segment.trim()).filter(Boolean);
  } catch {
    return text.match(/[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu) ?? [];
  }
}

export function splitMaterialText(text: string, kind: MaterialKind = "article") {
  const normalized = normalizeText(text);
  const parts = kind === "lyrics" || kind === "subtitle" || kind === "dialogue"
    ? normalized.split(/\n+/gu)
    : normalized.split(/\n+|(?<=[.!?。！？])\s*/gu);
  return parts.map((part) => part.trim()).filter(Boolean).slice(0, MAX_MATERIAL_SENTENCES);
}

function vocabularyCandidates(sentences: string[], languageId: string) {
  const counts = new Map<string, { form: string; count: number; first: number }>();
  words(sentences.join("\n"), languageId).forEach((form, first) => {
    const key = form.toLocaleLowerCase(languageId || undefined);
    if (form.length < 2 || STOP_WORDS.has(key) || /^\d+$/u.test(form)) return;
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { form, count: 1, first });
  });
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || right.form.length - left.form.length || left.first - right.first)
    .slice(0, 12).map((item) => item.form);
}

export function analyzeCourseMaterial(text: string, languageId: string, kind: MaterialKind = "article"): MaterialAnalysis {
  const sentences = splitMaterialText(text, kind);
  const tokens = words(sentences.join(" "), languageId);
  const unique = new Set(tokens.map((word) => word.toLocaleLowerCase(languageId || undefined)));
  const averageWordsPerSentence = tokens.length / Math.max(sentences.length, 1);
  const uniqueWordRatio = unique.size / Math.max(tokens.length, 1);
  const averageCharacters = sentences.reduce((total, sentence) => total + [...sentence].length, 0) / Math.max(sentences.length, 1);
  const complexity = averageWordsPerSentence + averageCharacters / 6 + uniqueWordRatio * 8;
  const estimatedLevel = complexity < 9 ? "A1" : complexity < 14 ? "A2" : complexity < 20 ? "B1" : complexity < 27 ? "B2" : "C1";
  const lineCounts = new Map<string, number>();
  if (kind === "lyrics" || kind === "subtitle") sentences.forEach((line) => lineCounts.set(line, (lineCounts.get(line) ?? 0) + 1));
  return { sentenceCount: sentences.length, characterCount: [...normalizeText(text)].length, uniqueWordRatio, averageWordsPerSentence, estimatedLevel, vocabulary: vocabularyCandidates(sentences, languageId), repeatedLines: [...lineCounts].filter(([, count]) => count > 1).map(([line]) => line).slice(0, 8) };
}

function orderingParts(sentence: string, languageId: string) {
  const segmented = words(sentence, languageId);
  if (segmented.length >= 3 && segmented.length <= 14) return segmented;
  const spaced = sentence.split(/\s+/gu).filter(Boolean);
  if (spaced.length >= 3 && spaced.length <= 14) return spaced;
  return [...sentence].filter((part) => part.trim()).slice(0, 12);
}

function correctOrder(original: string[], shuffled: string[]) {
  const used = new Set<number>();
  return original.map((part) => {
    const index = shuffled.findIndex((candidate, candidateIndex) => candidate === part && !used.has(candidateIndex));
    used.add(index);
    return index;
  });
}

export function createCourseDraftFromMaterials(input: MaterialCourseInput): CoursePack {
  const title = input.title.trim();
  const materials = input.materials.map((material) => ({ ...material, title: material.title.trim(), text: normalizeText(material.text) }));
  if (!title) throw new Error("article-title-required");
  if (!materials.length || materials.every((material) => material.text.length < 20)) throw new Error("article-too-short");
  if (materials.reduce((total, material) => total + material.text.length, 0) > MAX_MATERIAL_CHARACTERS) throw new Error("article-too-large");
  const locale = input.locale;
  const localized = (zh: string, en: string) => ({ [locale]: locale === "en" ? en : zh });
  const knowledge: CoursePack["knowledge"] = [];
  const utterances: CoursePack["utterances"] = [];
  const exercises: CoursePack["exercises"] = [];
  const goals: CoursePack["goals"] = [];
  const units: NonNullable<CoursePack["units"]> = [];
  const lessons: CoursePack["lessons"] = [];
  const analyses: MaterialAnalysis[] = [];

  materials.forEach((material, materialIndex) => {
    const prefix = `material-${materialIndex + 1}`;
    const sentences = splitMaterialText(material.text, material.kind);
    if (!sentences.length) return;
    const analysis = analyzeCourseMaterial(material.text, input.languageId, material.kind);
    analyses.push(analysis);
    const materialKnowledge = analysis.vocabulary.slice(0, 8).map((form, index) => ({ id: `${prefix}-word-${index + 1}`, kind: "lexeme" as const, form, meaning: localized("待作者补充释义", "Add a meaning before publishing"), usage: localized("由素材自动识别，请核对词形、释义与用法。", "Automatically identified; review the form, meaning, and usage."), tags: ["auto-extracted", "review-required"] }));
    knowledge.push(...materialKnowledge);
    const utteranceIds = sentences.map((_, index) => `${prefix}-sentence-${index + 1}`);
    utterances.push(...sentences.map((sentence, index) => ({ id: utteranceIds[index]!, text: sentence, knowledgeRefs: materialKnowledge.filter((item) => sentence.toLocaleLowerCase(input.languageId || undefined).includes(item.form.toLocaleLowerCase(input.languageId || undefined))).map((item) => item.id) })));
    const fillWord = materialKnowledge.find((item) => sentences.some((sentence) => sentence.includes(item.form)))?.form ?? words(sentences[0]!, input.languageId).find((word) => word.length > 1) ?? [...sentences[0]!][0]!;
    const fillSentence = sentences.find((sentence) => sentence.includes(fillWord)) ?? sentences[0]!;
    const sortableIndex = sentences.findIndex((sentence) => orderingParts(sentence, input.languageId).length >= 3);
    const sortableSentence = sortableIndex >= 0 ? sentences[sortableIndex]! : sentences.slice(0, 4).join(" ");
    const originalParts = orderingParts(sortableSentence, input.languageId);
    const shuffledParts = originalParts.length > 1 ? [...originalParts.slice(1), originalParts[0]!] : originalParts;
    const fillId = `${prefix}-fill-expression`;
    const orderingId = `${prefix}-restore-order`;
    const mainIdeaId = `${prefix}-main-idea`;
    const reuseId = `${prefix}-reuse-language`;
    exercises.push(
      { id: fillId, kind: "fill-blank", prompt: localized(`根据素材补全：${fillSentence.replace(fillWord, "____")}`, `Complete from the material: ${fillSentence.replace(fillWord, "____")}`), guidance: localized("答案来自原文，发布前仍需作者核对。", "The answer comes from the source; review it before publishing."), acceptedAnswers: [fillWord], evaluationSources: ["deterministic"], knowledgeRefs: materialKnowledge.filter((item) => item.form === fillWord).map((item) => item.id), utteranceRefs: [utteranceIds[sentences.indexOf(fillSentence)]!] },
      { id: orderingId, kind: "ordering", prompt: localized("将片段还原成素材中的一句话。", "Restore a sentence from the material."), options: shuffledParts.map((part) => ({ native: part, [locale]: part })), correctOrder: correctOrder(originalParts, shuffledParts), evaluationSources: ["deterministic"], knowledgeRefs: [], utteranceRefs: [utteranceIds[Math.max(sortableIndex, 0)]!] },
      { id: mainIdeaId, kind: "free-response", prompt: localized("这份素材主要表达了什么？请写一至两句概括。", "What is the main idea? Summarize it in one or two sentences."), guidance: localized("找出重复出现的人物、事物和行动，再概括它们的关系。", "Find repeated people, things, and actions, then summarize their relationship."), evaluationSources: ["self", "ai-assisted"], knowledgeRefs: [], utteranceRefs: utteranceIds },
      { id: reuseId, kind: "free-response", prompt: localized("选择一个表达，写一句与自己有关的新句子。", "Choose one expression and write a new sentence about yourself."), guidance: localized("先复制原句，再替换人物、时间、地点或动作。", "Start from the original and replace a person, time, place, or action."), evaluationSources: ["self", "ai-assisted"], knowledgeRefs: materialKnowledge.map((item) => item.id), utteranceRefs: utteranceIds },
    );
    const goalId = `${prefix}-goal`;
    const lessonId = `${prefix}-lesson`;
    goals.push({ id: goalId, description: localized(`能够理解《${material.title}》并迁移关键表达。`, `Can understand “${material.title}” and reuse key expressions.`), framework: { name: "Heuristic CEFR estimate", level: analysis.estimatedLevel, reference: "Automatic estimate; author review required" } });
    units.push({ id: `${prefix}-unit`, title: { [locale]: material.title }, description: localized(`自动估计 ${analysis.estimatedLevel}；发布前核对难度、词汇与答案。`, `Estimated ${analysis.estimatedLevel}; review level, vocabulary, and answers.`), canDoGoalRefs: [goalId], lessonRefs: [lessonId] });
    lessons.push({ id: lessonId, title: { [locale]: material.title }, canDoGoalRefs: [goalId], entryStepId: `${prefix}-read`, steps: [
      { id: `${prefix}-read`, phase: "supported-input", title: localized(material.kind === "lyrics" ? "按分行阅读歌词" : "阅读素材", material.kind === "lyrics" ? "Read the lyrics by line" : "Read the material"), supportLevel: "full", knowledgeRefs: materialKnowledge.map((item) => item.id), utteranceRefs: utteranceIds, exerciseRefs: [], next: [`${prefix}-notice`] },
      { id: `${prefix}-notice`, phase: "noticing", title: localized("注意表达与结构", "Notice forms and structure"), supportLevel: "target-language-only", knowledgeRefs: materialKnowledge.map((item) => item.id), utteranceRefs: utteranceIds, exerciseRefs: [fillId, orderingId], next: [`${prefix}-understand`] },
      { id: `${prefix}-understand`, phase: "comprehension", title: localized("抓住主旨", "Find the main idea"), supportLevel: "target-language-only", knowledgeRefs: [], utteranceRefs: utteranceIds, exerciseRefs: [mainIdeaId], next: [`${prefix}-reuse`] },
      { id: `${prefix}-reuse`, phase: "independent-task", title: localized("迁移表达", "Reuse the language"), supportLevel: "none", knowledgeRefs: materialKnowledge.map((item) => item.id), utteranceRefs: utteranceIds, exerciseRefs: [reuseId], next: [] },
    ] });
  });
  if (!utterances.length) throw new Error("article-empty");
  const scale = ["A1", "A2", "B1", "B2", "C1"];
  const highestLevel = analyses.map((analysis) => analysis.estimatedLevel).sort((left, right) => scale.indexOf(right) - scale.indexOf(left))[0] ?? "A1";
  const sourceTitle = materials.length === 1 ? materials[0]!.title : locale === "en" ? `${materials.length} imported materials` : `${materials.length} 份导入素材`;
  return { schemaVersion: 2, manifest: { id: `private.${safeId(input.languageId)}.material-${safeId(input.courseId ?? crypto.randomUUID())}`, version: "0.1.0", languageId: input.languageId, title: { [locale]: title }, description: localized(`由 ${materials.length} 份素材生成的草稿，难度暂估 ${highestLevel}，发布前需复核。`, `Draft generated from ${materials.length} material(s), estimated ${highestLevel}; review before publishing.`), author: { id: "local-author", displayName: locale === "en" ? "Course author" : "课程作者" }, visibility: "private", status: "draft", source: { kind: "imported", title: sourceTitle, url: materials.length === 1 ? materials[0]!.sourceUrl : undefined }, languageAdapter: { id: "core.generic", version: "1.0.0" } }, goals, knowledge, utterances, exercises, rubrics: [], units, lessons };
}
