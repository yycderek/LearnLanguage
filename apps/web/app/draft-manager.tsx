"use client";

import {
  ArrowLeft,
  Clock3,
  Download,
  FileJson,
  Languages,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { groupDraftRevisions, type DraftRevision } from "@/lib/draft-library";
import { uiText, type AppLocale } from "@/lib/i18n";

export function DraftManager({
  history,
  locale,
  notice,
  onLocaleChange,
  onBack,
  onRestore,
  onDelete,
  onImport,
  onExport,
}: {
  history: DraftRevision[];
  locale: AppLocale;
  notice: string;
  onLocaleChange: (locale: AppLocale) => void;
  onBack: () => void;
  onRestore: (item: DraftRevision) => void;
  onDelete: (draftId: string) => void;
  onImport: (file: File) => void;
  onExport: (item: DraftRevision) => void;
}) {
  const c = (chinese: string, english: string) => uiText(locale, chinese, english);
  const groups = groupDraftRevisions(history);
  const formatDate = (value: string) => new Date(value).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <main className="draft-library-shell">
      <header className="course-library-topbar">
        <button onClick={onBack}><ArrowLeft size={17} />{c("返回课程编辑器", "Back to Course Studio")}</button>
        <div><span>LOCAL DRAFT LIBRARY</span><strong>{c("草稿管理", "Draft manager")}</strong></div>
        <label><Languages size={15} /><span>{c("界面与讲解", "Interface & instruction")}</span><select value={locale} onChange={(event) => onLocaleChange(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label>
      </header>

      <section className="draft-library-hero">
        <div className="draft-hero-icon"><FileJson size={27} /></div>
        <div><span className="kicker">AUTHOR OFFLINE · NO ACCOUNT REQUIRED</span><h1>{c("管理课程草稿", "Manage course drafts")}</h1><p>{c("草稿与发布课程、学习档案彼此独立。这里可以恢复任意修订，或导入、导出可继续编辑的 Course Pack。", "Drafts stay separate from published courses and learning profiles. Restore any revision or move editable Course Packs between devices.")}</p></div>
        <div className="draft-summary"><strong>{groups.length}</strong><span>{c("份草稿", "drafts")}</span><small>{c(`${history.length} 个修订`, `${history.length} revisions`)}</small></div>
      </section>

      <section className="draft-library-toolbar">
        <label><Upload size={14} />{c("导入草稿文件", "Import draft file")}<input type="file" accept=".json,.draft.json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ""; }} /></label>
        <p><ShieldCheck size={14} />{notice}</p>
      </section>

      {groups.length === 0 ? (
        <section className="draft-library-empty"><Clock3 size={30} /><h2>{c("还没有本地草稿", "No local drafts yet")}</h2><p>{c("返回课程编辑器保存第一份草稿，或者导入一份未发布的 Course Pack JSON。", "Save your first draft in Course Studio, or import an unpublished Course Pack JSON.")}</p><button onClick={onBack}>{c("创建课程草稿", "Create a course draft")}</button></section>
      ) : (
        <section className="draft-library-grid">
          {groups.map((group) => (
            <article className="draft-card" key={group.draftId}>
              <header>
                <div><span className="draft-language">{group.latest.languageId}</span><h2>{group.latest.title}</h2><p>{c(`最近保存于 ${formatDate(group.latest.updatedAt)}`, `Last saved ${formatDate(group.latest.updatedAt)}`)}</p></div>
                <button className="draft-delete" onClick={() => onDelete(group.draftId)} aria-label={c(`删除${group.latest.title}`, `Delete ${group.latest.title}`)}><Trash2 size={15} />{c("删除草稿", "Delete draft")}</button>
              </header>
              <div className="draft-primary-actions"><button className="primary" onClick={() => onRestore(group.latest)}><RotateCcw size={15} />{c("继续编辑", "Continue editing")}</button><button onClick={() => onExport(group.latest)}><Download size={15} />{c("导出最新草稿", "Export latest")}</button></div>
              <div className="draft-revision-list">
                <div className="draft-revision-heading"><span>{c("修订记录", "Revision history")}</span><em>{group.revisions.length}</em></div>
                {group.revisions.map((item) => (
                  <div className="draft-revision-row" key={`${item.draftId}-${item.revision}`}>
                    <span className="revision">v{item.revision}</span><span><strong>{formatDate(item.updatedAt)}</strong><small>{item.languageId} · Course Pack v2</small></span>
                    <button onClick={() => onRestore(item)} title={c("恢复这个修订", "Restore this revision")}><RotateCcw size={14} /></button>
                    <button onClick={() => onExport(item)} title={c("导出这个修订", "Export this revision")}><Download size={14} /></button>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
