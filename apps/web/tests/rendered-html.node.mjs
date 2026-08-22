import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("build contains the visual course studio and language pack workflow", async () => {
  const [page, learnPage, studioPage, readme, studio, studioStart, productGuide, draftManager, languagePackManager, player, renderer, dashboard, courseLibraryPage, reviewPlayer, css, languagePack, languagePackFile, starterLibrary, courseLibrary, courseFile, draftLibrary, learnerBackup, learning, courseAuthoring, courseTemplates, publishReadiness, deviceSync, deviceRepository, applicationWorkspace, applicationAuthoring, languageRuntime, ai, aiRoute, worker, nextConfig] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/learn/page.tsx", root), "utf8"),
    readFile(new URL("app/studio/page.tsx", root), "utf8"),
    readFile(new URL("../../README.md", root), "utf8"),
    readFile(new URL("app/course-studio.tsx", root), "utf8"),
    readFile(new URL("app/studio-start.tsx", root), "utf8"),
    readFile(new URL("app/product-guide.tsx", root), "utf8"),
    readFile(new URL("app/draft-manager.tsx", root), "utf8"),
    readFile(new URL("app/language-pack-manager.tsx", root), "utf8"),
    readFile(new URL("app/learning-player.tsx", root), "utf8"),
    readFile(new URL("app/exercise-renderer.tsx", root), "utf8"),
    readFile(new URL("app/learning-dashboard.tsx", root), "utf8"),
    readFile(new URL("app/course-library.tsx", root), "utf8"),
    readFile(new URL("app/review-player.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("lib/language-pack.ts", root), "utf8"),
    readFile(new URL("lib/language-pack-file.ts", root), "utf8"),
    readFile(new URL("lib/starter-course-library.ts", root), "utf8"),
    readFile(new URL("lib/course-library.ts", root), "utf8"),
    readFile(new URL("lib/course-file.ts", root), "utf8"),
    readFile(new URL("lib/draft-library.ts", root), "utf8"),
    readFile(new URL("lib/learner-backup.ts", root), "utf8"),
    readFile(new URL("lib/learning.ts", root), "utf8"),
    readFile(new URL("lib/course-authoring.ts", root), "utf8"),
    readFile(new URL("lib/course-templates.ts", root), "utf8"),
    readFile(new URL("lib/publish-readiness.ts", root), "utf8"),
    readFile(new URL("lib/sync.ts", root), "utf8"),
    readFile(new URL("lib/device-repository.ts", root), "utf8"),
    readFile(new URL("../../packages/application/src/workspace.ts", root), "utf8"),
    readFile(new URL("../../packages/application/src/authoring.ts", root), "utf8"),
    readFile(new URL("../../packages/language-runtime/src/index.ts", root), "utf8"),
    readFile(new URL("lib/ai.ts", root), "utf8"),
    readFile(new URL("app/api/ai/route.ts", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("next.config.ts", root), "utf8"),
    access(new URL("dist/server/index.js", root)),
  ]);
  assert.match(page, /redirect\("\/learn"\)/);
  assert.match(learnPage, /CourseStudio space="learn"/);
  assert.match(studioPage, /CourseStudio space="studio"/);
  assert.match(readme, /五分钟快速开始/);
  assert.match(readme, /learnlanguage-studio\.yycderek\.chatgpt\.site\/learn/);
  assert.match(readme, /AI 是可选的/);
  assert.match(readme, /本地数据与备份/);
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
  assert.match(studio, /课程单元与课节/);
  assert.match(studio, /ReferencePicker/);
  assert.match(studio, /素材生成课程/);
  assert.doesNotMatch(studio, /课节 ID/);
  assert.doesNotMatch(studio, /关联知识点（逗号分隔）/);
  assert.match(studioStart, /导入素材生成草稿/);
  assert.match(studio, /PDF 或 DOCX/);
  assert.match(studio, /我确认有权将这些素材用于自己的课程/);
  assert.match(css, /unit-manager/);
  assert.match(css, /reference-picker/);
  assert.doesNotMatch(studio, /next\.lessons\[0\]\.steps/);
  assert.match(studio, /课程流程预览/);
  assert.match(studio, /创建或导入 Language Pack/);
  assert.match(studio, /快速创建/);
  assert.match(studio, /导入 JSON/);
  assert.doesNotMatch(studio, /语音区域代码/);
  assert.match(studio, /AI 设置/);
  assert.match(studio, /PRODUCT_GUIDE_SEEN_KEY/);
  assert.match(studio, /使用帮助/);
  assert.match(studio, /ProductGuide/);
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
  assert.match(studio, /learningView === "library"/);
  assert.match(studio, /installLibraryCourse/);
  assert.match(studio, /updateLibraryCourse/);
  assert.match(studio, /uninstallLibraryCourse/);
  assert.match(studio, /importCourseFile/);
  assert.match(studio, /exportLibraryCourse/);
  assert.match(studio, /exportLearnerProfile/);
  assert.match(studio, /importLearnerProfile/);
  assert.match(studio, /learningView === "drafts"/);
  assert.match(studio, /importDraftFile/);
  assert.match(studio, /exportDraftRevision/);
  assert.match(studio, /deleteLocalDraft/);
  assert.match(studio, /learningView === "languages"/);
  assert.match(studio, /importLanguagePackFile/);
  assert.match(studio, /exportLanguagePack/);
  assert.match(studio, /deleteLanguagePack/);
  assert.match(studio, /draftApplication\.saveRevision/);
  assert.match(studio, /languagePackApplication\.import/);
  assert.match(studio, /courseLibraryApplication\.install/);
  assert.match(studio, /compatibilityBlocked/);
  assert.match(studio, /assessCourseLanguageCompatibility/);
  assert.match(studio, /profileBackupApplication\.restore/);
  assert.match(studio, /课程内容许可证/);
  assert.match(studio, /发布检查清单/);
  assert.match(studio, /从课程模板开始/);
  assert.match(studio, /duplicateLesson/);
  assert.match(studio, /confirmCourseTrust/);
  assert.match(studio, /performDeviceSync/);
  assert.match(studio, /verifyPublishedCourseIntegrity/);
  assert.match(studio, /所需语言能力/);
  assert.match(studio, /能力不足时/);
  assert.match(studio, /APP_LOCALE_PREFERENCE_KEY/);
  assert.match(studio, /resolveStoredAppLocale/);
  assert.match(studio, /Course content editor/);
  assert.match(studio, /changeAppLocale/);
  assert.match(studio, /Language selector/);
  assert.match(studio, /英文名称/);
  assert.match(studio, /sampleCourse\("und", "Target language"\)/);
  assert.match(studio, /studioStarted/);
  assert.match(studioStart, /先选择课程的目标语言/);
  assert.match(studioStart, /Studio 不预设日语或粤语/);
  assert.match(studioStart, /这些只是现成示例，不代表平台只支持这些语言/);
  assert.match(studioStart, /创建或导入目标语言/);
  assert.match(studioStart, /导入课程草稿/);
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
  assert.match(player, /buildLearnerStages/);
  assert.match(player, /理解/);
  assert.match(player, /练习/);
  assert.match(player, /运用/);
  assert.match(player, /Lesson complete/);
  assert.match(player, /locale/);
  assert.match(player, /uiText\(locale/);
  assert.doesNotMatch(player, /teachingLocale\?:/);
  assert.doesNotMatch(player, /uiLocale\?:/);
  assert.match(player, /displayText\(exercise\.prompt, teachingLocale\)/);
  assert.match(player, /evaluateExerciseResponse/);
  assert.match(player, /serializeExerciseResponse/);
  assert.match(player, /exercise\.capabilityFallback \?\? "disabled"/);
  assert.match(renderer, /rendererRegistry/);
  assert.match(renderer, /multiple-choice/);
  assert.match(renderer, /ordering-list/);
  assert.match(renderer, /role-task-banner/);
  assert.match(studio, /正确选项序号（逗号分隔）/);
  assert.match(studio, /按上方行顺序/);
  assert.match(dashboard, /今日复习/);
  assert.match(dashboard, /课程目录/);
  assert.match(dashboard, /Full course outline/);
  assert.match(dashboard, /learning-product-shell/);
  assert.match(dashboard, /product-mode-switch/);
  assert.match(dashboard, /本课学习地图/);
  assert.match(dashboard, /learning-task-node/);
  assert.match(dashboard, /learning-stage-progress/);
  assert.match(dashboard, /aria-current/);
  assert.match(dashboard, /learning-task-path/);
  assert.match(dashboard, /buildLearnerStages/);
  assert.match(dashboard, /理解/);
  assert.match(dashboard, /练习/);
  assert.match(dashboard, /运用/);
  assert.doesNotMatch(dashboard, /XP|排行榜/);
  assert.match(dashboard, /onLocaleChange/);
  assert.match(dashboard, /onOpenLibrary/);
  assert.match(dashboard, /onOpenHelp/);
  assert.match(dashboard, /uiText\(locale/);
  assert.doesNotMatch(dashboard, /onTeachingLocaleChange|onUiLocaleChange/);
  assert.match(dashboard, /displayText\(course\.manifest\.title, teachingLocale\)/);
  assert.match(courseLibraryPage, /从一门课程开始/);
  assert.match(courseLibraryPage, /平台的学习流程不绑定日语或粤语/);
  assert.match(courseLibraryPage, /设计自己的课程/);
  assert.match(courseLibraryPage, /一键开始学习/);
  assert.match(courseLibraryPage, /完成课程后，你将能够/);
  assert.match(courseLibraryPage, /预计用时/);
  assert.match(courseLibraryPage, /每课约 15–25 分钟/);
  assert.match(courseLibraryPage, /课程与数据管理/);
  assert.match(courseLibraryPage, /返回学习首页/);
  assert.match(courseLibraryPage, /使用帮助/);
  assert.match(courseLibraryPage, /更新并保留进度/);
  assert.match(courseLibraryPage, /导入他人分享的课程/);
  assert.match(courseLibraryPage, /只有收到课程文件时才需要使用/);
  assert.match(courseLibraryPage, /导出备份/);
  assert.match(courseLibraryPage, /学习档案备份/);
  assert.match(courseLibraryPage, /恢复学习档案/);
  assert.match(courseLibraryPage, /可选设备同步/);
  assert.match(courseLibraryPage, /官方可信来源/);
  assert.doesNotMatch(courseLibraryPage, /manifest\.languageId === "ja"/);
  assert.match(courseTemplates, /scenario-course/);
  assert.match(publishReadiness, /assessPublishReadiness/);
  assert.match(deviceSync, /class DeviceSyncClientStore/);
  assert.match(deviceSync, /resolveConflicts/);
  assert.match(courseLibrary, /assessCourseUpdate/);
  assert.match(courseLibrary, /upgradeCourseLearningRecord/);
  assert.match(courseLibrary, /bundledCatalogCourses/);
  assert.match(courseFile, /parseCourseFile/);
  assert.match(courseFile, /serializeCourseFile/);
  assert.match(draftManager, /管理课程草稿/);
  assert.match(draftManager, /恢复任意修订/);
  assert.match(draftManager, /导入草稿文件/);
  assert.match(draftManager, /导出最新草稿/);
  assert.match(draftLibrary, /groupDraftRevisions/);
  assert.match(draftLibrary, /parseDraftFile/);
  assert.match(draftLibrary, /MAX_DRAFT_REVISIONS/);
  assert.match(languagePackManager, /管理目标语言定义/);
  assert.match(languagePackManager, /导入语言包/);
  assert.match(languagePackManager, /仍被编辑器、草稿或已安装课程引用/);
  assert.match(languagePackFile, /parseLanguagePackFile/);
  assert.match(languagePackFile, /languagePackUsage/);
  assert.match(languagePackFile, /MAX_LANGUAGE_PACK_FILE_BYTES/);
  assert.match(learnerBackup, /createLearnerBackup/);
  assert.match(learnerBackup, /mergeLearnerRecords/);
  assert.doesNotMatch(learnerBackup, /apiKey/);
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
  assert.match(deviceRepository, /putInstalledCourseVersion/);
  assert.match(deviceRepository, /removeInstalledCourse/);
  assert.match(deviceRepository, /putCourseRecords/);
  assert.match(deviceRepository, /implements DraftRepository/);
  assert.match(deviceRepository, /implements LanguagePackRepository/);
  assert.match(deviceRepository, /implements InstalledCourseRepository/);
  assert.match(deviceRepository, /implements LearningProfileRepository/);
  assert.match(applicationWorkspace, /class DraftApplicationService/);
  assert.match(applicationWorkspace, /class LanguagePackApplicationService/);
  assert.match(applicationWorkspace, /class CourseLibraryApplicationService/);
  assert.match(applicationWorkspace, /class ProfileBackupApplicationService/);
  assert.match(applicationAuthoring, /class CourseAuthoringApplicationService/);
  assert.match(languageRuntime, /assessCourseLanguageCompatibility/);
  assert.match(languageRuntime, /course-adapter-mismatch/);
  assert.match(languageRuntime, /exercise-capability-missing/);
  assert.match(ai, /requestAiFeedback/);
  assert.match(aiRoute, /api\.openai\.com\/v1\/responses/);
  assert.match(worker, /withFreshDocumentHeaders/);
  assert.match(worker, /Cache-Control", "no-store, max-age=0/);
  assert.match(worker, /CDN-Cache-Control", "no-store/);
  assert.match(nextConfig, /freshDocumentHeaders/);
  assert.match(nextConfig, /"\/learn", "\/studio"/);
  assert.match(nextConfig, /Cache-Control", value: "no-store, max-age=0/);
  assert.match(productGuide, /学习和课程设计是两个独立空间/);
  assert.match(productGuide, /一键开始学习/);
  assert.match(productGuide, /基础检查决定是否跳过/);
  assert.match(productGuide, /AI 可以不设置/);
  assert.match(productGuide, /保存、预览、发布、安装是四个不同动作/);
  assert.match(productGuide, /aria-modal="true"/);
  assert.match(productGuide, /event\.key === "Escape"/);
  assert.match(css, /studio-shell/);
  assert.match(css, /visual-editor/);
  assert.match(css, /learner-shell/);
  assert.match(css, /learning-home-shell/);
  assert.match(css, /course-library-shell/);
  assert.match(css, /learner-backup-bar/);
  assert.match(css, /draft-library-shell/);
  assert.match(css, /language-library-shell/);
  assert.match(css, /review-player-shell/);
  assert.match(css, /product-guide-dialog/);
  assert.match(css, /studio-start-page/);
  assert.match(css, /course-entry-paths/);
  assert.match(css, /learning-product-shell/);
  assert.match(css, /learning-task-path/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 44px minmax\(0, 1fr\) 44px minmax\(0, 1fr\)/);
  assert.match(css, /\.learning-task\.active::after/);
  assert.match(css, /\.learning-task\.completed \.learning-stage-progress span/);
  assert.match(css, /@keyframes learning-complete-pop/);
  assert.match(css, /prefers-reduced-motion: reduce[^}]*animation: none !important/);
  assert.match(css, /studio-mode-switch/);
  assert.match(css, /--primary: #5a48d6/);
  assert.match(css, /--green: var\(--primary\)/);
  assert.match(css, /--success: #278d69/);
  assert.match(css, /Unified product scale/);
  assert.match(css, /\.learner-shell, \.review-player-shell/);
  assert.match(css, /\.studio-start-hero h1[^{]*\{[^}]*font-family: inherit/);
  assert.match(css, /\.learning-focus-goal \{[^}]*font-size: 14px/);
  assert.match(css, /\.draft-library-toolbar > label[^}]*background: var\(--primary\)/);
  assert.doesNotMatch(`${page}${studio}`, /Your site is taking shape|SkeletonPreview/);
});
