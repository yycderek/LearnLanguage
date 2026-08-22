import { isIP } from "node:net";

const MAX_REMOTE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function json(data: object, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

function isPrivateIpv4(host: string) {
  const parts = host.split(".").map(Number);
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

function validateRemoteUrl(value: string) {
  const url = new URL(value);
  if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password) throw new Error("只支持公开的 HTTP 或 HTTPS 网页地址。");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "0.0.0.0") throw new Error("不能导入本机或内网地址。");
  if (isIP(host) === 4 && isPrivateIpv4(host)) throw new Error("不能导入本机或内网地址。");
  if (isIP(host) === 6 && (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb"))) throw new Error("不能导入本机或内网地址。");
  if (!url.port || (url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) return url;
  throw new Error("网页地址只能使用标准 HTTP/HTTPS 端口。");
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[\da-f]+|[a-z]+);/giu, (_, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    }
    return named[entity.toLowerCase()] ?? " ";
  });
}

function htmlText(value: string) {
  const title = decodeEntities(value.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1]?.replace(/<[^>]*>/gu, " ") ?? "").replace(/\s+/gu, " ").trim();
  const text = decodeEntities(value
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<(script|style|noscript|template|svg)[^>]*>[\s\S]*?<\/\1>/giu, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)>/giu, "\n")
    .replace(/<[^>]+>/gu, " "))
    .replace(/[ \t]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  return { title, text };
}

async function readLimited(response: Response) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_REMOTE_BYTES) throw new Error("网页内容超过 2 MB，请下载后作为文件导入。");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REMOTE_BYTES) {
      await reader.cancel();
      throw new Error("网页内容超过 2 MB，请下载后作为文件导入。");
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => { joined.set(chunk, offset); offset += chunk.byteLength; });
  return new TextDecoder().decode(joined);
}

async function fetchPublicPage(initial: URL) {
  let current = initial;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { accept: "text/html,text/plain;q=0.9", "user-agent": "LearnLanguage material importer" } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw new Error("网页重定向次数过多。");
      current = validateRemoteUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`网页返回错误（${response.status}）。`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml+xml")) throw new Error("该网址不是可读取的网页文本；PDF 或 Word 请下载后上传。");
    const raw = await readLimited(response);
    const parsed = contentType.includes("text/plain") ? { title: "", text: raw.trim() } : htmlText(raw);
    return { ...parsed, url: current.toString() };
  }
  throw new Error("无法读取网页。");
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: string };
    const url = validateRemoteUrl(body.url?.trim() ?? "");
    const result = await fetchPublicPage(url);
    if (result.text.length < 20) return json({ error: "网页中没有足够的可读正文。" }, 400);
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法读取网页。";
    return json({ error: message === "Invalid URL" ? "请输入有效的网页地址。" : message }, 400);
  }
}
