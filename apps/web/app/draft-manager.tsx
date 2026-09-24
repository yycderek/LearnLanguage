"use client";

import { useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import styles from "./studio/editor-tools.module.css";

import {
  ArrowLeft,
  Clock3,
  ChevronDown,
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
  hasUnsavedChanges,
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
  hasUnsavedChanges: boolean;
  onRestore: (item: DraftRevision) => void;
  onDelete: (draftId: string) => Promise<boolean>;
  onImport: (file: File) => Promise<boolean>;
  onExport: (item: DraftRevision) => void;
}) {
  const c = (chinese: string, english: string) => uiText(locale, chinese, english);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<{ kind: "delete" | "restore"; item: DraftRevision; count?: number } | { kind: "import"; file: File } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useDialogFocus<HTMLElement>(Boolean(pending), () => { if (!busy) setPending(null); });
  function requestRestore(item: DraftRevision) {
    if (hasUnsavedChanges) setPending({ kind: "restore", item });
    else onRestore(item);
  }
  async function requestImport(file: File) {
    setActionFailed(false);
    if (hasUnsavedChanges) {
      importButtonRef.current?.focus();
      setPending({ kind: "import", file });
    } else {
      setBusy(true);
      try { await onImport(file); } finally { setBusy(false); }
    }
  }
  async function confirmAction() {
    if (!pending || busy) return;
    if (pending.kind === "restore") { setPending(null); onRestore(pending.item); return; }
    setBusy(true);
    setActionFailed(false);
    try {
      if (await (pending.kind === "import" ? onImport(pending.file) : onDelete(pending.item.draftId))) {
        setPending(null);
        requestAnimationFrame(() => headingRef.current?.focus());
      } else { setActionFailed(true); }
    } finally { setBusy(false); }
  }
  const groups = groupDraftRevisions(history);
  const normalized = query.trim().toLocaleLowerCase();
  const visibleGroups = groups.filter((group) => group.revisions.some((item) =>
    [item.title, item.languageId].join(" ").toLocaleLowerCase().includes(normalized)));

  const formatDate = (value: string) => new Date(value).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <main className="draft-library-shell">
      <header className="course-library-topbar">
        <button onClick={onBack}><ArrowLeft size={17} />{c("返回课程编辑器", "Back to Course Studio")}</button>
        <div><span>LOCAL DRAFT LIBRARY</span><strong>{c("草稿管理", "Draft manager")}</strong></div>
        <label><Languages size={15} /><span>{c("界面与讲解", "Interface & instruction")}</span><select aria-label={c("界面与讲解语言", "Interface and instruction language")} value={locale} onChange={(event) => onLocaleChange(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label>
      </header>

      <section className="draft-library-hero">
        <div className="draft-hero-icon"><FileJson size={27} /></div>
        <div><span className="kicker">AUTHOR OFFLINE · NO ACCOUNT REQUIRED</span><h1 ref={headingRef} tabIndex={-1}>{c("管理课程草稿", "Manage course drafts")}</h1><p>{c("草稿与发布课程、学习档案彼此独立。这里可以恢复任意修订，或导入、导出可继续编辑的 Course Pack。", "Drafts stay separate from published courses and learning profiles. Restore any revision or move editable Course Packs between devices.")}</p></div>
        <div className="draft-summary"><strong>{groups.length}</strong><span>{c("份草稿", "drafts")}</span><small>{c(`${history.length} 个修订`, `${history.length} revisions`)}</small></div>
      </section>

      <section className="draft-library-toolbar">
        <button ref={importButtonRef} className="outline-button" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={14} />{busy && !pending ? c("正在导入…", "Importing…") : c("导入草稿文件", "Import draft file")}</button>
        <input ref={fileRef} hidden type="file" aria-label={c("选择草稿文件", "Choose draft file")} accept=".json,.draft.json,application/json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void requestImport(file); }} />
        <p role="status"><ShieldCheck size={14} />{notice}</p>
      </section>

      {groups.length > 0 && <div className={styles.toolbar}>
        <label><span>{c("搜索草稿", "Search drafts")}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c("课程名称或语言代码", "Course title or language code")} /></label>
        <span role="status">{c("找到 " + visibleGroups.length + " / " + groups.length + " 份草稿", visibleGroups.length + " of " + groups.length + " drafts")}</span>
        {query && <button type="button" onClick={() => setQuery("")}>{c("清除搜索", "Clear search")}</button>}
      </div>}
      {groups.length > 0 && visibleGroups.length === 0 && <section className="draft-library-empty"><h2>{c("没有匹配的草稿", "No matching drafts")}</h2><p>{c("试试课程名称、以前的名称或语言代码，也可以清除搜索查看全部草稿。", "Try a course title, a previous title, or a language code. Clear the search to see all drafts.")}</p></section>}
      {groups.length === 0 ? (
        <section className="draft-library-empty"><Clock3 size={30} /><h2>{c("还没有本地草稿", "No local drafts yet")}</h2><p>{c("返回课程编辑器保存第一份草稿，或者导入一份未发布的 Course Pack JSON。", "Save your first draft in Course Studio, or import an unpublished Course Pack JSON.")}</p><button onClick={onBack}>{c("创建课程草稿", "Create a course draft")}</button></section>
      ) : (
        <section className="draft-library-grid">
          {visibleGroups.map((group) => (
            <article className="draft-card" key={group.draftId}>
              <header>
                <div><span className="draft-language">{group.latest.languageId}</span><h2>{group.latest.title}</h2><p>{c(`最近保存于 ${formatDate(group.latest.updatedAt)}`, `Last saved ${formatDate(group.latest.updatedAt)}`)}</p></div>
                <button className="draft-delete" onClick={() => { setActionFailed(false); setPending({ kind: "delete", item: group.latest, count: group.revisions.length }); }} aria-label={c(`删除${group.latest.title}`, `Delete ${group.latest.title}`)}><Trash2 size={15} />{c("删除草稿", "Delete draft")}</button>
              </header>
              <div className="draft-primary-actions"><button className="primary" onClick={() => requestRestore(group.latest)}><RotateCcw size={15} />{c("继续编辑", "Continue editing")}</button><button onClick={() => onExport(group.latest)}><Download size={15} />{c("导出最新草稿", "Export latest")}</button></div>
              <details className="draft-revision-list">
                <summary className="draft-revision-heading"><ChevronDown size={16} /><span>{c("修订记录", "Revision history")}</span><em>{group.revisions.length}</em></summary>
                {group.revisions.map((item) => (
                  <div className="draft-revision-row" key={`${item.draftId}-${item.revision}`}>
                    <span className="revision">v{item.revision}</span><span><strong>{formatDate(item.updatedAt)}</strong><small>{item.languageId} · Course Pack v2</small></span>
                    <button onClick={() => requestRestore(item)} aria-label={c("恢复修订 v" + item.revision + "：" + item.title, "Restore revision v" + item.revision + ": " + item.title)} title={c("恢复这个修订", "Restore this revision")}><RotateCcw size={14} /></button>
                    <button onClick={() => onExport(item)} aria-label={c("导出修订 v" + item.revision + "：" + item.title, "Export revision v" + item.revision + ": " + item.title)} title={c("导出这个修订", "Export this revision")}><Download size={14} /></button>
                  </div>
                ))}
              </details>
            </article>
          ))}
        </section>
      )}
      {pending && <div className="modal-backdrop">
        <section ref={dialogRef} tabIndex={-1} className="ai-dialog draft-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="draft-confirm-title" aria-describedby="draft-confirm-description" aria-busy={busy}>
          <div className="dialog-body">
            <h2 id="draft-confirm-title">{pending.kind === "delete" ? c("删除这份草稿？", "Delete this draft?") : c("替换未保存的编辑内容？", "Replace unsaved edits?")}</h2>
            <p className="draft-confirm-target">{pending.kind === "import" ? pending.file.name : pending.item.title}{pending.kind === "restore" && ` · v${pending.item.revision}`}</p>
            <p id="draft-confirm-description">{pending.kind === "delete"
              ? c(`将删除这份草稿的全部 ${pending.count} 个本地修订，无法撤销。当前编辑内容、已发布课程和学习记录会保留。`, `All ${pending.count} local revisions will be permanently deleted. The open editor, published courses, and learning records will be kept.`)
              : pending.kind === "import" ? c("文件校验通过后会保存为新草稿，并替换当前未保存的编辑内容。若要保留，请取消并返回编辑器保存草稿。", "After validation, the file will be saved as a new draft and replace unsaved editor content. To keep your edits, cancel and return to the editor to save a draft.")
              : c("当前编辑内容尚未保存为修订，恢复后将被替换。若要保留，请取消并返回编辑器保存草稿。", "The current editor content has not been saved as a revision and will be replaced. To keep it, cancel and return to the editor to save a draft.")}</p>
            {pending.kind !== "restore" && actionFailed && <p role="alert">{notice}</p>}
          </div>
          <div className="dialog-footer">
            <button className="text-button" disabled={busy} onClick={() => setPending(null)}>{c("取消", "Cancel")}</button>
            <button className="primary-button" disabled={busy} onClick={() => void confirmAction()}>{busy ? (pending.kind === "import" ? c("正在导入…", "Importing…") : c("正在删除…", "Deleting…")) : pending.kind === "delete" ? c("删除全部修订", "Delete all revisions") : pending.kind === "import" ? c("导入并替换", "Import and replace") : c("替换并恢复", "Replace and restore")}</button>
          </div>
        </section>
      </div>}
    </main>
  );
}
