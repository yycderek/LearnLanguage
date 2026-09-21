"use client";

import { useState } from "react";
import { uiText, type AppLocale } from "@/lib/i18n";
import styles from "./editor-tools.module.css";
import { Check } from "lucide-react";

export function ReferencePicker({
  locale,
  disabled = false,
  label,
  options,
  selected,
  emptyLabel,
  onChange,
}: {
  locale: AppLocale;
  disabled?: boolean;
  label: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  emptyLabel: string;
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [requestedPage, setPage] = useState(0);
  const filtered = options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const page = Math.min(requestedPage, pageCount - 1);
  const t = (zh: string, en: string) => uiText(locale, zh, en);
  return (
    <fieldset className="reference-picker wide">
      <legend>{label}</legend>
      {(options.length > 6 || query) && <label className={styles.referenceSearch}><span>{t("筛选引用", "Filter references")} · {t("已选 ", "Selected: ")}{selected.length}</span><input type="search" aria-label={t("筛选：", "Filter: ") + label} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label>}
      {options.length > 0 && filtered.length === 0 && <p>{t("没有匹配引用", "No matching references")}</p>}
      {options.length === 0 ? <p>{emptyLabel}</p> : <div>{filtered.slice(page * 20, (page + 1) * 20).map((option) => {
        const active = selected.includes(option.id);
        return (
          <button
            type="button"
            disabled={disabled}
            key={option.id}
            className={active ? "selected" : ""}
            aria-pressed={active}
            onClick={() => onChange(active ? selected.filter((id) => id !== option.id) : [...selected, option.id])}
          >
            {active && <Check size={12} />}
            <span>{option.label}</span>
          </button>
        );
      })}</div>}
      {pageCount > 1 && <nav className={styles.pagination} aria-label={t("引用分页：", "Reference pages: ") + label}>
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("上一页", "Previous page")}</button>
        <span role="status">{t("第 " + (page + 1) + " / " + pageCount + " 页", "Page " + (page + 1) + " of " + pageCount)}</span>
        <button type="button" disabled={page === pageCount - 1} onClick={() => setPage(page + 1)}>{t("下一页", "Next page")}</button>
      </nav>}
    </fieldset>
  );
}

