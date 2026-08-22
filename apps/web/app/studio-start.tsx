"use client";

import { BookOpen, FileText, FileUp, GraduationCap, Languages, Plus, Sparkles } from "lucide-react";
import { uiText, type AppLocale } from "@/lib/i18n";
import { languageName, type LanguagePack } from "@/lib/language-pack";

export function StudioStart({
  packs,
  locale,
  draftCount,
  onLocaleChange,
  onCreateLanguage,
  onImportDraft,
  onImportArticle,
  onUseLanguage,
  onOpenDrafts,
}: {
  packs: LanguagePack[];
  locale: AppLocale;
  draftCount: number;
  onLocaleChange: (locale: AppLocale) => void;
  onCreateLanguage: () => void;
  onImportDraft: (file: File) => void;
  onImportArticle: () => void;
  onUseLanguage: (pack: LanguagePack) => void;
  onOpenDrafts: () => void;
}) {
  const c = (chinese: string, english: string) => uiText(locale, chinese, english);

  return (
    <section className="studio-start-page">
      <header className="studio-start-topbar">
        <div className="studio-start-brand"><span><Languages size={20} /></span><div><strong>LearnLanguage</strong><small>Course Studio</small></div></div>
        <div><a href="/learn"><GraduationCap size={15} />{c("进入学习空间", "Open Learn")}</a><label><span>{c("界面与讲解", "Interface & instruction")}</span><select value={locale} onChange={(event) => onLocaleChange(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label></div>
      </header>

      <div className="studio-start-content">
        <section className="studio-start-hero">
          <span className="kicker">LANGUAGE-NEUTRAL COURSE STUDIO</span>
          <h1>{c("先选择课程的目标语言", "Start with the course's target language")}</h1>
          <p>{c("Studio 不预设日语或粤语。你可以为任意语言创建 Language Pack、导入课程草稿，或者用现有语言示例作为起点。", "Studio does not default to Japanese or Cantonese. Create a Language Pack for any language, import a course draft, or begin from an available language example.")}</p>
        </section>

        <section className="studio-start-paths" aria-label={c("开始创建课程", "Start creating a course")}>
          <article className="primary">
            <span className="studio-start-path-icon"><Plus size={22} /></span>
            <small>{c("任意目标语言", "Any target language")}</small>
            <h2>{c("创建或导入目标语言", "Create or import a target language")}</h2>
            <p>{c("不需要编写代码。填写语言名称、书写系统和方向后，会自动生成可编辑的入门课程。", "No coding required. Add the language name, writing system, and direction to generate an editable starter course.")}</p>
            <button onClick={onCreateLanguage}><Languages size={16} />{c("设置目标语言", "Set up target language")}</button>
          </article>

          <article>
            <span className="studio-start-path-icon"><FileUp size={22} /></span>
            <small>{c("继续已有项目", "Continue existing work")}</small>
            <h2>{c("导入课程草稿", "Import a course draft")}</h2>
            <p>{c("导入别人分享或从其他设备导出的可编辑课程草稿。", "Import an editable course draft shared by someone else or exported from another device.")}</p>
            <label><FileUp size={16} />{c("选择草稿文件", "Choose draft file")}<input type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportDraft(file); event.target.value = ""; }} /></label>
            {draftCount > 0 && <button className="secondary" onClick={onOpenDrafts}><BookOpen size={15} />{c(`查看 ${draftCount} 份本地修订`, `View ${draftCount} local revisions`)}</button>}
          </article>
          <article>
            <span className="studio-start-path-icon"><FileText size={22} /></span>
            <small>{c("把素材变成课程", "Turn content into a course")}</small>
            <h2>{c("导入素材生成草稿", "Create from materials")}</h2>
            <p>{c("粘贴文本、导入网页，或上传文章、对话、歌词、字幕、PDF 和 Word；系统会生成可编辑单元、知识点和练习。", "Paste text, import a web page, or upload articles, dialogues, lyrics, subtitles, PDF, and Word files to generate editable units, knowledge, and exercises.")}</p>
            <button onClick={onImportArticle}><FileText size={16} />{c("导入素材", "Import materials")}</button>
          </article>        </section>

        <section className="studio-ready-languages">
          <div><span><Sparkles size={17} /></span><div><strong>{c("从现有语言示例开始", "Start from an available language example")}</strong><p>{c("这些只是现成示例，不代表平台只支持这些语言。", "These are ready-made examples, not the limit of languages the platform supports.")}</p></div></div>
          <aside>{packs.map((pack) => <button key={pack.id} onClick={() => onUseLanguage(pack)}><span>{pack.accent ?? pack.id.slice(0, 2).toUpperCase()}</span><strong>{languageName(pack, locale)}</strong><small>{languageName(pack, "native")}</small></button>)}</aside>
        </section>
      </div>
    </section>
  );
}
