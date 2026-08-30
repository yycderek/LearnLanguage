"use client";

import type { Dispatch, SetStateAction } from "react";
import { FileText, ShieldCheck, TriangleAlert, Upload, X } from "lucide-react";
import { analyzeCourseMaterial, MAX_MATERIAL_CHARACTERS } from "@/lib/material-course";
import { MAX_MATERIALS, type CourseMaterial, type MaterialKind } from "@/lib/material-import";
import { languageName, type LanguagePack } from "@/lib/language-pack";
import { uiText, type AppLocale } from "@/lib/i18n";

export type MaterialImportForm = {
  languageId: string;
  title: string;
  text: string;
  url: string;
  kind: MaterialKind;
  useAi: boolean;
  rightsConfirmed: boolean;
};

export function MaterialImportDialog({
  locale, form, materials, busy, error, aiConfigured, languagePacks, setForm, setError,
  onClose, onAddPastedMaterial, onImportFiles, onImportUrl, onRemoveMaterial, onCreate,
}: {
  locale: AppLocale;
  form: MaterialImportForm;
  materials: CourseMaterial[];
  busy: boolean;
  error: string;
  aiConfigured: boolean;
  languagePacks: LanguagePack[];
  setForm: Dispatch<SetStateAction<MaterialImportForm>>;
  setError: Dispatch<SetStateAction<string>>;
  onClose: () => void;
  onAddPastedMaterial: () => void;
  onImportFiles: (files: FileList | null) => void;
  onImportUrl: () => void;
  onRemoveMaterial: (id: string) => void;
  onCreate: () => void;
}) {
  const t = (chinese: string, english: string) => uiText(locale, chinese, english);
  const totalCharacters = materials.reduce((total, item) => total + item.text.length, 0) + form.text.length;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="ai-dialog article-dialog material-dialog" role="dialog" aria-modal="true" aria-labelledby="article-dialog-title">
        <div className="dialog-heading"><div className="dialog-icon"><FileText size={20} /></div><div><span className="kicker">MATERIAL TO COURSE</span><h2 id="article-dialog-title">{t("导入素材生成课程草稿", "Create a course draft from materials")}</h2></div><button className="icon-button" onClick={onClose} aria-label={t("关闭素材导入", "Close material import")}><X size={18} /></button></div>
        <div className="dialog-body">
          <div className="form-grid two-column">
            <label><span>{t("目标语言", "Target language")}</span><select value={form.languageId} onChange={(event) => setForm((current) => ({ ...current, languageId: event.target.value }))}><option value="">{t("请选择", "Choose a language")}</option>{languagePacks.map((pack) => <option key={pack.id} value={pack.id}>{languageName(pack, locale)}</option>)}</select></label>
            <label><span>{t("课程标题", "Course title")}</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={t("例如：城市生活素材课", "For example: City life materials")} /></label>
          </div>
          <div className="material-source-grid">
            <section className="material-source-card">
              <div className="material-card-heading"><strong>{t("粘贴文本", "Paste text")}</strong><select aria-label={t("素材类型", "Material type")} value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as MaterialKind }))}><option value="article">{t("文章", "Article")}</option><option value="dialogue">{t("对话", "Dialogue")}</option><option value="lyrics">{t("歌词", "Lyrics")}</option><option value="subtitle">{t("字幕", "Subtitles")}</option><option value="document">{t("文档", "Document")}</option></select></div>
              <textarea aria-label={t("素材正文", "Material text")} className="article-textarea" dir={languagePacks.find((pack) => pack.id === form.languageId)?.scripts[0]?.direction ?? "ltr"} value={form.text} maxLength={MAX_MATERIAL_CHARACTERS} onChange={(event) => { setForm((current) => ({ ...current, text: event.target.value })); setError(""); }} placeholder={t("粘贴你有权使用的文章、对话、歌词或字幕。歌词和字幕会保留原分行。", "Paste an article, dialogue, lyrics, or subtitles you can use. Lyrics and subtitles keep their line breaks.")} />
              <div className="material-card-actions"><small>{form.text.length.toLocaleString()} {t("字符", "characters")}</small><button className="outline-button compact" type="button" onClick={onAddPastedMaterial}>{t("加入素材列表", "Add material")}</button></div>
            </section>
            <section className="material-source-card">
              <strong>{t("上传文件", "Upload files")}</strong>
              <label className="material-upload"><Upload size={18} /><span>{t("选择 TXT、Markdown、HTML、字幕、LRC、PDF 或 DOCX，可多选", "Choose TXT, Markdown, HTML, subtitles, LRC, PDF, or DOCX; multiple files allowed")}</span><input type="file" multiple accept=".txt,.md,.markdown,.html,.htm,.srt,.vtt,.lrc,.pdf,.docx" onChange={(event) => { onImportFiles(event.target.files); event.target.value = ""; }} /></label>
              <strong>{t("导入网页", "Import a web page")}</strong>
              <div className="material-url-row"><input aria-label={t("网页地址", "Web address")} type="url" value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://example.com/article" /><button className="outline-button compact" type="button" onClick={onImportUrl} disabled={busy}>{t("读取", "Fetch")}</button></div>
              <small>{t("网页只提取可读文本；PDF 和 Word 链接请先下载再上传。", "Web import extracts readable text only. Download PDF or Word links before uploading.")}</small>
            </section>
          </div>
          {materials.length > 0 && <section className="material-queue"><div className="material-queue-heading"><strong>{t("已加入素材", "Materials added")}</strong><span>{materials.length} / {MAX_MATERIALS}</span></div>{materials.map((material) => { const analysis = analyzeCourseMaterial(material.text, form.languageId, material.kind); return <div className="material-queue-item" key={material.id}><div><strong>{material.title}</strong><small>{material.sourceLabel ?? material.kind} · {analysis.characterCount.toLocaleString()} {t("字符", "characters")} · {analysis.sentenceCount} {t("条内容", "items")} · {t("暂估", "estimated")} {analysis.estimatedLevel}{analysis.repeatedLines.length ? t(" · 检出重复分行", " · repeated lines found") : ""}</small></div><button className="icon-button" type="button" onClick={() => onRemoveMaterial(material.id)} aria-label={t("移除素材", "Remove material")}><X size={15} /></button></div>; })}</section>}
          <div className="article-meta"><span>{totalCharacters.toLocaleString()} / {MAX_MATERIAL_CHARACTERS.toLocaleString()} {t("字符", "characters")}</span><span>{t("每份素材会生成一个单元和四个可编辑练习", "Each material becomes one unit with four editable exercises")}</span></div>
          <label className="material-check"><input type="checkbox" checked={form.useAi} disabled={!aiConfigured} onChange={(event) => setForm((current) => ({ ...current, useAi: event.target.checked }))} /><span><strong>{t("使用个人 AI 补充翻译、语法、释义和难度判断", "Use Personal AI for translations, grammar, meanings, and level")}</strong><small>{aiConfigured ? t("素材会发送给你配置的 AI 服务；密钥仍只保留在当前会话。", "Materials are sent to your configured AI service; the key remains session-only.") : t("需要先完成个人 AI 设置和连接测试；不启用也能生成完整可编辑骨架。", "Configure and test Personal AI first. A complete editable structure can still be generated without it.")}</small></span></label>
          <label className="material-check rights-check"><input type="checkbox" checked={form.rightsConfirmed} onChange={(event) => setForm((current) => ({ ...current, rightsConfirmed: event.target.checked }))} /><span><strong>{t("我确认有权将这些素材用于自己的课程", "I confirm I may use these materials in my course")}</strong><small>{t("系统不会自动判断版权。公开发布前仍需填写合适的来源、署名与许可证。", "The app cannot determine copyright. Add appropriate source, attribution, and license before public publishing.")}</small></span></label>
          {error && <div className="language-error"><TriangleAlert size={16} />{error}</div>}
          <div className="privacy-note"><ShieldCheck size={17} /><p>{form.useAi ? t("基础分析、拆分与确定性答案在浏览器内完成；只有 AI 增强会把素材发送给你选择的服务。生成结果始终先保存为私有草稿。", "Core analysis, splitting, and deterministic answers run in the browser. Only AI enhancement sends material to your chosen service. The result always starts as a private draft.") : t("分析与生成在当前浏览器内完成，不调用 AI。网页导入只由本站读取该公开页面；结果先保存为私有草稿。", "Analysis and generation run in this browser without AI. For URL import, this site only reads the public page. The result starts as a private draft.")}</p></div>
        </div>
        <div className="dialog-footer"><button className="text-button" onClick={onClose} disabled={busy}>{t("取消", "Cancel")}</button><button className="primary-button" onClick={onCreate} disabled={busy}>{busy ? t("正在处理…", "Processing…") : t("生成可编辑草稿", "Create editable draft")}</button></div>
      </section>
    </div>
  );
}
