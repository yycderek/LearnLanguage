import { displayText, type CoursePack } from "./course.ts";
import type { TeachingLocale } from "./i18n.ts";

export type AiProvider = "openai" | "anthropic" | "gemini" | "compatible";

export type AiSettings = {
  provider: AiProvider;
  model: string;
  endpoint: string;
  apiKey: string;
};

export type AiFeedback = {
  verdict: "pass" | "retry";
  title: string;
  message: string;
  suggestion?: string;
};

export type LearningFeedbackContext = {
  course: CoursePack;
  lessonTitle: string;
  prompt: string;
  answer: string;
  targetForms: string[];
  guidance?: string;
  teachingLocale?: TeachingLocale;
};

type Fetcher = typeof fetch;

function responseText(data: unknown) {
  const value = data as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
    choices?: Array<{ message?: { content?: string } }>;
  };
  return value.output_text
    ?? value.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("")
    ?? value.choices?.[0]?.message?.content
    ?? "";
}

export function resolveCompatibleEndpoint(endpoint: string) {
  const trimmed = endpoint.trim().replace(/\/$/, "");
  if (!trimmed) throw new Error("请填写兼容服务的 API 地址。");
  const url = new URL(trimmed);
  if (!(["http:", "https:"] as string[]).includes(url.protocol)) throw new Error("API 地址必须使用 HTTP 或 HTTPS。");
  if (/\/(chat\/completions|responses)$/.test(url.pathname)) return url.toString();
  url.pathname = `${url.pathname.replace(/\/$/, "")}${url.pathname.endsWith("/v1") ? "" : "/v1"}/chat/completions`;
  return url.toString();
}

export function buildLearningFeedbackPrompt(context: LearningFeedbackContext) {
  const locale = context.teachingLocale ?? "zh-CN";
  if (locale === "en") {
    return [
      "Evaluate whether the learner completed the language task. Accept answers that differ from the reference wording when their meaning and usage are appropriate.",
      "Return JSON only, without Markdown, using this shape:",
      '{"verdict":"pass or retry","title":"short conclusion","message":"one specific piece of feedback","suggestion":"optional improved wording"}',
      `Course: ${displayText(context.course.manifest.title, locale)}`,
      `Target language: ${context.course.manifest.languageId}`,
      `Lesson: ${context.lessonTitle}`,
      `Task: ${context.prompt}`,
      `Learner answer: ${context.answer}`,
      `Target forms: ${context.targetForms.join(", ") || "not specified"}`,
      `Course guidance: ${context.guidance || "none"}`,
      "Judge task completion and comprehensibility first, then identify the single most important improvement. Do not require an exact reproduction of the reference answer. Respond in English.",
    ].join("\n");
  }
  return [
    "请评估学习者是否完成了语言任务。允许与参考表达不同但语义正确、语用合适的答案。",
    "只返回 JSON，不要使用 Markdown。格式：",
    '{"verdict":"pass 或 retry","title":"简短结论","message":"一条具体反馈","suggestion":"可选的改写建议"}',
    `课程：${context.course.manifest.title["zh-CN"] ?? Object.values(context.course.manifest.title)[0] ?? context.course.manifest.id}`,
    `目标语言：${context.course.manifest.languageId}`,
    `课节：${context.lessonTitle}`,
    `任务：${context.prompt}`,
    `学习者回答：${context.answer}`,
    `本课目标表达：${context.targetForms.join("；") || "未指定"}`,
    `课程提示：${context.guidance || "无"}`,
    "判定标准：先看任务是否完成和表达是否可理解，再指出最重要的一处改进；不要要求逐字复现参考答案。",
  ].join("\n");
}

export function parseAiFeedback(text: string, teachingLocale: TeachingLocale = "zh-CN"): AiFeedback {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 没有返回可识别的反馈格式。");
  const value = JSON.parse(cleaned.slice(start, end + 1)) as Partial<AiFeedback>;
  const verdict = value.verdict === "pass" ? "pass" : value.verdict === "retry" ? "retry" : undefined;
  if (!verdict || typeof value.message !== "string" || !value.message.trim()) throw new Error("AI 反馈缺少判定或说明。");
  return {
    verdict,
    title: typeof value.title === "string" && value.title.trim()
      ? value.title.trim()
      : teachingLocale === "en"
        ? verdict === "pass" ? "Task complete" : "Try again"
        : verdict === "pass" ? "任务完成" : "建议再试一次",
    message: value.message.trim(),
    suggestion: typeof value.suggestion === "string" && value.suggestion.trim() ? value.suggestion.trim() : undefined,
  };
}

async function readJsonResponse(response: Response) {
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error || `AI 服务请求失败（${response.status}）`);
  return data;
}

async function callCompatible(settings: AiSettings, prompt: string, fetcher: Fetcher) {
  const endpoint = resolveCompatibleEndpoint(settings.endpoint);
  if (typeof window !== "undefined" && window.location.protocol === "https:" && endpoint.startsWith("http:")) {
    throw new Error("公开网站不能直连 HTTP 地址；请使用 HTTPS 接口，或在本地运行 LearnLanguage。");
  }
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (settings.apiKey.trim()) headers.authorization = `Bearer ${settings.apiKey.trim()}`;
  const usesResponses = new URL(endpoint).pathname.endsWith("/responses");
  const response = await fetcher(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(usesResponses
      ? { model: settings.model.trim(), input: prompt, store: false }
      : { model: settings.model.trim(), messages: [{ role: "user", content: prompt }] }),
  });
  const data = await readJsonResponse(response);
  const text = responseText(data);
  if (!text.trim()) throw new Error("兼容服务没有返回文本内容。");
  return text;
}

async function callOfficial(settings: AiSettings, action: "test" | "feedback", prompt: string, fetcher: Fetcher) {
  const response = await fetcher("/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, provider: settings.provider, model: settings.model.trim(), apiKey: settings.apiKey.trim(), prompt }),
  });
  const data = await readJsonResponse(response) as { text?: string };
  if (!data.text?.trim()) throw new Error("AI 服务没有返回文本内容。");
  return data.text;
}

async function callAi(settings: AiSettings, action: "test" | "feedback", prompt: string, fetcher: Fetcher) {
  if (!settings.model.trim()) throw new Error("请先填写模型 ID。");
  if (settings.provider !== "compatible" && !settings.apiKey.trim()) throw new Error("该服务商需要 API 密钥。");
  return settings.provider === "compatible"
    ? callCompatible(settings, prompt, fetcher)
    : callOfficial(settings, action, prompt, fetcher);
}

export async function testAiConnection(settings: AiSettings, fetcher: Fetcher = fetch) {
  const text = await callAi(settings, "test", "只回复 OK。", fetcher);
  return text.trim();
}

export async function requestAiFeedback(settings: AiSettings, context: LearningFeedbackContext, fetcher: Fetcher = fetch) {
  const text = await callAi(settings, "feedback", buildLearningFeedbackPrompt(context), fetcher);
  return parseAiFeedback(text, context.teachingLocale);
}
