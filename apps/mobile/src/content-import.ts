import { canonicalizeCourse, validateCourse, validateLanguagePack } from "@learn-language/content";
import type { CoursePack, LanguageDefinition, PublishedCoursePack } from "@learn-language/protocol";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import type { MobileLocale } from "./model";

export const MAX_MOBILE_COURSE_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_MOBILE_LANGUAGE_PACK_FILE_BYTES = 1024 * 1024;

const c = (locale: MobileLocale, zh: string, en: string) => locale === "zh-CN" ? zh : en;

async function chooseJsonText(maxBytes: number, locale: MobileLocale) {
  const picked = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
  if (picked.canceled) return undefined;
  const asset = picked.assets[0];
  if (!asset) throw new Error(c(locale, "没有读取到文件", "No file was selected"));
  if (asset.size !== undefined && asset.size > maxBytes) throw new Error(c(locale, "文件超过允许大小", "The file is too large"));
  const text = await new File(asset.uri).text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error(c(locale, "文件超过允许大小", "The file is too large"));
  return { name: asset.name, text };
}

export async function chooseLanguagePackFile(locale: MobileLocale): Promise<{ name: string; pack: LanguageDefinition } | undefined> {
  const selected = await chooseJsonText(MAX_MOBILE_LANGUAGE_PACK_FILE_BYTES, locale);
  if (!selected) return undefined;
  const result = validateLanguagePack(selected.text);
  if (!result.pack) throw new Error(result.error ?? c(locale, "Language Pack 无效", "Invalid Language Pack"));
  return { name: selected.name, pack: result.pack };
}

export async function chooseCoursePackFile(locale: MobileLocale): Promise<{ name: string; course: PublishedCoursePack } | undefined> {
  const selected = await chooseJsonText(MAX_MOBILE_COURSE_FILE_BYTES, locale);
  if (!selected) return undefined;
  const result = validateCourse(selected.text);
  if (!result.course) {
    const first = result.issues[0];
    throw new Error(first ? `${first.path}: ${first.message}` : c(locale, "Course Pack 无效", "Invalid Course Pack"));
  }
  const course = result.course;
  if (course.manifest.status !== "published") throw new Error(c(locale, "移动端只能导入已发布课程", "Mobile can only import published courses"));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonicalizeCourse(course));
  const expected = `sha256:${digest}`;
  if (course.manifest.contentHash !== expected) throw new Error(c(locale, "课程内容哈希校验失败，文件可能已被修改", "Course integrity check failed; the file may have been modified"));
  return { name: selected.name, course: course as PublishedCoursePack };
}

export function mergeMobileCourses(bundled: readonly CoursePack[], installed: readonly CoursePack[]): CoursePack[] {
  const merged = new Map(bundled.map((course) => [course.manifest.id, course]));
  for (const course of installed) if (!merged.has(course.manifest.id)) merged.set(course.manifest.id, course);
  return [...merged.values()];
}

export function mergeMobileLanguagePacks(builtIn: readonly LanguageDefinition[], installed: readonly LanguageDefinition[]): LanguageDefinition[] {
  const merged = new Map(builtIn.map((pack) => [pack.id, pack]));
  for (const pack of installed) if (!merged.has(pack.id)) merged.set(pack.id, pack);
  return [...merged.values()];
}