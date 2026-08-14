"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArchiveRestore,
  BookOpen,
  CircleHelp,
  Cloud,
  DatabaseBackup,
  Download,
  FileDown,
  GraduationCap,
  Languages,
  Library,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { displayText } from "@/lib/course";
import type { CourseLibraryEntry, CourseUpdateIssue } from "@/lib/course-library";
import { uiText, type AppLocale } from "@/lib/i18n";
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

export function CourseLibrary({
  entries,
  locale,
  notice,
  onLocaleChange,
  onOpenHelp,
  onBack,
  onInstall,
  onUpdate,
  onUninstall,
  onOpen,
  onImportFile,
  onExport,
  recordCount,
  onExportProfile,
  onImportProfile,
  syncSettings,
  syncToken,
  syncStatus,
  onSyncSettingsChange,
  onSyncTokenChange,
  onSync,
  onResolveSync,
}: {
  entries: CourseLibraryEntry[];
  locale: AppLocale;
  notice?: string;
  onLocaleChange: (locale: AppLocale) => void;
  onOpenHelp: () => void;
  onBack: () => void;
  onInstall: (entry: CourseLibraryEntry) => void;
  onUpdate: (entry: CourseLibraryEntry) => void;
  onUninstall: (entry: CourseLibraryEntry) => void;
  onOpen: (entry: CourseLibraryEntry) => void;
  onImportFile: (file: File) => void;
  onExport: (entry: CourseLibraryEntry) => void;
  recordCount: number;
  onExportProfile: () => void;
  onImportProfile: (file: File) => void;
  syncSettings: DeviceSyncSettings;
  syncToken: string;
  syncStatus: { state: "idle" | "syncing" | "success" | "error" | "conflict"; message?: string };
  onSyncSettingsChange: (settings: DeviceSyncSettings) => void;
  onSyncTokenChange: (token: string) => void;
  onSync: () => void;
  onResolveSync: (resolution: "keep-local" | "use-remote") => void;
}) {
  const [filter, setFilter] = useState<"all" | "installed">("all");
  const c = (chinese: string, english: string) => uiText(locale, chinese, english);
  const installedCount = entries.filter((entry) => entry.status !== "available").length;
  const visibleEntries = filter === "installed" ? entries.filter((entry) => entry.status !== "available") : entries;

  return (
    <main className="course-library-shell">
      <header className="course-library-topbar">
        <button onClick={onBack}><ArrowLeft size={17} />{c("返回课程工作台", "Back to Course Studio")}</button>
        <div className="course-library-title"><span>LOCAL COURSE LIBRARY</span><strong>{c("课程库", "Course library")}</strong></div>
        <div className="course-library-tools"><button onClick={onOpenHelp}><CircleHelp size={15} />{c("使用帮助", "Guide")}</button><label><span>{c("语言", "Language")}</span><select value={locale} onChange={(event) => onLocaleChange(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label></div>
      </header>

      <section className="course-library-hero">
        <div className="library-hero-icon"><Library size={26} /></div>
        <div><span className="kicker">LEARN OFFLINE · NO ACCOUNT REQUIRED</span><h1>{c("选择想学的课程", "Choose what you want to learn")}</h1><p>{c("课程安装在当前设备。卸载不会删除学习记录，重新安装兼容版本即可继续。", "Courses are installed on this device. Removing one keeps your progress so a compatible reinstall can continue.")}</p></div>
        <div className="library-summary"><strong>{installedCount}</strong><span>{c("已安装课程", "installed courses")}</span></div>
      </section>

      <section className="course-library-toolbar">
        <div><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{c("全部课程", "All courses")}</button><button className={filter === "installed" ? "active" : ""} onClick={() => setFilter("installed")}>{c("已安装", "Installed")}</button><label className="course-file-import"><Upload size={13} />{c("导入课程文件", "Import course file")}<input type="file" accept=".json,.course.json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportFile(file); event.target.value = ""; }} /></label></div>
        <p><ShieldCheck size={14} />{notice ?? c("安装前会校验课程身份与内容完整性", "Course identity and content integrity are checked before installation")}</p>
      </section>

      <section className="learner-backup-bar">
        <div><span><DatabaseBackup size={18} /></span><p><strong>{c("学习档案备份", "Learning profile backup")}</strong><small>{c(`包含 ${recordCount} 门课程的已完成课节、掌握度和复习计划；不包含作答内容、进行中步骤、课程内容、草稿或 AI 设置。`, `Includes completed lessons, mastery, and reviews for ${recordCount} courses; excludes answers, in-progress steps, course content, drafts, and AI settings.`)}</small></p></div>
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
        {syncStatus.message && <p className={`sync-message ${syncStatus.state}`}>{syncStatus.message}</p>}
        {syncStatus.state === "conflict" && <div className="sync-conflict-actions"><button onClick={() => onResolveSync("keep-local")}>{c("保留本机修改", "Keep this device")}</button><button onClick={() => onResolveSync("use-remote")}>{c("使用服务端版本", "Use server version")}</button></div>}
      </section>

      {visibleEntries.length === 0 ? (
        <section className="course-library-empty"><BookOpen size={28} /><h2>{c("还没有安装课程", "No courses installed yet")}</h2><p>{c("切换到全部课程，选择一门课程安装。", "Switch to All courses and install one to begin.")}</p><button onClick={() => setFilter("all")}>{c("浏览全部课程", "Browse all courses")}</button></section>
      ) : (
        <section className="course-library-grid">
          {visibleEntries.map((entry) => {
            const course = entry.course;
            const installed = entry.installedCourse;
            const updateIssue = entry.update?.issues.find((issue) => issue !== "not-newer");
            return (
              <article className="library-course-card" key={entry.id}>
                <div className="library-card-cover"><span>{course.manifest.languageId === "ja" ? "日" : course.manifest.languageId === "yue-Hant-HK" ? "粵" : course.manifest.languageId.slice(0, 2).toUpperCase()}</span><small>{course.manifest.languageId}</small></div>
                <div className="library-card-content">
                  <div className="library-card-badges"><span className={entry.source}>{entry.source === "bundled" ? <><Languages size={11} />{c("内置课程", "Built-in")}</> : <><UserRound size={11} />{c("用户课程", "User course")}</>}</span><em className={entry.status}>{entry.status === "available" ? c("可安装", "Available") : entry.status === "installed" ? c("已安装", "Installed") : entry.status === "update-available" ? c("可更新", "Update available") : c("更新需处理", "Update blocked")}</em></div>
                  <div className={`course-trust-badge ${entry.trust.level}`}><ShieldCheck size={12} /><span>{entry.trust.level === "official" ? c("官方可信来源", "Official trusted source") : entry.trust.level === "community" ? c("社区课程 · 安装前确认", "Community course · confirm before install") : entry.trust.level === "local" ? c("本地作者课程", "Local author course") : c("来源校验未通过", "Provenance check failed")}</span></div>
                  <h2>{displayText(course.manifest.title, locale)}</h2>
                  <p>{displayText(course.manifest.description, locale)}</p>
                  <div className="library-course-meta"><span><BookOpen size={13} />{c(`${course.lessons.length} 个课节`, `${course.lessons.length} lessons`)}</span><span><GraduationCap size={13} />{c(`${course.goals.length} 个目标`, `${course.goals.length} goals`)}</span><span>v{course.manifest.version}</span></div>
                  <div className="library-course-details"><span>{c("教学语言", "Teaching languages")}<strong>中文 · English</strong></span><span>{c("作者", "Author")}<strong>{course.manifest.author.displayName}</strong></span><span>{c("许可证", "License")}<strong>{course.manifest.license?.id ?? c("私人课程", "Private course")}</strong></span></div>
                  {entry.status === "update-available" && installed && <div className="library-update-note"><RefreshCw size={13} /><span>{c(`可从 v${installed.manifest.version} 更新；学习进度会保留。`, `Update from v${installed.manifest.version}; learning progress will be preserved.`)}</span></div>}
                  {entry.status === "update-blocked" && updateIssue && <div className="library-update-note blocked"><ShieldCheck size={13} /><span>{c(...issueLabels[updateIssue])}</span></div>}
                  <div className="library-card-actions">
                    {entry.status === "available" && <button className="primary" disabled={!entry.trust.canInstall} onClick={() => onInstall(entry)}><Download size={15} />{entry.trust.canInstall ? c("安装课程", "Install") : c("不可安装", "Blocked")}</button>}
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
    </main>
  );
}
