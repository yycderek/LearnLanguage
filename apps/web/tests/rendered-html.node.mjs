import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("build contains the course studio and no starter skeleton", async () => {
  const [page, studio, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/course-studio.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    access(new URL("dist/server/index.js", root)),
  ]);
  assert.match(page, /CourseStudio/);
  assert.match(studio, /课程编辑器/);
  assert.match(studio, /导入与校验/);
  assert.match(studio, /课程流程预览/);
  assert.match(studio, /AI 设置/);
  assert.match(studio, /无需登录/);
  assert.match(studio, /learn-language-ai-settings-v1/);
  assert.match(css, /studio-shell/);
  assert.doesNotMatch(`${page}${studio}`, /Your site is taking shape|SkeletonPreview/);
});
