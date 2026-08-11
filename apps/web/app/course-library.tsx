"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
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
  onBack,
  onInstall,
  onUpdate,
  onUninstall,
  onOpen,
  onImportFile,
  onExport,
}: {
  entries: CourseLibraryEntry[];
  locale: AppLocale;
  notice?: string;
  onLocaleChange: (locale: AppLocale) => void;
  onBack: () => void;
  onInstall: (entry: CourseLibraryEntry) => void;
  onUpdate: (entry: CourseLibraryEntry) => void;
  onUninstall: (entry: CourseLibraryEntry) => void;
  onOpen: (entry: CourseLibraryEntry) => void;
  onImportFile: (file: File) => void;
  onExport: (entry: CourseLibraryEntry) => void;
}) {
  const [filter, setFilter] = useState<"all" | "installed">("all");
  const c = (chinese: string, english: string) => uiText(locale, chinese, english);
  const installedCount = entries.filter((entry) => entry.status !== "available").length;
  const visibleEntries = filter === "installed" ? entries.filter((entry) => entry.status !== "available") : entries;

  return (
    <main className="course-library-shell">
      <header className="course-library-topbar">
        <button onClick={onBack}><ArrowLeft size={17} />{c("返回课程工作台", "Back to Course Studio")}</button>
        <div><span>LOCAL COURSE LIBRARY</span><strong>{c("课程库", "Course library")}</strong></div>
        <label><span>{c("语言", "Language")}</span><select value={locale} onChange={(event) => onLocaleChange(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label>
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
                  <h2>{displayText(course.manifest.title, locale)}</h2>
                  <p>{displayText(course.manifest.description, locale)}</p>
                  <div className="library-course-meta"><span><BookOpen size={13} />{c(`${course.lessons.length} 个课节`, `${course.lessons.length} lessons`)}</span><span><GraduationCap size={13} />{c(`${course.goals.length} 个目标`, `${course.goals.length} goals`)}</span><span>v{course.manifest.version}</span></div>
                  <div className="library-course-details"><span>{c("教学语言", "Teaching languages")}<strong>中文 · English</strong></span><span>{c("作者", "Author")}<strong>{course.manifest.author.displayName}</strong></span><span>{c("许可证", "License")}<strong>{course.manifest.license?.id ?? c("私人课程", "Private course")}</strong></span></div>
                  {entry.status === "update-available" && installed && <div className="library-update-note"><RefreshCw size={13} /><span>{c(`可从 v${installed.manifest.version} 更新；学习进度会保留。`, `Update from v${installed.manifest.version}; learning progress will be preserved.`)}</span></div>}
                  {entry.status === "update-blocked" && updateIssue && <div className="library-update-note blocked"><ShieldCheck size={13} /><span>{c(...issueLabels[updateIssue])}</span></div>}
                  <div className="library-card-actions">
                    {entry.status === "available" && <button className="primary" onClick={() => onInstall(entry)}><Download size={15} />{c("安装课程", "Install")}</button>}
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
