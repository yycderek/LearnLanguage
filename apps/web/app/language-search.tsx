"use client";
import { useState } from "react";
import type { LanguagePack } from "@/lib/language-pack";
import { uiText, type AppLocale } from "@/lib/i18n";

export function useLanguageSearch(packs: LanguagePack[]) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = packs.filter((pack) => !normalized || [pack.id, ...Object.values(pack.name)].join(" ").toLocaleLowerCase().includes(normalized));
  return { query, setQuery, filtered };
}
export function LanguageSearch({ locale, query, setQuery, count }: {
  locale: AppLocale; query: string; setQuery: (value: string) => void; count: number;
}) {
  const t = (zh: string, en: string) => uiText(locale, zh, en);
  return <div className="language-search">
    <label><span>{t("筛选目标语言", "Filter target languages")}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("名称或语言代码", "Name or language code")} /></label>
    {query && <button type="button" onClick={() => setQuery("")}>{t("清除筛选", "Clear filter")}</button>}
    <span role="status">{count === 0 ? t("没有匹配语言，请更换关键词。", "No matching languages. Try another keyword.") : t(count + " 种语言", count + " languages")}</span>
  </div>;
}
