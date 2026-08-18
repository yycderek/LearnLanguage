"use client";

import {
  ArrowLeft,
  BookOpen,
  Download,
  Languages,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { languageName, type LanguagePack } from "@/lib/language-pack";
import { type LanguagePackUsage } from "@/lib/language-pack-file";
import { uiText, type AppLocale } from "@/lib/i18n";

export function LanguagePackManager({
  packs,
  builtInIds,
  locale,
  notice,
  usageFor,
  onLocaleChange,
  onBack,
  onCreate,
  onImport,
  onExport,
  onDelete,
}: {
  packs: LanguagePack[];
  builtInIds: ReadonlySet<string>;
  locale: AppLocale;
  notice: string;
  usageFor: (languageId: string) => LanguagePackUsage;
  onLocaleChange: (locale: AppLocale) => void;
  onBack: () => void;
  onCreate: () => void;
  onImport: (file: File) => void;
  onExport: (pack: LanguagePack) => void;
  onDelete: (pack: LanguagePack) => void;
}) {
  const c = (chinese: string, english: string) => uiText(locale, chinese, english);
  const customCount = packs.filter((pack) => !builtInIds.has(pack.id)).length;

  return (
    <main className="language-library-shell">
      <header className="course-library-topbar">
        <button onClick={onBack}><ArrowLeft size={17} />{c("返回课程编辑器", "Back to Course Studio")}</button>
        <div><span>LANGUAGE PACK LIBRARY</span><strong>{c("语言包管理", "Language Pack manager")}</strong></div>
        <label><Languages size={15} /><span>{c("界面与讲解", "Interface & instruction")}</span><select value={locale} onChange={(event) => onLocaleChange(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label>
      </header>

      <section className="language-library-hero">
        <div className="language-hero-icon"><Languages size={28} /></div>
        <div><span className="kicker">PORTABLE LANGUAGE DEFINITIONS</span><h1>{c("管理目标语言定义", "Manage target-language definitions")}</h1><p>{c("Language Pack 描述名称、书写系统、方向、分词策略和适配器能力。课程内容仍保存在 Course Pack 中，两者可以独立迁移。", "Language Packs describe names, scripts, direction, segmentation, and adapter capabilities. Course content remains in Course Packs so both can move independently.")}</p></div>
        <div className="language-summary"><strong>{customCount}</strong><span>{c("个自定义语言包", "custom packs")}</span><small>{c(`共 ${packs.length} 种语言`, `${packs.length} languages total`)}</small></div>
      </section>

      <section className="language-library-toolbar">
        <div><button onClick={onCreate}><Plus size={14} />{c("创建语言包", "Create Language Pack")}</button><label><Upload size={14} />{c("导入语言包", "Import Language Pack")}<input type="file" accept=".json,.language-pack.json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ""; }} /></label></div>
        <p><ShieldCheck size={14} />{notice}</p>
      </section>

      <section className="language-library-grid">
        {packs.map((pack) => {
          const builtIn = builtInIds.has(pack.id);
          const usage = usageFor(pack.id);
          const primaryScript = pack.scripts.find((script) => script.primary) ?? pack.scripts[0];
          return (
            <article className="language-pack-card" key={pack.id}>
              <header><span className="language-pack-accent">{pack.accent ?? pack.id.slice(0, 2).toUpperCase()}</span><div><span className={`language-pack-source ${builtIn ? "built-in" : "custom"}`}>{builtIn ? c("内置", "Built-in") : c("自定义", "Custom")}</span><h2>{languageName(pack, locale)}</h2><p>{languageName(pack, "native")} · {pack.id}</p></div></header>
              <div className="language-pack-facts"><span>{c("主要文字", "Primary script")}<strong>{primaryScript.code}</strong></span><span>{c("书写方向", "Direction")}<strong>{primaryScript.direction.toUpperCase()}</strong></span><span>{c("分词策略", "Segmentation")}<strong>{pack.segmentation.strategy}</strong></span></div>
              <div className="language-pack-usage"><BookOpen size={14} /><span>{usage.draftCount > 0 || usage.installedCourseCount > 0 ? c(`${usage.draftCount} 份草稿 · ${usage.installedCourseCount} 门已安装课程`, `${usage.draftCount} drafts · ${usage.installedCourseCount} installed courses`) : c("当前没有课程引用", "Not currently referenced by a course")}</span></div>
              <div className="language-pack-actions"><button className="primary" onClick={() => onExport(pack)}><Download size={14} />{c("导出", "Export")}</button>{builtIn ? <span><LockKeyhole size={13} />{c("随应用维护", "Managed by app")}</span> : <button className="danger" disabled={!usage.canDelete} onClick={() => onDelete(pack)} title={!usage.canDelete ? c("仍被编辑器、草稿或已安装课程引用", "Still used by the editor, drafts, or installed courses") : undefined}><Trash2 size={14} />{c("删除", "Delete")}</button>}</div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
