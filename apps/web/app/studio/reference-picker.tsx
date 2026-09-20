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
  const filtered = options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const t = (zh: string, en: string) => uiText(locale, zh, en);
  return (
    <fieldset className="reference-picker wide">
      <legend>{label}</legend>
      {(options.length > 6 || query) && <label className={styles.referenceSearch}><span>{t("筛选引用", "Filter references")} · {t("已选 ", "Selected: ")}{selected.length}</span><input type="search" aria-label={t("筛选：", "Filter: ") + label} value={query} onChange={(event) => setQuery(event.target.value)} /></label>}
      {options.length > 0 && filtered.length === 0 && <p>{t("没有匹配引用", "No matching references")}</p>}
      {options.length === 0 ? <p>{emptyLabel}</p> : <div>{filtered.map((option) => {
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
    </fieldset>
  );
}

