"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bot,
  Braces,
  Check,
  ChevronRight,
  Clock3,
  FileJson,
  KeyRound,
  Languages,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  displayText,
  sampleCourse,
  validateCourse,
  type CoursePack,
  type ImportIssue,
} from "@/lib/course";

type HistoryItem = {
  draftId: string;
  revision: number;
  title: string;
  languageId: string;
  updatedAt: string;
  payload: string;
};

type AiProvider = "openai" | "anthropic" | "gemini" | "compatible";

type AiSettings = {
  provider: AiProvider;
  model: string;
  endpoint: string;
  apiKey: string;
};

const DRAFTS_STORAGE_KEY = "learn-language-drafts-v1";
const AI_STORAGE_KEY = "learn-language-ai-settings-v1";

const defaultAiSettings: AiSettings = {
  provider: "openai",
  model: "",
  endpoint: "",
  apiKey: "",
};

const providerLabels: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  compatible: "OpenAI 兼容 / 本地模型",
};

const languages = [
  { id: "ja", native: "日本語", name: "日语", accent: "桜" },
  { id: "yue-Hant-HK", native: "粵語", name: "粤语", accent: "粵" },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function CourseStudio() {
  const [language, setLanguage] = useState("ja");
  const [source, setSource] = useState(() =>
    JSON.stringify(sampleCourse("ja"), null, 2),
  );
  const [course, setCourse] = useState<CoursePack>(() => sampleCourse("ja"));
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [draftId, setDraftId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("示例课程已载入，可以直接编辑");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettings>(defaultAiSettings);
  const [aiConfigured, setAiConfigured] = useState(false);

  const stats = useMemo(
    () => [
      [course.lessons.length, "课节"],
      [course.knowledge.length, "知识点"],
      [course.exercises.length, "练习"],
      [
        course.lessons.reduce((count, lesson) => count + lesson.steps.length, 0),
        "学习步骤",
      ],
    ],
    [course],
  );

  useEffect(() => {
    const storedHistory = readJson<HistoryItem[]>(DRAFTS_STORAGE_KEY, []);
    const storedAi = readJson<AiSettings>(AI_STORAGE_KEY, defaultAiSettings);
    setHistory(storedHistory);
    setAiSettings(storedAi);
    setAiConfigured(Boolean(storedAi.model || storedAi.apiKey));
  }, []);

  function loadSample(id: string) {
    const next = sampleCourse(id);
    setLanguage(id);
    setCourse(next);
    setSource(JSON.stringify(next, null, 2));
    setIssues([]);
    setDraftId(undefined);
    setNotice(`${languages.find((item) => item.id === id)?.name ?? id}示例已载入`);
  }

  function importSource() {
    const result = validateCourse(source);
    setIssues(result.issues);
    if (result.course) {
      setCourse(result.course);
      setLanguage(result.course.manifest.languageId);
      setNotice("课程包校验通过，预览已更新");
    } else {
      setNotice(`发现 ${result.issues.length} 个需要修正的问题`);
    }
  }

  function saveDraft() {
    const result = validateCourse(source);
    if (!result.course) {
      setIssues(result.issues);
      setNotice("请先修正课程包问题");
      return;
    }

    setSaving(true);
    const nextDraftId = draftId ?? crypto.randomUUID();
    const latestRevision = history
      .filter((item) => item.draftId === nextDraftId)
      .reduce((max, item) => Math.max(max, item.revision), 0);
    const local: HistoryItem = {
      draftId: nextDraftId,
      revision: latestRevision + 1,
      title: displayText(result.course.manifest.title),
      languageId: result.course.manifest.languageId,
      updatedAt: new Date().toISOString(),
      payload: source,
    };
    const nextHistory = [local, ...history].slice(0, 24);

    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(nextHistory));
    setDraftId(nextDraftId);
    setHistory(nextHistory);
    setNotice(`已保存到当前设备 · 修订 ${local.revision}`);
    setSaving(false);
  }

  function restore(item: HistoryItem) {
    const parsed = validateCourse(item.payload);
    if (!parsed.course) return;
    setSource(item.payload);
    setCourse(parsed.course);
    setLanguage(parsed.course.manifest.languageId);
    setDraftId(item.draftId);
    setIssues([]);
    setNotice(`已恢复修订 ${item.revision}`);
  }

  function saveAiSettings() {
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(aiSettings));
    setAiConfigured(Boolean(aiSettings.model || aiSettings.apiKey));
    setAiOpen(false);
    setNotice(`${providerLabels[aiSettings.provider]} 配置已保存到当前设备`);
  }

  const currentLanguage = languages.find((item) => item.id === language);
  const flow = course.lessons[0]?.steps ?? [];

  return (
    <main className="studio-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Languages size={20} /></div>
          <div><strong>LearnLanguage</strong><span>课程工作台</span></div>
        </div>
        <nav className="side-nav" aria-label="工作台导航">
          <button className="nav-item active"><BookOpen size={18} /><span>课程编辑器</span></button>
          <button className="nav-item"><Clock3 size={18} /><span>本地草稿</span><em>{history.length}</em></button>
        </nav>
        <div className="section-label">目标语言</div>
        <div className="language-list">
          {languages.map((item) => (
            <button
              key={item.id}
              className={`language-button ${language === item.id ? "selected" : ""}`}
              onClick={() => loadSample(item.id)}
            >
              <span className="language-glyph">{item.accent}</span>
              <span><strong>{item.native}</strong><small>{item.name}</small></span>
              {language === item.id && <Check size={16} />}
            </button>
          ))}
          <button className="language-button add-language">
            <Plus size={17} />
            <span><strong>添加语言</strong><small>导入自定义语料</small></span>
          </button>
        </div>
        <div className="sidebar-note">
          <Sparkles size={16} />
          <p>语言只是内容包。学习流程、掌握度与复习机制由同一套引擎驱动。</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <div className="eyebrow"><span className="status-dot" />无需登录 · 设备本地</div>
            <h1>{displayText(course.manifest.title)}</h1>
          </div>
          <div className="top-actions">
            <button className="ai-button" onClick={() => setAiOpen(true)}>
              <Bot size={17} />
              AI 设置
              <span className={`ai-state ${aiConfigured ? "configured" : ""}`} />
            </button>
            <button className="save-button" onClick={saveDraft} disabled={saving}>
              <Save size={17} />{saving ? "正在保存…" : "保存草稿"}
            </button>
          </div>
        </header>

        <div className="status-strip">
          <div><ShieldCheck size={16} /><span>{notice}</span></div>
          <span className="schema-pill">Schema v{course.schemaVersion}</span>
        </div>

        <div className="work-grid">
          <section className="editor-panel panel">
            <div className="panel-heading">
              <div><span className="kicker">COURSE PACK</span><h2>导入与校验</h2></div>
              <button className="text-button" onClick={() => loadSample(language)}><RotateCcw size={15} />重置示例</button>
            </div>
            <div className="editor-toolbar">
              <div><FileJson size={16} /><span>{course.manifest.id}.json</span></div>
              <span>{source.split("\n").length} 行</span>
            </div>
            <textarea aria-label="课程包 JSON" value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} />
            <div className="editor-footer">
              <button className="primary-button" onClick={importSource}><Braces size={16} />校验并预览</button>
              <span>支持任何符合 Course Pack v1 的语言内容</span>
            </div>
            {issues.length > 0 && (
              <div className="issue-box">
                <div className="issue-title"><TriangleAlert size={17} /><strong>{issues.length} 个问题</strong></div>
                {issues.slice(0, 5).map((issue, index) => (
                  <div className="issue-row" key={`${issue.path}-${index}`}>
                    <span>{issue.stage}</span><code>{issue.path}</code><p>{issue.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="preview-column">
            <section className="course-card panel">
              <div className="course-cover">
                <span>{currentLanguage?.accent ?? language.slice(0, 2)}</span>
                <div className="cover-orbit orbit-one" /><div className="cover-orbit orbit-two" />
              </div>
              <div className="course-info">
                <div className="course-meta"><span>{currentLanguage?.native ?? language}</span><span>·</span><span>{course.manifest.status}</span></div>
                <h2>{displayText(course.manifest.title)}</h2>
                <p>{displayText(course.manifest.description)}</p>
                <div className="stat-grid">
                  {stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
                </div>
              </div>
            </section>

            <section className="flow-panel panel">
              <div className="panel-heading">
                <div><span className="kicker">LEARNING FLOW</span><h2>课程流程预览</h2></div>
                <span className="count-badge">{flow.length} 步</span>
              </div>
              <div className="flow-list">
                {flow.map((step, index) => (
                  <div className="flow-step" key={step.id}>
                    <div className="step-index">{String(index + 1).padStart(2, "0")}</div>
                    <div><strong>{displayText(step.title)}</strong><span>{step.phase}</span></div>
                    {index < flow.length - 1 && <ChevronRight size={15} />}
                  </div>
                ))}
              </div>
            </section>

            <section className="history-panel panel">
              <div className="panel-heading"><div><span className="kicker">VERSION HISTORY</span><h2>当前设备的修订</h2></div></div>
              {history.length === 0 ? (
                <div className="empty-history"><Clock3 size={20} /><p>保存草稿后，修订记录会保留在这个浏览器中。</p></div>
              ) : (
                <div className="history-list">
                  {history.slice(0, 4).map((item) => (
                    <button key={`${item.draftId}-${item.revision}`} onClick={() => restore(item)}>
                      <span className="revision">v{item.revision}</span>
                      <span><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></span>
                      <RotateCcw size={14} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </section>

      {aiOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-dialog-title">
            <div className="dialog-heading">
              <div className="dialog-icon"><Settings2 size={20} /></div>
              <div><span className="kicker">PERSONAL AI</span><h2 id="ai-dialog-title">选择你使用的 AI</h2></div>
              <button className="icon-button" onClick={() => setAiOpen(false)} aria-label="关闭 AI 设置"><X size={18} /></button>
            </div>

            <div className="dialog-body">
              <label>
                <span>AI 服务商</span>
                <select
                  value={aiSettings.provider}
                  onChange={(event) => setAiSettings((current) => ({ ...current, provider: event.target.value as AiProvider }))}
                >
                  {Object.entries(providerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>

              <label>
                <span>模型 ID</span>
                <input
                  value={aiSettings.model}
                  onChange={(event) => setAiSettings((current) => ({ ...current, model: event.target.value }))}
                  placeholder="例如：你账户中可用的模型名称"
                />
              </label>

              <label>
                <span>API 地址（可选）</span>
                <input
                  value={aiSettings.endpoint}
                  onChange={(event) => setAiSettings((current) => ({ ...current, endpoint: event.target.value }))}
                  placeholder="自定义或本地服务地址"
                />
              </label>

              <label>
                <span>API 密钥（可选）</span>
                <div className="key-input">
                  <KeyRound size={16} />
                  <input
                    type="password"
                    value={aiSettings.apiKey}
                    onChange={(event) => setAiSettings((current) => ({ ...current, apiKey: event.target.value }))}
                    placeholder="仅保存在当前浏览器"
                    autoComplete="off"
                  />
                </div>
              </label>

              <div className="privacy-note">
                <ShieldCheck size={17} />
                <p>配置只保存在你的设备中，不会发送给 LearnLanguage。后续 AI 生成功能会使用这里选择的服务。</p>
              </div>
            </div>

            <div className="dialog-footer">
              <button className="text-button" onClick={() => setAiOpen(false)}>取消</button>
              <button className="primary-button" onClick={saveAiSettings}>保存到当前设备</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
