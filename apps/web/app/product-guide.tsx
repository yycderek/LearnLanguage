"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  CircleHelp,
  DatabaseBackup,
  GraduationCap,
  Library,
  PencilRuler,
  Repeat2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { uiText, type AppLocale } from "@/lib/i18n";

export type ProductGuideAudience = "learn" | "studio";

type GuideStep = {
  eyebrow: [string, string];
  title: [string, string];
  description: [string, string];
  icon: typeof CircleHelp;
  items: Array<{ icon: typeof CircleHelp; title: [string, string]; body: [string, string] }>;
};

const sharedDataStep: GuideStep = {
  eyebrow: ["可选能力与数据", "OPTIONAL TOOLS & DATA"],
  title: ["AI 可以不设置，学习数据保存在当前设备", "AI is optional, and learning data stays on this device"],
  description: ["没有账户、没有 AI 也能完成内置课程。需要开放任务反馈时，再配置你自己的 AI 服务。", "Built-in courses work without an account or AI. Configure your own AI only when you want feedback on open-ended tasks."],
  icon: ShieldCheck,
  items: [
    { icon: Bot, title: ["AI 完全可选", "AI is optional"], body: ["单选、排序、短输入和本地规则练习不依赖 AI；密钥只保留到当前标签页关闭。", "Choice, ordering, short-input, and local-rule exercises do not need AI; keys are cleared when this tab closes."] },
    { icon: DatabaseBackup, title: ["记得备份", "Remember to back up"], body: ["学习档案、课程草稿和自定义语言包需要分别导出；清除浏览器站点数据可能删除本地内容。", "Export learning profiles, course drafts, and custom Language Packs separately; clearing browser site data can remove local content."] },
  ],
};

const learnSteps: GuideStep[] = [
  {
    eyebrow: ["欢迎使用", "WELCOME"],
    title: ["学习和课程设计是两个独立空间", "Learning and course creation are separate spaces"],
    description: ["Learn 用于正式学习并保存进度；Studio 用于创建、预览和发布课程。Studio 预览不会写入真实学习档案。", "Learn saves real progress. Studio creates, previews, and publishes courses; Studio previews never change your real learning profile."],
    icon: GraduationCap,
    items: [
      { icon: GraduationCap, title: ["Learn 学习空间", "Learn space"], body: ["选择课程并一键开始，完成课节、查看掌握度并按计划复习。", "Choose a course and start in one click, complete lessons, track mastery, and review on schedule."] },
      { icon: PencilRuler, title: ["Studio 创作空间", "Studio space"], body: ["使用模板编辑课程内容，预览后发布，再安装到 Learn。", "Edit with templates, preview, publish, then install the course in Learn."] },
    ],
  },
  {
    eyebrow: ["开始学习", "START LEARNING"],
    title: ["选择一门课程，一次点击开始学习", "Choose a course and start in one click"],
    description: ["内置日语和粤语课程可以直接开始。系统会自动安装并进入当前应学课节；课程和进度保存在当前浏览器。", "The built-in Japanese and Cantonese courses can start immediately. The app installs the course and opens the right lesson; course data and progress stay in this browser."],
    icon: Library,
    items: [
      { icon: Library, title: ["1. 选择并开始", "1. Choose and start"], body: ["在课程库点击“一键开始学习”，系统会自动安装并进入当前应学课节。", "Choose Start learning in the course library to install the course and enter the right lesson automatically."] },
      { icon: BookOpen, title: ["2. 按顺序学习", "2. Follow the path"], body: ["完成一课会解锁下一课；已完成课程可以随时重新学习。", "Completing a lesson unlocks the next one, and completed lessons can be revisited anytime."] },
    ],
  },
  {
    eyebrow: ["学习循环", "LEARNING LOOP"],
    title: ["基础检查决定是否跳过，掌握证据决定何时复习", "Diagnostics decide whether to skip; mastery evidence schedules review"],
    description: ["基础检查通过后可以直接完成该基础课；未通过会进入正常教学，不会因检查失败降低掌握度。", "Passing a foundation diagnostic lets you complete that lesson immediately. Otherwise teaching begins normally, without treating the diagnostic miss as negative mastery."],
    icon: Repeat2,
    items: [
      { icon: Check, title: ["诊断不是考试成绩", "A diagnostic is not an exam score"], body: ["它只帮助选择学习路径，不代表 CEFR 或 JLPT 认证结果。", "It only selects a learning path and is not a CEFR or JLPT certification result."] },
      { icon: Repeat2, title: ["复习自动出现", "Reviews appear automatically"], body: ["完成学习后系统按掌握证据生成复习任务；你可以在学习首页查看队列。", "After learning, the system schedules reviews from mastery evidence and shows them on the learning home page."] },
    ],
  },
  sharedDataStep,
];

