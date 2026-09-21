"use client";
import { useEffect, useRef } from "react";
import { Bot, CircleHelp, Languages, Settings2 } from "lucide-react";
import { uiText, type AppLocale } from "@/lib/i18n";

export function StudioTools({ locale, aiConfigured, onLocaleChange, onGuide, onAI }: {
  locale: AppLocale; aiConfigured: boolean; onLocaleChange: (locale: AppLocale) => void; onGuide: () => void; onAI: () => void;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismissOutside(event: PointerEvent) {
      const panel = details.current;
      if (panel?.open && event.target instanceof Node && !panel.contains(event.target)) panel.open = false;
    }
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, []);
  const t = (zh: string, en: string) => uiText(locale, zh, en);
  function close() {
    if (!details.current) return;
    details.current.open = false;
    details.current.querySelector("summary")?.focus();
  }
  return <details ref={details} className="studio-tools" onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
    <summary><Settings2 size={17} />{t("工具与设置", "Tools & settings")}</summary>
    <div className="studio-tools-content">
      <label><Languages size={16} /><span>{t("界面与讲解", "Interface & instruction")}</span><select aria-label={t("界面与讲解语言", "Interface and instruction language")} value={locale} onChange={(event) => onLocaleChange(event.target.value as AppLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label>
      <button className="outline-button" onClick={() => { close(); onGuide(); }}><CircleHelp size={17} />{t("使用帮助", "Guide")}</button>
      <button className="outline-button" onClick={() => { close(); onAI(); }}><Bot size={17} />{t("AI 设置", "AI settings")}<span>{aiConfigured ? t("已配置", "Configured") : t("未配置", "Not configured")}</span></button>
    </div>
  </details>;
}
