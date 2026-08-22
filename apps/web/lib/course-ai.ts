import type { AiSettings } from "./ai.ts";
import { resolveCompatibleEndpoint } from "./ai.ts";
import type { CoursePack } from "./course.ts";
import type { TeachingLocale } from "./i18n.ts";

export type CourseAuthoringEnhancement = {
  estimatedLevel?: { level: string; reason: string };
  translations: Array<{ utteranceId: string; text: string }>;
  knowledge: Array<{ kind: "lexeme" | "grammar" | "pragmatics"; form: string; meaning: string; usage?: string; utteranceIds: string[] }>;
};

function responseText(data: unknown) {
  const value = data as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; choices?: Array<{ message?: { content?: string } }> };
  return value.output_text ?? value.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? value.choices?.[0]?.message?.content ?? "";
}

function buildPrompt(course: CoursePack, teachingLocale: TeachingLocale) {
  return [
    "Analyze this language-learning draft. Return JSON only, without Markdown:",
    '{"estimatedLevel":{"level":"A1-C2","reason":"short reason"},"translations":[{"utteranceId":"existing id","text":"translation"}],"knowledge":[{"kind":"lexeme|grammar|pragmatics","form":"target-language form","meaning":"teaching-language explanation","usage":"optional note","utteranceIds":["existing id"]}]}',
    `Target language: ${course.manifest.languageId}`,
    `Teaching language: ${teachingLocale === "en" ? "English" : "Simplified Chinese"}`,
    "Translate every utterance. Identify up to 16 useful vocabulary or grammar items. Use only existing utterance IDs. Keep explanations concise. The level is an estimate, never an exam certification.",
    JSON.stringify(course.utterances.map((item) => ({ id: item.id, text: item.text }))),
  ].join("\n");
}

function parseEnhancement(text: string, course: CoursePack): CourseAuthoringEnhancement {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 没有返回可识别的课程增强数据。");
  const value = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  const utteranceIds = new Set(course.utterances.map((item) => item.id));
  const translations = Array.isArray(value.translations) ? value.translations.flatMap((item) => {
    const entry = item as { utteranceId?: unknown; text?: unknown };
    return typeof entry.utteranceId === "string" && utteranceIds.has(entry.utteranceId) && typeof entry.text === "string" && entry.text.trim() ? [{ utteranceId: entry.utteranceId, text: entry.text.trim().slice(0, 1000) }] : [];
  }).slice(0, course.utterances.length) : [];
  const knowledge = Array.isArray(value.knowledge) ? value.knowledge.flatMap((item) => {
    const entry = item as { kind?: unknown; form?: unknown; meaning?: unknown; usage?: unknown; utteranceIds?: unknown };
    const kind = (["lexeme", "grammar", "pragmatics"] as const).find((candidate) => candidate === entry.kind);
    if (!kind || typeof entry.form !== "string" || !entry.form.trim() || typeof entry.meaning !== "string" || !entry.meaning.trim()) return [];
    return [{ kind, form: entry.form.trim().slice(0, 200), meaning: entry.meaning.trim().slice(0, 1000), usage: typeof entry.usage === "string" && entry.usage.trim() ? entry.usage.trim().slice(0, 1500) : undefined, utteranceIds: Array.isArray(entry.utteranceIds) ? entry.utteranceIds.filter((id): id is string => typeof id === "string" && utteranceIds.has(id)).slice(0, 12) : [] }];
  }).slice(0, 24) : [];
  const level = value.estimatedLevel as { level?: unknown; reason?: unknown } | undefined;
  const estimatedLevel = level && typeof level.level === "string" && /^(?:A1|A2|B1|B2|C1|C2)$/u.test(level.level) && typeof level.reason === "string" ? { level: level.level, reason: level.reason.trim().slice(0, 500) } : undefined;
  return { estimatedLevel, translations, knowledge };
}

async function callCompatible(settings: AiSettings, prompt: string, fetcher: typeof fetch) {
  const endpoint = resolveCompatibleEndpoint(settings.endpoint);
  if (typeof window !== "undefined" && window.location.protocol === "https:" && endpoint.startsWith("http:")) throw new Error("公开网站不能直连 HTTP 地址；请使用 HTTPS 接口或本地运行。");
  const response = await fetcher(endpoint, { method: "POST", headers: { "content-type": "application/json", ...(settings.apiKey.trim() ? { authorization: `Bearer ${settings.apiKey.trim()}` } : {}) }, body: JSON.stringify(new URL(endpoint).pathname.endsWith("/responses") ? { model: settings.model.trim(), input: prompt, store: false } : { model: settings.model.trim(), messages: [{ role: "user", content: prompt }] }) });
  const data = await response.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
  if (!response.ok) throw new Error(data.error?.message || data.message || `AI 服务请求失败（${response.status}）`);
  const text = responseText(data);
  if (!text.trim()) throw new Error("AI 服务没有返回文本内容。");
  return text;
}

export async function requestCourseAuthoringEnhancement(settings: AiSettings, course: CoursePack, teachingLocale: TeachingLocale, fetcher: typeof fetch = fetch) {
  if (!settings.model.trim()) throw new Error("请先填写模型 ID。");
  const prompt = buildPrompt(course, teachingLocale);
  let text: string;
  if (settings.provider === "compatible") text = await callCompatible(settings, prompt, fetcher);
  else {
    if (!settings.apiKey.trim()) throw new Error("该服务商需要 API 密钥。");
    const response = await fetcher("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "authoring", provider: settings.provider, model: settings.model.trim(), apiKey: settings.apiKey.trim(), prompt }) });
    const data = await response.json().catch(() => ({})) as { error?: string; text?: string };
    if (!response.ok || !data.text) throw new Error(data.error || `AI 服务请求失败（${response.status}）`);
    text = data.text;
  }
  return parseEnhancement(text, course);
}

export function applyCourseAuthoringEnhancement(course: CoursePack, enhancement: CourseAuthoringEnhancement, locale: TeachingLocale): CoursePack {
  const next = structuredClone(course);
  const translations = new Map(enhancement.translations.map((item) => [item.utteranceId, item.text]));
  next.utterances.forEach((utterance) => { const translation = translations.get(utterance.id); if (translation) utterance.translation = { [locale]: translation }; });
  enhancement.knowledge.forEach((item, index) => {
    const existing = next.knowledge.find((candidate) => candidate.form.toLocaleLowerCase() === item.form.toLocaleLowerCase() && candidate.kind === item.kind);
    const id = existing?.id ?? `ai-knowledge-${index + 1}`;
    if (existing) {
      existing.meaning = { [locale]: item.meaning };
      existing.usage = item.usage ? { [locale]: item.usage } : existing.usage;
      existing.tags = ["ai-assisted", "review-required"];
    } else next.knowledge.push({ id, kind: item.kind, form: item.form, meaning: { [locale]: item.meaning }, usage: item.usage ? { [locale]: item.usage } : undefined, tags: ["ai-assisted", "review-required"] });
    item.utteranceIds.forEach((utteranceId) => { const utterance = next.utterances.find((candidate) => candidate.id === utteranceId); if (utterance && !utterance.knowledgeRefs.includes(id)) utterance.knowledgeRefs.push(id); });
  });
  if (enhancement.estimatedLevel) next.goals.forEach((goal) => { goal.framework = { name: "AI-assisted CEFR estimate", level: enhancement.estimatedLevel!.level, reference: enhancement.estimatedLevel!.reason }; });
  return next;
}
