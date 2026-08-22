export const MAX_MATERIAL_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_MATERIALS = 12;

export type MaterialKind = "article" | "dialogue" | "lyrics" | "subtitle" | "document";

export type CourseMaterial = {
  id: string;
  title: string;
  text: string;
  kind: MaterialKind;
  sourceLabel?: string;
  sourceUrl?: string;
};

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "html", "htm", "srt", "vtt", "lrc"]);

function extension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function titleFromFile(name: string) {
  return name.replace(/\.[^.]+$/u, "").trim() || name;
}

function normalizeText(value: string) {
  return value.replace(/\r\n?/gu, "\n").replace(/[ \t]+\n/gu, "\n").replace(/\n{4,}/gu, "\n\n\n").trim();
}

function htmlToText(value: string) {
  const document = new DOMParser().parseFromString(value, "text/html");
  document.querySelectorAll("script,style,noscript,template,svg").forEach((node) => node.remove());
  return normalizeText(document.body.textContent ?? "");
}

function subtitleToText(value: string) {
  return normalizeText(value
    .replace(/^WEBVTT[^\n]*\n/iu, "")
    .replace(/^\s*\d+\s*$/gmu, "")
    .replace(/^.*-->.*$/gmu, "")
    .replace(/<[^>]+>/gu, ""));
}

function lyricsToText(value: string) {
  return normalizeText(value
    .replace(/^\[(?:ar|al|ti|by|offset|re|ve):[^\]]*\]\s*$/gimu, "")
    .replace(/\[(?:\d{1,2}:)?\d{1,2}(?:[.:]\d{1,3})?\]/gu, ""));
}

function inferredKind(fileName: string): MaterialKind {
  const ext = extension(fileName);
  if (ext === "lrc") return "lyrics";
  if (ext === "srt" || ext === "vtt") return "subtitle";
  if (ext === "pdf" || ext === "docx") return "document";
  return "article";
}

export async function extractMaterialFile(file: File): Promise<CourseMaterial> {
  if (file.size > MAX_MATERIAL_FILE_BYTES) throw new Error("material-file-too-large");
  const ext = extension(file.name);
  let text = "";
  if (TEXT_EXTENSIONS.has(ext)) {
    const source = await file.text();
    text = ext === "html" || ext === "htm" ? htmlToText(source) : ext === "srt" || ext === "vtt" ? subtitleToText(source) : ext === "lrc" ? lyricsToText(source) : normalizeText(source);
  } else if (ext === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    text = normalizeText((await extractText(pdf, { mergePages: true })).text);
  } else if (ext === "docx") {
    const mammoth = await import("mammoth");
    text = normalizeText((await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value);
  } else {
    throw new Error("material-file-unsupported");
  }
  if (text.length < 20) throw new Error("material-file-empty");
  return { id: crypto.randomUUID(), title: titleFromFile(file.name), text, kind: inferredKind(file.name), sourceLabel: file.name };
}

export async function fetchMaterialUrl(url: string, fetcher: typeof fetch = fetch): Promise<CourseMaterial> {
  const response = await fetcher("/api/material", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
  const data = await response.json().catch(() => ({})) as { error?: string; title?: string; text?: string; url?: string };
  if (!response.ok) throw new Error(data.error || "material-url-failed");
  if (!data.text || data.text.length < 20) throw new Error("material-file-empty");
  return { id: crypto.randomUUID(), title: data.title?.trim() || new URL(url).hostname, text: data.text, kind: "article", sourceLabel: data.url ?? url, sourceUrl: data.url ?? url };
}
