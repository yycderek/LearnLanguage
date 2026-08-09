type AiProvider = "openai" | "anthropic" | "gemini";

type AiGatewayRequest = {
  action?: "test" | "feedback";
  provider?: AiProvider;
  model?: string;
  apiKey?: string;
  prompt?: string;
};

const SYSTEM_PROMPT = "You are a strict but supportive language teacher. Follow the requested output format and response language. Keep feedback concise and specific. Do not evaluate pronunciation. / 你是一名严格但支持学习者的语言教师，请遵循要求的格式与回复语言。";

function json(data: object, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

function extractText(provider: AiProvider, data: unknown) {
  if (provider === "openai") {
    const value = data as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    return value.output_text ?? value.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
  }
  if (provider === "anthropic") {
    const value = data as { content?: Array<{ type?: string; text?: string }> };
    return value.content?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("") ?? "";
  }
  const value = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return value.candidates?.[0]?.content?.parts?.map((item) => item.text ?? "").join("") ?? "";
}

async function providerRequest(provider: AiProvider, model: string, apiKey: string, prompt: string, action: "test" | "feedback") {
  const maxTokens = action === "test" ? 32 : 700;
  if (provider === "openai") {
    return fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model, input: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }], max_output_tokens: maxTokens, store: false }),
    });
  }
  if (provider === "anthropic") {
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: SYSTEM_PROMPT, messages: [{ role: "user", content: prompt }] }),
    });
  }
  const modelId = model.replace(/^models\//, "");
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
}

export async function POST(request: Request) {
  let body: AiGatewayRequest;
  try {
    body = await request.json() as AiGatewayRequest;
  } catch {
    return json({ error: "请求格式无效。" }, 400);
  }
  const action = body.action === "test" ? "test" : body.action === "feedback" ? "feedback" : undefined;
  const provider = (["openai", "anthropic", "gemini"] as const).find((item) => item === body.provider);
  const model = body.model?.trim() ?? "";
  const apiKey = body.apiKey?.trim() ?? "";
  const prompt = body.prompt?.trim() ?? "";
  if (!action || !provider || !model || !apiKey || !prompt) return json({ error: "AI 请求缺少必要配置。" }, 400);
  if (model.length > 200 || apiKey.length > 600 || prompt.length > 12_000) return json({ error: "AI 请求内容过长。" }, 400);

  try {
    const response = await providerRequest(provider, model, apiKey, prompt, action);
    const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
    if (!response.ok) return json({ error: data.error?.message || `AI 服务返回错误（${response.status}）。` }, response.status >= 500 ? 502 : 400);
    const text = extractText(provider, data);
    if (!text.trim()) return json({ error: "AI 服务没有返回文本内容。" }, 502);
    return json({ text });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "无法连接 AI 服务。" }, 502);
  }
}