const studioSteps: GuideStep[] = [
  learnSteps[0]!,
  {
    eyebrow: ["创建课程", "CREATE A COURSE"],
    title: ["从模板开始，不需要编写 JSON", "Start from a template—no JSON required"],
    description: ["选择目标语言和课程模板，再依次维护知识点、例句、练习、课节与学习步骤。JSON 模式只面向需要精细控制的高级作者。", "Choose a target language and template, then maintain knowledge, utterances, exercises, lessons, and steps. JSON mode is only for advanced authors who need precise control."],
    icon: PencilRuler,
    items: [
      { icon: Sparkles, title: ["先定义 Can-do 目标", "Begin with a Can-do goal"], body: ["描述学习者完成本课后能在什么场景做什么，再添加所需内容和练习。", "Describe what learners can do in a real situation, then add the content and exercises they need."] },
      { icon: BookOpen, title: ["中文与英文分别维护", "Maintain Chinese and English"], body: ["右上角语言同时切换界面和当前编辑的教学文本。", "The language selector changes both the interface and the teaching text being edited."] },
    ],
  },
  {
    eyebrow: ["从草稿到学习", "FROM DRAFT TO LEARN"],
    title: ["保存、预览、发布、安装是四个不同动作", "Save, preview, publish, and install are four different actions"],
    description: ["草稿可以继续修改；预览使用临时档案；发布后版本不可覆盖；只有安装后才会出现在正式学习空间。", "Drafts remain editable, previews use a temporary profile, published versions are immutable, and a course appears in Learn only after installation."],
    icon: GraduationCap,
    items: [
      { icon: Check, title: ["发布前检查", "Check before publishing"], body: ["完成作者、许可证、本地化、课程流程和练习连接等阻塞项。", "Complete author, license, localization, lesson flow, and exercise-link blockers."] },
      { icon: GraduationCap, title: ["安装到学习空间", "Install in Learn"], body: ["发布成功后点击“安装到学习空间”，再切换到 Learn 正式体验。", "After publishing, choose Install in Learn, then switch to Learn for the real experience."] },
    ],
  },
  sharedDataStep,
];

export function ProductGuide({
  open,
  audience,
  locale,
  onClose,
}: {
  open: boolean;
  audience: ProductGuideAudience;
  locale: AppLocale;
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = useMemo(() => audience === "learn" ? learnSteps : studioSteps, [audience]);
  const c = (chinese: string, english: string) => uiText(locale, chinese, english);
  const step = (steps[stepIndex] ?? steps[0])!;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setStepIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setStepIndex((current) => Math.min(steps.length - 1, current + 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, steps.length]);

  if (!open) return null;
  const StepIcon = step.icon;
  const last = stepIndex === steps.length - 1;

  return (
    <div className="product-guide-backdrop" role="presentation">
      <section className="product-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="product-guide-title">
        <header className="product-guide-header">
          <div className="product-guide-mark"><StepIcon size={24} /></div>
          <div><span>{c(...step.eyebrow)}</span><h2 id="product-guide-title">{c(...step.title)}</h2></div>
          <button onClick={onClose} aria-label={c("关闭使用帮助", "Close guide")}><X size={19} /></button>
        </header>
        <div className="product-guide-body">
          <p>{c(...step.description)}</p>
          <div className="product-guide-items">
            {step.items.map((item) => {
              const ItemIcon = item.icon;
              return <article key={item.title[1]}><span><ItemIcon size={18} /></span><div><strong>{c(...item.title)}</strong><p>{c(...item.body)}</p></div></article>;
            })}
          </div>
        </div>
        <footer className="product-guide-footer">
          <div className="product-guide-progress" aria-label={c(`第 ${stepIndex + 1} 步，共 ${steps.length} 步`, `Step ${stepIndex + 1} of ${steps.length}`)}>{steps.map((_, index) => <button key={index} className={index === stepIndex ? "active" : ""} onClick={() => setStepIndex(index)} aria-label={c(`查看第 ${index + 1} 步`, `Go to step ${index + 1}`)} />)}</div>
          <div>
            {stepIndex > 0 && <button className="guide-secondary" onClick={() => setStepIndex((current) => current - 1)}><ArrowLeft size={15} />{c("上一步", "Back")}</button>}
            <button className="guide-primary" onClick={() => last ? onClose() : setStepIndex((current) => current + 1)}>{last ? c("知道了，开始使用", "Got it, start using") : c("下一步", "Next")}{last ? <Check size={16} /> : <ArrowRight size={16} />}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
