import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("build contains the visual course studio and language pack workflow", async () => {
  const [page, studio, css, languagePack] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/course-studio.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("lib/language-pack.ts", root), "utf8"),
    access(new URL("dist/server/index.js", root)),
  ]);
  assert.match(page, /CourseStudio/);
  assert.match(studio, /课程编辑器/);
  assert.match(studio, /可视化/);
  assert.match(studio, /基本信息/);
  assert.match(studio, /添加知识点/);
  assert.match(studio, /添加例句/);
  assert.match(studio, /添加练习/);
  assert.match(studio, /课程流程预览/);
  assert.match(studio, /创建或导入 Language Pack/);
  assert.match(studio, /快速创建/);
  assert.match(studio, /导入 JSON/);
  assert.match(studio, /AI 设置/);
  assert.match(studio, /无需登录/);
  assert.match(studio, /learn-language-ai-settings-v1/);
  assert.match(studio, /learn-language-packs-v1/);
  assert.match(languagePack, /validateLanguagePack/);
  assert.match(css, /studio-shell/);
  assert.match(css, /visual-editor/);
  assert.doesNotMatch(`${page}${studio}`, /Your site is taking shape|SkeletonPreview/);
});
