import { uiText, type AppLocale } from "@/lib/i18n";
import styles from "./editor-tools.module.css";

export function ContentPagination({ locale, page, pageCount, onPageChange, bottom = false }: {
  locale: AppLocale; page: number; pageCount: number; onPageChange: (page: number) => void; bottom?: boolean;
}) {
  if (pageCount <= 1) return null;
  const t = (zh: string, en: string) => uiText(locale, zh, en);
  return <nav className={styles.pagination} aria-label={bottom ? t("内容分页（底部）", "Content pages (bottom)") : t("内容分页", "Content pages")}>
    <button type="button" disabled={page === 0} onClick={() => onPageChange(page - 1)}>{t("上一页", "Previous page")}</button>
    <label><span>{t("页码", "Page")}</span><select aria-label={t("转到页码", "Go to page")} value={page} onChange={(event) => onPageChange(Number(event.target.value))}>
      {Array.from({ length: pageCount }, (_, index) => <option value={index} key={index}>{index + 1} / {pageCount}</option>)}
    </select></label>
    <button type="button" disabled={page === pageCount - 1} onClick={() => onPageChange(page + 1)}>{t("下一页", "Next page")}</button>
  </nav>;
}
