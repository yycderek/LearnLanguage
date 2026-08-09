import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("build contains the visual course studio and language pack workflow", async () => {
  const [page, learnPage, studioPage, studio, player, dashboard, reviewPlayer, css, languagePack, learning, deviceRepository, ai, aiRoute] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/learn/page.tsx", root), "utf8"),
    readFile(new URL("app/studio/page.tsx", root), "utf8"),
    readFile(new URL("app/course-studio.tsx", root), "utf8"),
    readFile(new URL("app/learning-player.tsx", root), "utf8"),
    readFile(new URL("app/learning-dashboard.tsx", root), "utf8"),
    readFile(new URL("app/review-player.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("lib/language-pack.ts", root), "utf8"),
    readFile(new URL("lib/learning.ts", root), "utf8"),
    readFile(new URL("lib/device-repository.ts", root), "utf8"),
    readFile(new URL("lib/ai.ts", root), "utf8"),
    readFile(new URL("app/api/ai/route.ts", root), "utf8"),
    access(new URL("dist/server/index.js", root)),
  ]);
  assert.match(page, /redirect\("\/learn"\)/);
  assert.match(learnPage, /CourseStudio space="learn"/);
  assert.match(studioPage, /CourseStudio space="studio"/);
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
  assert.doesNotMatch(studio, /语音区域代码/);
  assert.match(studio, /AI 设置/);
  assert.match(studio, /测试连接/);
  assert.match(studio, /sessionStorage/);
  assert.doesNotMatch(studio, /localStorage/);
  assert.match(studio, /无需登录/);
  assert.match(studio, /学习空间/);
  assert.match(studio, /预览学习流程/);
  assert.match(studio, /预览使用临时档案/);
  assert.match(studio, /校验并发布/);
  assert.match(studio, /已发布课程不可修改/);
  assert.match(studio, /Course Pack v2/);
  assert.match(studio, /安装到学习空间/);
  assert.match(languagePack, /validateLanguagePack/);
  assert.match(player, /本课学习完成/);
  assert.match(player, /根据提示重试/);
  assert.match(player, /AI 反馈中/);
  assert.match(player, /AI 反馈/);
  assert.match(player, /AI 参考 · 不自动评分/);
  assert.match(player, /advance\("self"\)/);
  assert.doesNotMatch(player, /result\.verdict === "pass"\) setFeedback\(\{ kind: "success"/);
  assert.match(player, /已生成的复习任务/);
  assert.match(dashboard, /今日复习/);
  assert.match(dashboard, /课程目录/);
  assert.match(reviewPlayer, /显示答案/);
  assert.match(reviewPlayer, /提高掌握度并延长间隔/);
  assert.match(learning, /submitLearningStep/);
  assert.match(learning, /from "@learn-language\/engine"/);
  assert.match(learning, /submitAttempt/);
  assert.match(learning, /scheduleReviews/);
  assert.match(learning, /completeReviewTask/);
  assert.match(deviceRepository, /learn-language-device-v1/);
  assert.match(deviceRepository, /implements SessionEventRepository/);
  assert.match(deviceRepository, /implements EffectQueue/);
  assert.match(deviceRepository, /persistLearningState/);
  assert.match(ai, /requestAiFeedback/);
  assert.match(aiRoute, /api\.openai\.com\/v1\/responses/);
  assert.match(css, /studio-shell/);
  assert.match(css, /visual-editor/);
  assert.match(css, /learner-shell/);
  assert.match(css, /learning-home-shell/);
  assert.match(css, /review-player-shell/);
  assert.doesNotMatch(`${page}${studio}`, /Your site is taking shape|SkeletonPreview/);
});
