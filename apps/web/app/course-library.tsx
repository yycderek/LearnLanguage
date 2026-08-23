"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArchiveRestore,
  BookOpen,
  CircleHelp,
  Cloud,
  DatabaseBackup,
  FileDown,
  GraduationCap,
  Languages,
  Library,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Target,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { displayText } from "@/lib/course";
import type { CourseLibraryEntry, CourseUpdateIssue } from "@/lib/course-library";
import type { DeviceBackupPreview } from "@/lib/device-backup";
import { uiText, type AppLocale } from "@/lib/i18n";
import { languageName, type LanguagePack } from "@/lib/language-pack";
import type { DeviceSyncSettings } from "@/lib/sync";

const issueLabels: Record<CourseUpdateIssue, [string, string]> = {
  "not-newer": ["目录版本不比已安装版本新", "The catalog version is not newer"],
  "course-id-changed": ["课程身份发生变化", "The course identity changed"],
  "language-changed": ["目标语言发生变化", "The target language changed"],
  "schema-changed": ["课程格式版本发生变化", "The Course Pack schema changed"],
  "learned-lesson-removed": ["新版本删除了学过的课节", "The update removes a learned lesson"],
  "learning-step-removed": ["新版本删除了学习记录引用的步骤", "The update removes a step referenced by progress"],
  "learned-knowledge-removed": ["新版本删除了已掌握或待复习的知识点", "The update removes learned or scheduled knowledge"],
};

function representativeGoals(entry: CourseLibraryEntry) {
  const goals = entry.course.goals;
  if (goals.length <= 3) return goals;
  return [goals[0], goals[Math.floor((goals.length - 1) / 2)], goals[goals.length - 1]];
}

function estimatedStudyTime(lessonCount: number, locale: AppLocale) {
  const minimumMinutes = lessonCount * 15;
  const maximumMinutes = lessonCount * 25;
  if (maximumMinutes < 60) {
    return uiText(locale, `约 ${minimumMinutes}–${maximumMinutes} 分钟`, `About ${minimumMinutes}–${maximumMinutes} min`);
  }
  const minimumHours = Math.max(1, Math.round(minimumMinutes / 60));
  const maximumHours = Math.max(minimumHours, Math.round(maximumMinutes / 60));
  return uiText(locale, `约 ${minimumHours}–${maximumHours} 小时`, `About ${minimumHours}–${maximumHours} hr`);
}

