import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("build contains the visual course studio and language pack workflow", async () => {
  const [page, learnPage, studioPage, studio, player, renderer, dashboard, reviewPlayer, css, languagePack, starterLibrary, learning, courseAuthoring, deviceRepository, ai, aiRoute] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/learn/page.tsx", root), "utf8"),
    readFile(new URL("app/studio/page.tsx", root), "utf8"),
    readFile(new URL("app/course-studio.tsx", root), "utf8"),
    readFile(new URL("app/learning-player.tsx", root), "utf8"),
    readFile(new URL("app/exercise-renderer.tsx", root), "utf8"),
    readFile(new URL("app/learning-dashboard.tsx", root), "utf8"),
    readFile(new URL("app/review-player.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("lib/language-pack.ts", root), "utf8"),
    readFile(new URL("lib/starter-course-library.ts", root), "utf8"),
    readFile(new URL("lib/learning.ts", root), "utf8"),
    readFile(new URL("lib/course-authoring.ts", root), "utf8"),
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
  assert.match(studio, /添加课节/);
  assert.match(studio, /selectedStudioLessonId/);
  assert.match(studio, /课程课节顺序/);
  assert.match(studio, /moveLessonStep/);
  assert.doesNotMatch(studio, /next\.lessons\[0\]\.steps/);
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
  assert.match(studio, /课程内容许可证/);
  assert.match(studio, /verifyPublishedCourseIntegrity/);
  assert.match(studio, /所需语言能力/);
  assert.match(studio, /能力不足时/);
  assert.match(studio, /APP_LOCALE_PREFERENCE_KEY/);
  assert.match(studio, /resolveStoredAppLocale/);
  assert.match(studio, /Course content editor/);
  assert.match(studio, /changeAppLocale/);
  assert.match(studio, /Language selector/);
  assert.match(studio, /英文名称/);
  assert.match(languagePack, /validateLanguagePack/);
  assert.match(languagePack, /resolveExerciseCapabilities/);
  assert.match(languagePack, /resolveLanguageRuntime/);
  assert.match(starterLibrary, /bundledStarterLanguageIds/);
  assert.match(starterLibrary, /japaneseCourse/);
  assert.match(starterLibrary, /cantoneseCourse/);
  assert.match(player, /本课学习完成/);
  assert.match(player, /根据提示重试/);
  assert.match(player, /AI 反馈中/);
  assert.match(player, /AI 反馈/);
  assert.match(player, /AI 参考 · 不自动评分/);
  assert.match(player, /createAiFeedbackEffect/);
  assert.match(player, /IndexedDbEffectQueue/);
  assert.match(player, /当前语言能力不足/);
  assert.match(player, /请对照参考答案自行确认/);
  assert.match(player, /advance\("self"\)/);
  assert.doesNotMatch(player, /result\.verdict === "pass"\) setFeedback\(\{ kind: "success"/);
  assert.match(player, /已生成的复习任务/);
  assert.match(player, /Lesson complete/);
  assert.match(player, /locale/);
  assert.match(player, /uiText\(locale/);
  assert.doesNotMatch(player, /teachingLocale\?:/);
  assert.doesNotMatch(player, /uiLocale\?:/);
  assert.match(player, /displayText\(exercise\.prompt, teachingLocale\)/);
  assert.match(player, /evaluateExerciseResponse/);
  assert.match(player, /serializeExerciseResponse/);
  assert.match(renderer, /rendererRegistry/);
  assert.match(renderer, /multiple-choice/);
  assert.match(renderer, /ordering-list/);
  assert.match(renderer, /role-task-banner/);
  assert.match(studio, /正确选项序号（逗号分隔）/);
  assert.match(studio, /按上方行顺序/);
  assert.match(dashboard, /今日复习/);
  assert.match(dashboard, /课程目录/);
  assert.match(dashboard, /Course outline/);
  assert.match(dashboard, /onLocaleChange/);
  assert.match(dashboard, /uiText\(locale/);
  assert.doesNotMatch(dashboard, /onTeachingLocaleChange|onUiLocaleChange/);
  assert.match(dashboard, /displayText\(course\.manifest\.title, teachingLocale\)/);
  assert.match(reviewPlayer, /显示答案/);
  assert.match(reviewPlayer, /提高掌握度并延长间隔/);
  assert.match(reviewPlayer, /uiText\(locale/);
  assert.match(reviewPlayer, /displayText\(content\.meaning, teachingLocale\)/);
  assert.match(learning, /submitLearningStep/);
  assert.match(learning, /from "@learn-language\/engine"/);
  assert.match(learning, /submitAttempt/);
  assert.match(learning, /scheduleReviews/);
  assert.match(learning, /projectKnowledgeMastery/);
  assert.match(learning, /completeReviewTask/);
  assert.match(courseAuthoring, /rewireLinearLesson/);
  assert.match(courseAuthoring, /appendLesson/);
  assert.match(courseAuthoring, /removeLessonStep/);
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