export function CourseLibrary({
  entries,
  languagePacks,
  locale,
  notice,
  onLocaleChange,
  onOpenHelp,
  onBack,
  onStart,
  onUpdate,
  onUninstall,
  onOpen,
  onImportFile,
  onCreateCourse,
  onExport,
  recordCount,
  planCount,
  onExportProfile,
  onImportProfile,
  deviceBackupPreview,
  deviceBackupBusy,
  onExportDevice,
  onImportDevice,
  onRestoreDevice,
  onCancelDeviceRestore,
  syncSettings,
  syncToken,
  syncStatus,
  onSyncSettingsChange,
  onSyncTokenChange,
  onSync,
  onResolveSync,
  settingsMode = false,
  onOpenSettings,
  onOpenAi,
  onResetCurrentCourse,
  onClearAllData,
  onExportDiagnostics,
  onRebuildStorage,
}: {
  entries: CourseLibraryEntry[];
  languagePacks: LanguagePack[];
  locale: AppLocale;
  notice?: string;
  onLocaleChange: (locale: AppLocale) => void;
  onOpenHelp: () => void;
  onBack: () => void;
  onStart: (entry: CourseLibraryEntry) => void;
  onUpdate: (entry: CourseLibraryEntry) => void;
  onUninstall: (entry: CourseLibraryEntry) => void;
  onOpen: (entry: CourseLibraryEntry) => void;
  onImportFile: (file: File) => void;
  onCreateCourse: () => void;
  onExport: (entry: CourseLibraryEntry) => void;
  recordCount: number;
  planCount: number;
  onExportProfile: () => void;
  onImportProfile: (file: File) => void;
  deviceBackupPreview?: DeviceBackupPreview;
  deviceBackupBusy: boolean;
  onExportDevice: () => void;
  onImportDevice: (file: File) => void;
  onRestoreDevice: (mode: "merge" | "replace") => void;
  onCancelDeviceRestore: () => void;
  syncSettings: DeviceSyncSettings;
  syncToken: string;
  syncStatus: { state: "idle" | "syncing" | "success" | "error" | "conflict"; message?: string };
  onSyncSettingsChange: (settings: DeviceSyncSettings) => void;
  onSyncTokenChange: (token: string) => void;
  onSync: () => void;
  onResolveSync: (resolution: "keep-local" | "use-remote") => void;
  settingsMode?: boolean;
  onOpenSettings: () => void;
  onOpenAi: () => void;
  onResetCurrentCourse: () => void;
  onClearAllData: () => void;
  onExportDiagnostics: () => void;
  onRebuildStorage: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "installed">("all");
  const [storageState, setStorageState] = useState<"checking" | "persistent" | "temporary" | "unsupported">("checking");

  useEffect(() => {
    if (!navigator.storage?.persisted) return;
    void navigator.storage.persisted().then((persistent) => setStorageState(persistent ? "persistent" : "temporary")).catch(() => setStorageState("unsupported"));
  }, []);

  async function protectLocalStorage() {
    if (!navigator.storage?.persist) {
      setStorageState("unsupported");
      return;
    }
    const persistent = await navigator.storage.persist().catch(() => false);
    setStorageState(persistent ? "persistent" : "temporary");
  }
  const c = (chinese: string, english: string) => uiText(locale, chinese, english);
  const installedCount = entries.filter((entry) => entry.status !== "available").length;
  const readyCourseCount = entries.filter((entry) => entry.source === "bundled").length;
  const visibleEntries = filter === "installed" ? entries.filter((entry) => entry.status !== "available") : entries;

  return (
    <main className={"course-library-shell " + (settingsMode ? "settings-mode" : "")}>
      <header className="course-library-topbar">
        {settingsMode || installedCount > 0 ? <button onClick={onBack}><ArrowLeft size={17} />{c("返回学习首页", "Back to learning home")}</button> : <span className="course-library-back-placeholder" aria-hidden="true" />}
        <div className="course-library-title"><span>{settingsMode ? "SETTINGS & LOCAL DATA" : "LANGUAGE LEARNING LIBRARY"}</span><strong>{settingsMode ? c("设置中心", "Settings center") : c("学习课程库", "Learning library")}</strong></div>
        <div className="course-library-tools">{!settingsMode && <button onClick={onOpenSettings}><Settings2 size={15} />{c("设置", "Settings")}</button>}<button onClick={onOpenHelp}><CircleHelp size={15} />{c("使用帮助", "Guide")}</button><label><span>{c("界面与讲解", "Interface & instruction")}</span><select value={locale} onChange={(event) => onLocaleChange(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label></div>
      </header>

      <section className="course-library-hero">
        <div className="library-hero-icon"><Library size={26} /></div>
        <div><span className="kicker">ANY LANGUAGE · NO ACCOUNT REQUIRED</span><h1>{c("从一门课程开始", "Start with a course")}</h1><p>{c("直接学习现成课程，或导入任意语种的 Course Pack。平台的学习流程不绑定日语或粤语，进度会保存在当前设备。", "Learn a ready-made course or import a Course Pack for any language. The learning flow is not tied to Japanese or Cantonese, and progress stays on this device.")}</p></div>
        <div className="library-summary"><strong>{installedCount}</strong><span>{c("已安装课程", "installed courses")}</span></div>
      </section>

      <section className="course-entry-paths" aria-label={c("选择学习方式", "Choose how to begin")}>
        <article><span><BookOpen size={20} /></span><div><small>{c("现成内容", "Ready-made content")}</small><h2>{c("学习现成课程", "Learn a ready-made course")}</h2><p>{c(`当前提供 ${readyCourseCount} 门可直接开始的课程。`, `${readyCourseCount} courses are ready to start.`)}</p></div><button onClick={() => setFilter("all")}>{c("查看课程", "View courses")}<ArrowRight size={14} /></button></article>
        <article><span><Upload size={20} /></span><div><small>{c("任意语种", "Any language")}</small><h2>{c("导入课程", "Import a course")}</h2><p>{c("安装别人分享的已发布 Course Pack。", "Install a published Course Pack shared by someone else.")}</p></div><label><Upload size={14} />{c("选择文件", "Choose file")}<input type="file" accept=".json,.course.json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportFile(file); event.target.value = ""; }} /></label></article>
        <article><span><GraduationCap size={20} /></span><div><small>STUDIO</small><h2>{c("设计自己的课程", "Design your own course")}</h2><p>{c("无需代码，为新的目标语言创建课程。", "Create a course for a new target language without coding.")}</p></div><button onClick={onCreateCourse}>{c("进入 Studio", "Open Studio")}<ArrowRight size={14} /></button></article>
      </section>

      <section className="course-library-toolbar">
        <div><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{c("全部课程", "All courses")}</button><button className={filter === "installed" ? "active" : ""} onClick={() => setFilter("installed")}>{c("我的课程", "My courses")}</button></div>
        <p role="status" aria-live="polite"><ShieldCheck size={14} />{notice ?? c("选择课程即可开始；课程来源与内容完整性会自动校验", "Choose a course to begin; its source and content integrity are checked automatically")}</p>
      </section>

      {visibleEntries.length === 0 ? (
        <section className="course-library-empty"><BookOpen size={28} /><h2>{c("还没有安装课程", "No courses installed yet")}</h2><p>{c("切换到全部课程，选择一门课程开始学习。", "Switch to All courses and choose one to begin.")}</p><button onClick={() => setFilter("all")}>{c("浏览全部课程", "Browse all courses")}</button></section>
      ) : (
        <section className="course-library-grid">
          {visibleEntries.map((entry) => {
            const course = entry.course;
            const languagePack = languagePacks.find((pack) => pack.id === course.manifest.languageId);
            const installed = entry.installedCourse;
            const updateIssue = entry.update?.issues.find((issue) => issue !== "not-newer");
            const level = course.goals.find((goal) => goal.framework?.level)?.framework?.level ?? c("入门", "Beginner");
            const outcomeGoals = representativeGoals(entry);
            const studyTime = estimatedStudyTime(course.lessons.length, locale);
            return (
              <article className="library-course-card" key={entry.id}>
                <div className="library-card-cover"><span>{languagePack?.accent ?? course.manifest.languageId.slice(0, 2).toUpperCase()}</span><strong>{languagePack ? languageName(languagePack, locale) : course.manifest.languageId}</strong><small>{course.manifest.languageId}</small></div>
                <div className="library-card-content">
                  <div className="library-card-badges"><span className={entry.source}>{entry.source === "bundled" ? <><Languages size={11} />{c("内置课程", "Built-in")}</> : <><UserRound size={11} />{c("用户课程", "User course")}</>}</span><em className={entry.status}>{entry.status === "available" ? c("可安装", "Available") : entry.status === "installed" ? c("已安装", "Installed") : entry.status === "update-available" ? c("可更新", "Update available") : c("更新需处理", "Update blocked")}</em></div>
                  <div className={`course-trust-badge ${entry.trust.level}`}><ShieldCheck size={12} /><span>{entry.trust.level === "official" ? c("官方可信来源", "Official trusted source") : entry.trust.level === "community" ? c("社区课程 · 安装前确认", "Community course · confirm before install") : entry.trust.level === "local" ? c("本地作者课程", "Local author course") : c("来源校验未通过", "Provenance check failed")}</span></div>
                  <h2>{displayText(course.manifest.title, locale)}</h2>
                  <p>{displayText(course.manifest.description, locale)}</p>
                  {outcomeGoals.length > 0 && <div className="library-learning-outcome"><Target size={13} /><span><strong>{c("完成课程后，你将能够", "By the end of this course")}</strong><ul>{outcomeGoals.map((goal) => <li key={goal.id}>{displayText(goal.description, locale)}</li>)}</ul><small>{c(`以上为 ${course.goals.length} 个课程目标中的代表成果`, `Representative outcomes from ${course.goals.length} course goals`)}</small></span></div>}
                  <div className="library-course-meta"><span><BookOpen size={13} />{c(`${course.lessons.length} 个课节`, `${course.lessons.length} lessons`)}</span><span><GraduationCap size={13} />{c(`${course.goals.length} 个目标`, `${course.goals.length} goals`)}</span><span>v{course.manifest.version}</span></div>
                  <div className="library-course-details"><span>{c("课程等级", "Course level")}<strong>{level}</strong></span><span>{c("适合人群", "For learners")}<strong>{entry.source === "bundled" ? c("零基础学习者", "Complete beginners") : c("请查看课程说明", "See course description")}</strong></span><span>{c("预计用时", "Estimated time")}<strong>{studyTime}</strong></span><span>{c("学习节奏", "Pace")}<strong>{c("每课约 15–25 分钟", "About 15–25 min per lesson")}</strong></span></div>
                  {entry.status === "update-available" && installed && <div className="library-update-note"><RefreshCw size={13} /><span>{c(`可从 v${installed.manifest.version} 更新；学习进度会保留。`, `Update from v${installed.manifest.version}; learning progress will be preserved.`)}</span></div>}
                  {entry.status === "update-blocked" && updateIssue && <div className="library-update-note blocked"><ShieldCheck size={13} /><span>{c(...issueLabels[updateIssue])}</span></div>}
                  <div className="library-card-actions">
                    {entry.status === "available" && <button className="primary" disabled={!entry.trust.canInstall} onClick={() => onStart(entry)}><Play size={15} />{entry.trust.canInstall ? c("一键开始学习", "Start learning") : c("不可安装", "Blocked")}</button>}
                    {entry.status === "update-available" && <button className="primary" onClick={() => onUpdate(entry)}><RefreshCw size={15} />{c("更新并保留进度", "Update and keep progress")}</button>}
                    {entry.status === "update-blocked" && <button disabled><ShieldCheck size={15} />{c("需要兼容处理", "Compatibility review needed")}</button>}
                    {entry.status !== "available" && <button onClick={() => onOpen(entry)}>{c("进入学习", "Open course")}<ArrowRight size={14} /></button>}
                    {entry.status !== "available" && <button onClick={() => onExport(entry)}><FileDown size={15} />{c("导出备份", "Export")}</button>}
                    {entry.status !== "available" && <button className="danger" onClick={() => onUninstall(entry)} aria-label={c(`卸载${displayText(course.manifest.title, locale)}`, `Remove ${displayText(course.manifest.title, locale)}`)}><Trash2 size={15} />{c("卸载", "Remove")}</button>}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}


      {settingsMode && <section className="settings-center-overview" aria-labelledby="settings-center-title">
        <header><div><span className="kicker">LOCAL-FIRST CONTROL CENTER</span><h1 id="settings-center-title">{c("设置与本地数据", "Settings and local data")}</h1><p>{c("一个入口管理界面语言、个人 AI、离线存储、备份、同步和数据删除。无需账户。", "Manage interface language, Personal AI, offline storage, backup, sync, and deletion in one place. No account required.")}</p></div><ShieldCheck size={30} /></header>
        <div className="settings-center-grid">
          <article><Languages size={19} /><div><strong>{c("界面与讲解语言", "Interface & instruction language")}</strong><small>{c("界面和教学讲解保持一致", "Interface and teaching explanations stay aligned")}</small></div><select aria-label={c("设置界面与讲解语言", "Set interface and instruction language")} value={locale} onChange={(event) => onLocaleChange(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></article>
          <article><Settings2 size={19} /><div><strong>{c("个人 AI", "Personal AI")}</strong><small>{c("服务商和模型保存在设备；密钥仅在当前标签页", "Provider and model stay on device; keys stay in this tab")}</small></div><button onClick={onOpenAi}>{c("配置 AI", "Configure AI")}</button></article>
          <article><ShieldCheck size={19} /><div><strong>{c("离线与存储保护", "Offline and storage protection")}</strong><small>{storageState === "persistent" ? c("本地数据已请求持久保存", "Persistent local storage is enabled") : c("学习与课程数据保存在当前浏览器", "Learning and course data stay in this browser")}</small></div><button onClick={() => void protectLocalStorage()} disabled={storageState !== "temporary"}>{storageState === "persistent" ? c("已保护", "Protected") : c("保护本地数据", "Protect data")}</button></article>
        </div>
        <section className="settings-danger-zone">
          <div><strong>{c("数据安全与恢复", "Data safety and recovery")}</strong><p>{c("危险操作会先显示影响范围并再次确认。建议先在下方导出完整设备备份。", "Destructive actions preview their impact and ask again. Export a complete device backup below first.")}</p></div>
          <div className="settings-danger-actions">
            <button onClick={onResetCurrentCourse}><RefreshCw size={14} />{c("重置当前课程学习", "Reset current-course learning")}</button>
            <button onClick={onExportDiagnostics}><FileDown size={14} />{c("导出隐私安全诊断", "Export privacy-safe diagnostics")}</button>
            <button className="danger" onClick={onClearAllData}><Trash2 size={14} />{c("删除全部本地数据", "Delete all local data")}</button>
            <button className="danger" onClick={onRebuildStorage}><ArchiveRestore size={14} />{c("备份后重建设备数据库", "Rebuild device database after backup")}</button>
          </div>
        </section>
      </section>}

      <details className="course-library-advanced" open={settingsMode || undefined}>
        <summary><span><Settings2 size={16} /><strong>{c("课程与数据管理", "Course and data management")}</strong></span><small>{c("导入、备份或设置可选同步", "Import, back up, or configure optional sync")}</small></summary>
        <div className="course-library-advanced-content">
          <section className="course-file-management">
            <div><span><Upload size={18} /></span><p><strong>{c("导入他人分享的课程", "Import a shared course")}</strong><small>{c("只有收到课程文件时才需要使用。内置课程可直接在上方开始学习。", "Use this only when someone shares a course file with you. Built-in courses can be started above.")}</small></p></div>
            <label><Upload size={14} />{c("选择课程文件", "Choose course file")}<input type="file" accept=".json,.course.json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportFile(file); event.target.value = ""; }} /></label>
          </section>

          <section className="full-device-backup-panel">
            <header><div><span><DatabaseBackup size={18} /></span><p><strong>{c("完整设备备份", "Complete device backup")}</strong><small>{c("一次保存课程、草稿、自定义 Language Pack、学习进度、个人计划和设备偏好；不会包含 AI 密钥、同步令牌或进行中的临时请求。", "Save courses, drafts, custom Language Packs, progress, plans, and device preferences together. AI keys, sync tokens, and in-progress requests are excluded.")}</small></p></div><aside><button onClick={() => void protectLocalStorage()} disabled={storageState !== "temporary"}><ShieldCheck size={14} />{storageState === "persistent" ? c("本地数据已保护", "Local data protected") : storageState === "unsupported" ? c("浏览器不支持保护", "Storage protection unavailable") : c("保护本地数据", "Protect local data")}</button><button onClick={onExportDevice} disabled={deviceBackupBusy}><FileDown size={14} />{c("导出全部数据", "Export all data")}</button><label className={deviceBackupBusy ? "disabled" : ""}><ArchiveRestore size={14} />{c("选择完整备份", "Choose full backup")}<input disabled={deviceBackupBusy} type="file" accept=".json,.learnlanguage.json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportDevice(file); event.target.value = ""; }} /></label></aside></header>
            {deviceBackupPreview && <div className="device-backup-preview" role="status" aria-live="polite"><div><strong>{c("恢复前预览", "Restore preview")}</strong><span>{c(`备份包含 ${deviceBackupPreview.totalItems} 项：${deviceBackupPreview.addedItems} 项新增，${deviceBackupPreview.replacedItems} 项与本机同 ID。`, `Backup contains ${deviceBackupPreview.totalItems} items: ${deviceBackupPreview.addedItems} new and ${deviceBackupPreview.replacedItems} matching local IDs.`)}</span><small>{c(`课程 ${deviceBackupPreview.counts.installedCourses} · 草稿数据 ${deviceBackupPreview.counts.drafts} · 语言包 ${deviceBackupPreview.counts.languagePacks} · 学习记录 ${deviceBackupPreview.counts.courseRecords} · 计划 ${deviceBackupPreview.counts.learningPlans}`, `Courses ${deviceBackupPreview.counts.installedCourses} · draft data ${deviceBackupPreview.counts.drafts} · language packs ${deviceBackupPreview.counts.languagePacks} · learning records ${deviceBackupPreview.counts.courseRecords} · plans ${deviceBackupPreview.counts.learningPlans}`)}</small></div><aside><button onClick={() => onRestoreDevice("merge")} disabled={deviceBackupBusy}>{c("合并恢复", "Merge restore")}</button><button className="danger" onClick={() => onRestoreDevice("replace")} disabled={deviceBackupBusy}>{c("清空本机后恢复", "Replace this device")}</button><button onClick={onCancelDeviceRestore} disabled={deviceBackupBusy}>{c("取消", "Cancel")}</button></aside><p>{c("合并恢复会保留备份中没有的本机项目；同 ID 项使用备份内容。清空恢复会先移除本机全部持久数据。", "Merge keeps local items absent from the backup and uses the backup for matching IDs. Replace first removes all durable local data.")}</p></div>}
          </section>

          <section className="learner-backup-bar">
            <div><span><DatabaseBackup size={18} /></span><p><strong>{c("学习档案备份", "Learning profile backup")}</strong><small>{c(`包含 ${recordCount} 门课程的已完成课节、掌握度、复习安排和 ${planCount} 个个人学习计划；不包含作答内容、进行中步骤、课程内容、草稿或 AI 设置。`, `Includes completed lessons, mastery, reviews for ${recordCount} courses, and ${planCount} personal plans; excludes answers, in-progress steps, course content, drafts, and AI settings.`)}</small></p></div>
            <aside><button onClick={onExportProfile}><FileDown size={14} />{c("导出学习档案", "Export profile")}</button><label><ArchiveRestore size={14} />{c("恢复学习档案", "Restore profile")}<input type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportProfile(file); event.target.value = ""; }} /></label></aside>
          </section>

          <section className="device-sync-panel">
            <header><div><span><Cloud size={18} /></span><p><strong>{c("可选设备同步", "Optional device sync")}</strong><small>{c("无需账户；连接兼容的自托管服务。没有服务时，本地学习功能保持完整。", "No account required. Connect a compatible self-hosted service; local learning stays complete without it.")}</small></p></div><em className={syncStatus.state}>{syncStatus.state === "syncing" ? c("同步中", "Syncing") : syncStatus.state === "success" ? c("已同步", "Synced") : syncStatus.state === "conflict" ? c("有冲突", "Conflict") : syncStatus.state === "error" ? c("连接失败", "Error") : c("未启用", "Not enabled")}</em></header>
            <div className="sync-fields">
              <label><span>{c("服务地址", "Service endpoint")}</span><input type="url" value={syncSettings.endpoint} onChange={(event) => onSyncSettingsChange({ ...syncSettings, endpoint: event.target.value })} placeholder="https://sync.example.com" /></label>
              <label><span>{c("档案 ID", "Profile ID")}</span><input value={syncSettings.profileId} onChange={(event) => onSyncSettingsChange({ ...syncSettings, profileId: event.target.value })} /></label>
              <label><span>{c("访问令牌（可选）", "Access token (optional)")}</span><input type="password" value={syncToken} onChange={(event) => onSyncTokenChange(event.target.value)} autoComplete="off" placeholder={c("只保留到标签页关闭", "Cleared when this tab closes")} /></label>
              <button onClick={onSync} disabled={syncStatus.state === "syncing"}><RefreshCw size={14} />{c("立即同步", "Sync now")}</button>
            </div>
            {syncStatus.message && <p role="status" aria-live="polite" className={`sync-message ${syncStatus.state}`}>{syncStatus.message}</p>}
            {syncStatus.state === "conflict" && <div className="sync-conflict-actions"><button onClick={() => onResolveSync("keep-local")}>{c("保留本机修改", "Keep this device")}</button><button onClick={() => onResolveSync("use-remote")}>{c("使用服务端版本", "Use server version")}</button></div>}
          </section>
        </div>
      </details>
    </main>
  );
}
