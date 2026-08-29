import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AccessibilityInfo,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { bundledStarterCourses, builtInLanguagePacks } from "@learn-language/content";
import { assessCourseLanguageCompatibility } from "@learn-language/language-runtime";
import { assessCourseTrust } from "@learn-language/application/trust";
import { assessCourseUpdate, upgradeCourseLearningRecord } from "@learn-language/application/course-update";
import { courseAdaptiveAgenda } from "@learn-language/application/adaptive-agenda";
import {
  LearningPlanApplicationService,
  type CreateLearningPlanCommand,
  type LearningMotivation,
  type LearningPlan,
} from "@learn-language/application/learning-plan";
import { CourseLibraryApplicationService, LanguagePackApplicationService, languagePackReferenceUsage } from "@learn-language/application/workspace";
import {
  completeReviewTask,
  courseLearningPercent,
  createCourseLearningRecord,
  startLearning,
  submitLearningStep,
  updateCourseLearningRecord,
  type CourseLearningRecord,
  type LearningProgress,
} from "@learn-language/application/learning-record";
import {
  createExerciseResponse,
  evaluateExerciseResponse,
  serializeExerciseResponse,
  type ExerciseResponse,
} from "@learn-language/application/exercise-response";
import type { CoursePack, Exercise, LanguageDefinition } from "@learn-language/protocol";
import { exportMobileBackup, importMobileBackup } from "./src/backup";
import { chooseCoursePackFile, chooseLanguagePackFile, mergeMobileCourses, mergeMobileLanguagePacks } from "./src/content-import";
import { mobileReviewItems, mobileText, nextLessonIndex, type MobileLocale } from "./src/model";
import {
  migrateMobileDatabase,
  SQLiteInstalledCourseRepository,
  SQLiteLanguagePackRepository,
  SQLiteLearningPlanRepository,
  SQLiteLearningProfileRepository,
  SQLitePreferenceRepository,
} from "./src/storage";

const bundledCourses = bundledStarterCourses();
const bundledCourseIds = new Set(bundledCourses.map((course) => course.manifest.id));
const builtInLanguageIds = new Set(builtInLanguagePacks.map((pack) => pack.id));

type Screen =
  | { kind: "home" }
  | { kind: "course"; courseId: string }
  | { kind: "plan"; courseId: string }
  | { kind: "lesson"; courseId: string; lessonId: string }
  | { kind: "reviews" }
  | { kind: "settings" };

const copy = (locale: MobileLocale, zh: string, en: string) => locale === "zh-CN" ? zh : en;

function Button({
  label,
  onPress,
  disabled = false,
  tone = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={8}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "primary" ? styles.buttonPrimary : tone === "danger" ? styles.buttonDanger : styles.buttonSecondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={tone === "primary" ? styles.buttonPrimaryText : tone === "danger" ? styles.buttonDangerText : styles.buttonSecondaryText}>
        {label}
      </Text>
    </Pressable>
  );
}

function AppHeader({ locale, title, subtitle }: { locale: MobileLocale; title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>L</Text></View>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>{copy(locale, "本地优先语言学习", "LOCAL-FIRST LANGUAGE LEARNING")}</Text>
        <Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function Onboarding({
  locale,
  onLocale,
  onComplete,
}: {
  locale: MobileLocale;
  onLocale: (locale: MobileLocale) => Promise<void>;
  onComplete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try { await work(); }
    catch (error) { setNotice(copy(locale, "操作失败，请重试。", "Something went wrong. Try again.") + (error instanceof Error ? `\n${error.message}` : "")); }
    finally { setBusy(false); }
  };
  return (
    <ScrollView contentContainerStyle={styles.onboardingContent}>
      <AppHeader locale={locale} title={copy(locale, "开始你的语言学习", "Start language learning")} subtitle={copy(locale, "自由选择语种、课程和学习节奏", "Choose any language, course, and learning pace")} />
      <View style={styles.choiceGrid}>
        <Button label="中文" onPress={() => void run(() => onLocale("zh-CN"))} tone={locale === "zh-CN" ? "primary" : "secondary"} disabled={busy} />
        <Button label="English" onPress={() => void run(() => onLocale("en"))} tone={locale === "en" ? "primary" : "secondary"} disabled={busy} />
      </View>
      <View style={styles.onboardingCard}>
        <Text style={styles.onboardingNumber}>1</Text>
        <View style={styles.onboardingCopy}><Text style={styles.settingsTitle}>{copy(locale, "无需账户", "No account required")}</Text><Text style={styles.settingsText}>{copy(locale, "课程、计划和进度默认保存在当前设备，可离线学习。", "Courses, plans, and progress stay on this device and work offline.")}</Text></View>
      </View>
      <View style={styles.onboardingCard}>
        <Text style={styles.onboardingNumber}>2</Text>
        <View style={styles.onboardingCopy}><Text style={styles.settingsTitle}>{copy(locale, "先选课程，再定节奏", "Choose a course, then your pace")}</Text><Text style={styles.settingsText}>{copy(locale, "可直接开始，也可设置学习目的、每天时长和每周频率。", "Start immediately, or set a goal, daily time, and weekly frequency.")}</Text></View>
      </View>
      <View style={styles.onboardingCard}>
        <Text style={styles.onboardingNumber}>3</Text>
        <View style={styles.onboardingCopy}><Text style={styles.settingsTitle}>{copy(locale, "学习与课程设计分开", "Learning and authoring are separate")}</Text><Text style={styles.settingsText}>{copy(locale, "移动端负责学习；Web Studio 负责设计课程。发布后的 Course Pack 可在设置中导入。", "Mobile is for learning; Web Studio is for authoring. Import published Course Packs in Settings.")}</Text></View>
      </View>
      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>{copy(locale, "记得备份", "Remember backups")}</Text>
        <Text style={styles.privacyText}>{copy(locale, "换机、重装或卸载前，到“设置与数据”导出本地备份。", "Before switching devices, reinstalling, or uninstalling, export a local backup from Settings.")}</Text>
      </View>
      {notice ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
      <Button label={busy ? copy(locale, "正在保存…", "Saving…") : copy(locale, "进入学习", "Start learning")} onPress={() => void run(onComplete)} disabled={busy} />
    </ScrollView>
  );
}

function StartupFailure({ locale, message, onRetry }: { locale: MobileLocale; message: string; onRetry: () => void }) {
  return (
    <View style={styles.failureScreen}>
      <Text style={styles.failureTitle}>{copy(locale, "无法打开本地学习档案", "Could not open local learning profile")}</Text>
      <Text style={styles.failureText}>{copy(locale, "数据没有被删除。请重试；如果持续失败，请保留错误信息。", "No data was deleted. Retry; if the problem continues, keep the error details.")}</Text>
      <Text accessibilityLiveRegion="assertive" selectable style={styles.failureDetail}>{message}</Text>
      <Button label={copy(locale, "重新尝试", "Try again")} onPress={onRetry} />
    </View>
  );
}
function BottomNav({ locale, active, onChange }: { locale: MobileLocale; active: "learn" | "reviews" | "settings"; onChange: (value: "learn" | "reviews" | "settings") => void }) {
  const items = [
    { id: "learn" as const, zh: "学习", en: "Learn" },
    { id: "reviews" as const, zh: "复习", en: "Review" },
    { id: "settings" as const, zh: "设置", en: "Settings" },
  ];
  return (
    <View style={styles.bottomNav}>
      {items.map((item) => (
        <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: active === item.id }} onPress={() => onChange(item.id)} style={[styles.navItem, active === item.id && styles.navItemActive]}>
          <Text style={[styles.navLabel, active === item.id && styles.navLabelActive]}>{copy(locale, item.zh, item.en)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Home({
  locale,
  records,
  plans,
  courses,
  languagePacks,
  onCourse,
}: {
  locale: MobileLocale;
  records: Record<string, CourseLearningRecord>;
  plans: Record<string, LearningPlan>;
  courses: readonly CoursePack[];
  languagePacks: readonly LanguageDefinition[];
  onCourse: (courseId: string) => void;
}) {
  const occurredAt = new Date().toISOString();
  const agendas = courses.flatMap((course) => {
    const plan = plans[course.manifest.id];
    return plan ? [{ course, agenda: courseAdaptiveAgenda(course, records[course.manifest.id], plan, occurredAt) }] : [];
  });
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <AppHeader locale={locale} title={copy(locale, "今天学一点", "Learn a little today")} subtitle={copy(locale, "课程、计划、进度和复习都保存在当前设备", "Courses, plans, progress, and review stay on this device")} />
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{copy(locale, "今日安排", "Today’s agenda")}</Text>
        <Text style={styles.sectionNote}>{copy(locale, "按学习证据自动调整", "Adapts to learning evidence")}</Text>
      </View>
      {agendas.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{copy(locale, "还没有个人计划", "No personal plan yet")}</Text>
          <Text style={styles.emptyText}>{copy(locale, "打开任一课程设置节奏。计划不是学习门槛，之后也能修改。", "Open any course to set your pace. A plan is optional and can be changed later.")}</Text>
        </View>
      ) : agendas.map(({ course, agenda }) => (
        <View key={course.manifest.id} style={styles.agendaCard}>
          <Text style={styles.cardLabel}>{mobileText(course.manifest.title, locale)}</Text>
          <Text style={styles.agendaTitle}>{agenda.status === "course-complete" ? copy(locale, "课程已完成", "Course complete") : agenda.status === "target-met" ? copy(locale, "本周目标已完成", "Weekly target met") : copy(locale, `今天还需 ${agenda.today.remainingMinutes} 分钟`, `${agenda.today.remainingMinutes} min left today`)}</Text>
          <Text style={styles.agendaMeta}>{copy(locale, `本周 ${agenda.week.completedMinutes}/${agenda.week.targetMinutes} 分钟`, `${agenda.week.completedMinutes}/${agenda.week.targetMinutes} min this week`)}</Text>
          <Button label={agenda.status === "course-complete" ? copy(locale, "查看已完成课程", "View completed course") : copy(locale, "开始今日安排", "Start today’s agenda")} onPress={() => onCourse(course.manifest.id)} tone={agenda.status === "active" ? "primary" : "secondary"} />
        </View>
      ))}
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{copy(locale, "选择课程", "Choose a course")}</Text>
        <Text style={styles.sectionNote}>{copy(locale, "内置与导入课程均可离线学习", "Built-in and imported courses work offline")}</Text>
      </View>
      {courses.map((course) => {
        const pack = languagePacks.find((item) => item.id === course.manifest.languageId);
        const record = records[course.manifest.id];
        const plan = plans[course.manifest.id];
        const percent = courseLearningPercent(course, record);
        const next = course.lessons[nextLessonIndex(course, record)];
        return (
          <Pressable key={course.manifest.id} accessibilityRole="button" accessibilityLabel={copy(locale, `${mobileText(course.manifest.title, locale)}，进度 ${percent}%`, `${mobileText(course.manifest.title, locale)}, ${percent}% complete`)} accessibilityHint={copy(locale, "打开课程详情", "Opens course details")} onPress={() => onCourse(course.manifest.id)} style={({ pressed }) => [styles.courseCard, pressed && styles.pressed]}>
            <View style={[styles.languageBadge, { backgroundColor: pack?.accent ?? "#5a48d6" }]}>
              <Text style={styles.languageBadgeText}>{pack?.id.slice(0, 2).toUpperCase() ?? "LL"}</Text>
            </View>
            <View style={styles.courseBody}>
              <Text style={styles.courseTitle}>{mobileText(course.manifest.title, locale)}</Text>
              <Text numberOfLines={2} style={styles.courseDescription}>{mobileText(course.manifest.description, locale)}</Text>
              <Text style={styles.nextLesson}>{copy(locale, "下一课", "Next")}: {next ? mobileText(next.title, locale) : "—"}</Text>
              <View accessibilityRole="progressbar" accessibilityLabel={copy(locale, "课程进度", "Course progress")} accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
              <Text style={styles.progressText}>{percent}% · {record?.completedLessonIds.length ?? 0}/{course.lessons.length} · {plan ? copy(locale, `${plan.minutesPerDay} 分钟/天`, `${plan.minutesPerDay} min/day`) : copy(locale, "未设置计划", "No plan")}</Text>
            </View>
          </Pressable>
        );
      })}
      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>{copy(locale, "无需账户", "No account required")}</Text>
        <Text style={styles.privacyText}>{copy(locale, "首版移动端不依赖云端。没有网络时，内置课程、已导入课程与本地进度仍可使用。", "The first mobile release does not depend on cloud services. Built-in courses, imported courses, and local progress remain available offline.")}</Text>
      </View>
    </ScrollView>
  );
}

function CourseDetail({
  locale,
  course,
  record,
  plan,
  onBack,
  onPlan,
  onLesson,
  onReviews,
}: {
  locale: MobileLocale;
  course: CoursePack;
  record: CourseLearningRecord | undefined;
  plan: LearningPlan | undefined;
  onBack: () => void;
  onPlan: () => void;
  onLesson: (lessonId: string) => void;
  onReviews: () => void;
}) {
  const percent = courseLearningPercent(course, record);
  const agenda = plan ? courseAdaptiveAgenda(course, record, plan) : undefined;
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Button label={copy(locale, "返回课程", "Back to courses")} onPress={onBack} tone="secondary" />
      <AppHeader locale={locale} title={mobileText(course.manifest.title, locale)} subtitle={mobileText(course.manifest.description, locale)} />
      <View accessibilityRole="progressbar" accessibilityLabel={copy(locale, "课程进度", "Course progress")} accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.summaryCard}>
        <Text style={styles.summaryValue}>{percent}%</Text>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{copy(locale, "课程进度", "Course progress")}</Text>
          <Text style={styles.summaryText}>{record?.completedLessonIds.length ?? 0}/{course.lessons.length} {copy(locale, "课已完成", "lessons completed")}</Text>
        </View>
      </View>
      <View style={styles.agendaCard}>
        <Text style={styles.cardLabel}>{copy(locale, "个人学习计划", "PERSONAL LEARNING PLAN")}</Text>
        {agenda && plan ? (
          <>
            <Text style={styles.agendaTitle}>{agenda.status === "course-complete" ? copy(locale, "你已完成这门课程", "You completed this course") : agenda.status === "target-met" ? copy(locale, "本周目标已完成", "Weekly target complete") : copy(locale, `今天还需 ${agenda.today.remainingMinutes} 分钟`, `${agenda.today.remainingMinutes} min left today`)}</Text>
            <Text style={styles.agendaMeta}>{copy(locale, `每周 ${plan.daysPerWeek} 天 · 每天 ${plan.minutesPerDay} 分钟 · 本周 ${agenda.week.completedMinutes}/${agenda.week.targetMinutes} 分钟`, `${plan.daysPerWeek} days/week · ${plan.minutesPerDay} min/day · ${agenda.week.completedMinutes}/${agenda.week.targetMinutes} min this week`)}</Text>
            <View style={styles.stackActions}>
              {agenda.items.map((item) => item.kind === "review"
                ? <Button key="review" label={copy(locale, `复习 ${item.taskCount} 项`, `Review ${item.taskCount} item(s)`)} onPress={onReviews} tone="secondary" />
                : <Button key={item.lessonId} label={copy(locale, item.kind === "continue-lesson" ? "继续建议课节" : "开始建议课节", item.kind === "continue-lesson" ? "Continue suggested lesson" : "Start suggested lesson")} onPress={() => onLesson(item.lessonId)} />)}
              <Button label={copy(locale, "调整计划", "Edit plan")} onPress={onPlan} tone="secondary" />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.agendaTitle}>{copy(locale, "建立适合你的节奏", "Set your own pace")}</Text>
            <Text style={styles.agendaMeta}>{copy(locale, "选择学习目的、每天时长和每周频率，系统会根据已完成课节与到期复习生成今日安排。", "Choose a goal, daily time, and weekly frequency. Today’s agenda adapts to completed lessons and due reviews.")}</Text>
            <Button label={copy(locale, "设置学习计划", "Set learning plan")} onPress={onPlan} />
          </>
        )}
      </View>
      <Text style={styles.sectionTitle}>{copy(locale, "课节路径", "Lesson path")}</Text>
      {course.lessons.map((lesson, index) => {
        const completed = record?.completedLessonIds.includes(lesson.id) === true;
        const active = record?.lessonProgress[lesson.id]?.status === "active";
        const unlocked = index === 0 || completed || active || record?.completedLessonIds.includes(course.lessons[index - 1]?.id ?? "") === true;
        return (
          <View key={lesson.id} style={[styles.lessonCard, !unlocked && styles.lockedCard]}>
            <View style={[styles.lessonIndex, completed && styles.lessonIndexDone]}><Text style={styles.lessonIndexText}>{completed ? "✓" : index + 1}</Text></View>
            <View style={styles.lessonBody}>
              <Text style={styles.lessonTitle}>{mobileText(lesson.title, locale)}</Text>
              <Text style={styles.lessonMeta}>{completed ? copy(locale, "已完成", "Completed") : active ? copy(locale, "继续学习", "Continue") : unlocked ? copy(locale, "可开始", "Ready") : copy(locale, "完成上一课后解锁", "Complete previous lesson")}</Text>
            </View>
            <Button label={active ? copy(locale, "继续", "Continue") : completed ? copy(locale, "重学", "Repeat") : copy(locale, "开始", "Start")} onPress={() => onLesson(lesson.id)} disabled={!unlocked} />
          </View>
        );
      })}
    </ScrollView>
  );
}

function PlanSetup({
  locale,
  course,
  record,
  plan,
  onBack,
  onSave,
}: {
  locale: MobileLocale;
  course: CoursePack;
  record: CourseLearningRecord | undefined;
  plan: LearningPlan | undefined;
  onBack: () => void;
  onSave: (command: CreateLearningPlanCommand) => Promise<void>;
}) {
  const [motivation, setMotivation] = useState<LearningMotivation>(plan?.motivation ?? "daily-life");
  const [minutesPerDay, setMinutesPerDay] = useState(plan?.minutesPerDay ?? 20);
  const [daysPerWeek, setDaysPerWeek] = useState(plan?.daysPerWeek ?? 5);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const startLesson = course.lessons[nextLessonIndex(course, record)] ?? course.lessons[0];
  const motivations: { value: LearningMotivation; zh: string; en: string }[] = [
    { value: "travel", zh: "旅行交流", en: "Travel" },
    { value: "daily-life", zh: "日常生活", en: "Daily life" },
    { value: "work-study", zh: "工作学习", en: "Work & study" },
    { value: "culture-media", zh: "文化内容", en: "Culture & media" },
  ];
  const Choice = ({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} hitSlop={6} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Button label={copy(locale, "返回课程", "Back to course")} onPress={onBack} tone="secondary" />
      <AppHeader locale={locale} title={copy(locale, "设置学习计划", "Set learning plan")} subtitle={mobileText(course.manifest.title, locale)} />
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>{copy(locale, "你为什么学习？", "Why are you learning?")}</Text>
        <View style={styles.choiceGrid}>{motivations.map((item) => <Choice key={item.value} selected={motivation === item.value} label={copy(locale, item.zh, item.en)} onPress={() => setMotivation(item.value)} />)}</View>
      </View>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>{copy(locale, "每天投入多久？", "How long each day?")}</Text>
        <View style={styles.choiceGrid}>{[10, 20, 30, 45].map((value) => <Choice key={value} selected={minutesPerDay === value} label={copy(locale, `${value} 分钟`, `${value} min`)} onPress={() => setMinutesPerDay(value)} />)}</View>
      </View>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>{copy(locale, "每周学习几天？", "How many days per week?")}</Text>
        <View style={styles.choiceGrid}>{[3, 5, 7].map((value) => <Choice key={value} selected={daysPerWeek === value} label={copy(locale, `${value} 天`, `${value} days`)} onPress={() => setDaysPerWeek(value)} />)}</View>
      </View>
      <View style={styles.agendaCard}>
        <Text style={styles.agendaTitle}>{copy(locale, `每周 ${minutesPerDay * daysPerWeek} 分钟`, `${minutesPerDay * daysPerWeek} minutes per week`)}</Text>
        <Text style={styles.agendaMeta}>{copy(locale, `从「${startLesson ? mobileText(startLesson.title, locale) : "—"}」开始。当前移动端不做分级测试，不会自动跳过基础内容。`, `Start with “${startLesson ? mobileText(startLesson.title, locale) : "—"}”. Mobile does not run placement yet and will not skip fundamentals automatically.`)}</Text>
      </View>
      {notice ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
      <Button disabled={saving || !startLesson} label={saving ? copy(locale, "正在保存…", "Saving…") : copy(locale, plan ? "保存调整" : "创建计划", plan ? "Save changes" : "Create plan")} onPress={() => { if (!startLesson) return; setSaving(true); setNotice(""); void onSave({ motivation, minutesPerDay, daysPerWeek, placementMode: "skipped", startingLessonId: startLesson.id, occurredAt: new Date().toISOString() }).catch((error) => setNotice(copy(locale, "计划保存失败，请重试。", "Could not save plan. Try again.") + (error instanceof Error ? `\n${error.message}` : ""))).finally(() => setSaving(false)); }} />
    </ScrollView>
  );
}

function ResponseEditor({
  locale,
  exercise,
  response,
  onChange,
}: {
  locale: MobileLocale;
  exercise: Exercise;
  response: ExerciseResponse;
  onChange: (response: ExerciseResponse) => void;
}) {
  if (response.kind === "selection") {
    return (
      <View style={styles.optionList}>
        {(exercise.options ?? []).map((option, index) => {
          const selected = response.selected.includes(index);
          return (
            <Pressable key={index} onPress={() => onChange({ kind: "selection", selected: exercise.kind === "single-choice" ? [index] : selected ? response.selected.filter((value) => value !== index) : [...response.selected, index] })} style={[styles.option, selected && styles.optionSelected]}>
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{mobileText(option, locale)}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  if (response.kind === "ordering") {
    return (
      <View style={styles.optionList}>
        {response.order.map((optionIndex, position) => (
          <View key={`${optionIndex}-${position}`} style={styles.orderRow}>
            <Text style={styles.orderNumber}>{position + 1}</Text>
            <Text style={styles.orderText}>{mobileText(exercise.options?.[optionIndex], locale)}</Text>
            <Pressable accessibilityLabel={copy(locale, "上移", "Move up")} accessibilityRole="button" accessibilityState={{ disabled: position === 0 }} hitSlop={6} disabled={position === 0} onPress={() => { const order = [...response.order]; [order[position - 1], order[position]] = [order[position]!, order[position - 1]!]; onChange({ kind: "ordering", order }); }} style={styles.orderControl}><Text>↑</Text></Pressable>
            <Pressable accessibilityLabel={copy(locale, "下移", "Move down")} accessibilityRole="button" accessibilityState={{ disabled: position === response.order.length - 1 }} hitSlop={6} disabled={position === response.order.length - 1} onPress={() => { const order = [...response.order]; [order[position + 1], order[position]] = [order[position]!, order[position + 1]!]; onChange({ kind: "ordering", order }); }} style={styles.orderControl}><Text>↓</Text></Pressable>
          </View>
        ))}
      </View>
    );
  }
  return (
    <TextInput
      accessibilityLabel={copy(locale, "输入答案", "Enter answer")}
      returnKeyType="done"
      blurOnSubmit
      multiline
      onChangeText={(value) => onChange({ kind: "text", value })}
      placeholder={copy(locale, "在这里输入…", "Type here…")}
      placeholderTextColor="#8a8794"
      style={styles.textInput}
      value={response.value}
    />
  );
}

function LessonPlayer({
  locale,
  course,
  progress,
  onSave,
  onClose,
}: {
  locale: MobileLocale;
  course: CoursePack;
  progress: LearningProgress;
  onSave: (progress: LearningProgress) => Promise<void>;
  onClose: () => void;
}) {
  const lesson = course.lessons.find((item) => item.id === progress.lessonId);
  const step = lesson?.steps.find((item) => item.id === progress.currentStepId);
  const exercise = course.exercises.find((item) => step?.exerciseRefs.includes(item.id));
  const [response, setResponse] = useState<ExerciseResponse | undefined>(() => exercise ? createExerciseResponse(exercise) : undefined);
  const [notice, setNotice] = useState("");
  const [guidance, setGuidance] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setResponse(exercise ? createExerciseResponse(exercise) : undefined);
    setNotice("");
    setGuidance(false);
  }, [exercise?.id, step?.id]);

  if (!lesson) return null;
  if (progress.status === "completed" || !step) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.completionCard}>
          <Text style={styles.completionMark}>✓</Text>
          <Text style={styles.completionTitle}>{copy(locale, "课节完成", "Lesson complete")}</Text>
          <Text style={styles.completionText}>{mobileText(lesson.title, locale)}</Text>
          <Button label={copy(locale, "返回课程", "Back to course")} onPress={onClose} />
        </View>
      </ScrollView>
    );
  }

  const knowledge = course.knowledge.filter((item) => step.knowledgeRefs.includes(item.id));
  const utterances = course.utterances.filter((item) => step.utteranceRefs.includes(item.id));
  const stepNumber = lesson.steps.findIndex((item) => item.id === step.id) + 1;

  const submit = async () => {
    if (busy) return;
    let decision: "advance" | "retry" = "advance";
    let score: 0 | 1 | undefined;
    let evaluationSource: "deterministic" | "self" = "deterministic";
    let evidenceEligible = true;
    let answer: string | undefined;
    if (exercise && response) {
      const evaluation = evaluateExerciseResponse(exercise, response);
      if (evaluation.status === "empty") {
        setNotice(copy(locale, "请先完成回答", "Complete your answer first"));
        return;
      }
      decision = evaluation.status === "retry" ? "retry" : "advance";
      score = evaluation.score;
      answer = serializeExerciseResponse(response);
      if (evaluation.status === "manual") {
        evaluationSource = "self";
        evidenceEligible = false;
      }
    }
    setBusy(true);
    try {
      const next = submitLearningStep(course, progress, {
        decision,
        ...(answer === undefined ? {} : { answer }),
        ...(score === undefined ? {} : { score }),
        evaluationSource,
        evidenceEligible,
        usedSupport: guidance,
        now: new Date().toISOString(),
      });
      await onSave(next);
      setNotice(decision === "retry" ? copy(locale, "再试一次，答案尚未匹配", "Try again; answer does not match yet") : "");
    } catch (error) {
      setNotice(copy(locale, "学习进度保存失败，请重试。本步尚未前进。", "Could not save progress. Try again; this step did not advance.") + (error instanceof Error ? `\n${error.message}` : ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
      <View style={styles.playerTop}>
        <Button label={copy(locale, "退出课节", "Exit lesson")} onPress={onClose} tone="secondary" />
        <Text style={styles.playerCounter}>{stepNumber}/{lesson.steps.length}</Text>
      </View>
      <View style={styles.playerProgress}><View style={[styles.playerProgressFill, { width: `${Math.max(4, Math.round(((stepNumber - 1) / lesson.steps.length) * 100))}%` }]} /></View>
      <Text style={styles.playerLesson}>{mobileText(lesson.title, locale)}</Text>
      <Text style={styles.playerTitle}>{mobileText(step.title, locale)}</Text>
      {knowledge.length > 0 ? (
        <View style={styles.contentCard}>
          <Text style={styles.cardLabel}>{copy(locale, "本步知识", "IN THIS STEP")}</Text>
          {knowledge.map((item) => <View key={item.id} style={styles.knowledgeRow}><Text style={styles.knowledgeForm}>{item.form}</Text><Text style={styles.knowledgeMeaning}>{mobileText(item.meaning, locale)}</Text></View>)}
        </View>
      ) : null}
      {utterances.map((item) => (
        <View key={item.id} style={styles.utteranceCard}>
          <Text style={styles.utteranceText}>{item.text}</Text>
          {item.reading ? <Text style={styles.utteranceReading}>{Object.values(item.reading)[0]}</Text> : null}
          <Text style={styles.utteranceTranslation}>{mobileText(item.translation, locale)}</Text>
        </View>
      ))}
      {exercise ? (
        <View style={styles.exerciseCard}>
          <Text style={styles.cardLabel}>{copy(locale, "练习", "PRACTICE")}</Text>
          <Text style={styles.exercisePrompt}>{mobileText(exercise.prompt, locale)}</Text>
          {guidance && exercise.guidance ? <Text style={styles.guidance}>{mobileText(exercise.guidance, locale)}</Text> : null}
          {response ? <ResponseEditor locale={locale} exercise={exercise} response={response} onChange={setResponse} /> : null}
          {exercise.guidance ? <Button label={guidance ? copy(locale, "隐藏提示", "Hide hint") : copy(locale, "查看提示", "Show hint")} onPress={() => setGuidance((value) => !value)} tone="secondary" /> : null}
        </View>
      ) : null}
      {notice ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
      <Button label={busy ? copy(locale, "保存中…", "Saving…") : exercise ? copy(locale, "提交并继续", "Submit and continue") : copy(locale, "继续", "Continue")} onPress={() => void submit()} disabled={busy} />
    </ScrollView>
  );
}

function Reviews({
  locale,
  records,
  courses,
  onUpdate,
}: {
  locale: MobileLocale;
  records: Record<string, CourseLearningRecord>;
  courses: readonly CoursePack[];
  onUpdate: (record: CourseLearningRecord) => Promise<void>;
}) {
  const [notice, setNotice] = useState("");
  const items = mobileReviewItems(courses, records);
  const finishReview = async (record: CourseLearningRecord, taskId: string, result: "retry" | "remembered") => {
    setNotice("");
    try { await onUpdate(completeReviewTask(record, taskId, result, new Date().toISOString())); }
    catch (error) { setNotice(copy(locale, "复习结果保存失败，请重试。", "Could not save review result. Try again.") + (error instanceof Error ? `\n${error.message}` : "")); }
  };
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <AppHeader locale={locale} title={copy(locale, "到期复习", "Due reviews")} subtitle={copy(locale, "复习由已有学习证据生成，不依赖签到或积分", "Reviews come from learning evidence, not streaks or points")} />
      {items.length === 0 ? (
        <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{copy(locale, "当前没有到期复习", "Nothing due now")}</Text><Text style={styles.emptyText}>{copy(locale, "完成更多课节后，复习会按掌握情况出现。", "Reviews appear as you complete lessons.")}</Text></View>
      ) : items.map(({ course, record, task, knowledge }) => (
        <View key={task.id} style={styles.reviewCard}>
          <Text style={styles.cardLabel}>{mobileText(course.manifest.title, locale)} · {task.mode}</Text>
          <Text style={styles.reviewForm}>{knowledge?.form ?? task.knowledgeItemId}</Text>
          <Text style={styles.reviewMeaning}>{mobileText(knowledge?.meaning, locale)}</Text>
          <View style={styles.actionRow}>
            <Button label={copy(locale, "需要再练", "Retry later")} tone="secondary" onPress={() => void finishReview(record, task.id, "retry")} />
            <Button label={copy(locale, "记得", "Remembered")} onPress={() => void finishReview(record, task.id, "remembered")} />
          </View>
        </View>
      ))}
      {notice ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
    </ScrollView>
  );
}

function Settings({
  locale,
  records,
  plans,
  courses,
  languagePacks,
  customCourses,
  customLanguagePacks,
  onLocale,
  onShowOnboarding,
  onReload,
  profileRepository,
  planRepository,
  courseRepository,
  languagePackRepository,
}: {
  locale: MobileLocale;
  records: Record<string, CourseLearningRecord>;
  plans: Record<string, LearningPlan>;
  courses: readonly CoursePack[];
  languagePacks: readonly LanguageDefinition[];
  customCourses: readonly CoursePack[];
  customLanguagePacks: readonly LanguageDefinition[];
  onLocale: (locale: MobileLocale) => Promise<void>;
  onShowOnboarding: () => void;
  onReload: () => Promise<void>;
  profileRepository: SQLiteLearningProfileRepository;
  planRepository: SQLiteLearningPlanRepository;
  courseRepository: SQLiteInstalledCourseRepository;
  languagePackRepository: SQLiteLanguagePackRepository;
}) {
  const [notice, setNotice] = useState("");
  const run = async (work: () => Promise<void>) => {
    setNotice("");
    try { await work(); }
    catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
  };
  const confirmCourseTrust = (course: CoursePack) => new Promise<boolean>((resolve) => Alert.alert(
    copy(locale, "确认安装本地课程", "Confirm local course install"),
    copy(
      locale,
      `作者：${course.manifest.author.displayName}\n许可证：${course.manifest.license?.id ?? "—"}\n来源：${course.manifest.source.title ?? course.manifest.source.url ?? course.manifest.source.kind}`,
      `Author: ${course.manifest.author.displayName}\nLicense: ${course.manifest.license?.id ?? "—"}\nSource: ${course.manifest.source.title ?? course.manifest.source.url ?? course.manifest.source.kind}`,
    ),
    [
      { text: copy(locale, "取消", "Cancel"), style: "cancel", onPress: () => resolve(false) },
      { text: copy(locale, "安装", "Install"), onPress: () => resolve(true) },
    ],
    { cancelable: true, onDismiss: () => resolve(false) },
  ));

  const confirmLanguagePackReplacement = (affectedCourseCount: number) => new Promise<boolean>((resolve) => Alert.alert(
    copy(locale, "替换语言定义？", "Replace Language Pack?"),
    copy(locale, `同 ID 定义已存在。替换会影响 ${affectedCourseCount} 门已安装课程。`, `A pack with this ID exists. Replacing it affects ${affectedCourseCount} installed course(s).`),
    [
      { text: copy(locale, "取消", "Cancel"), style: "cancel", onPress: () => resolve(false) },
      { text: copy(locale, "替换", "Replace"), onPress: () => resolve(true) },
    ],
    { cancelable: true, onDismiss: () => resolve(false) },
  ));

  const importLanguagePack = () => void run(async () => {
    const selected = await chooseLanguagePackFile(locale);
    if (!selected) return;
    const affectedCourses = customCourses.filter((course) => course.manifest.languageId === selected.pack.id);
    if (affectedCourses.some((course) => assessCourseLanguageCompatibility(course, selected.pack).status === "blocked")) {
      throw new Error(copy(locale, "这个 Language Pack 与已安装课程不兼容，未覆盖原版本", "This Language Pack is incompatible with an installed course; the existing version was kept"));
    }
    const existing = await languagePackRepository.get(selected.pack.id);
    if (existing && !(await confirmLanguagePackReplacement(affectedCourses.length))) return;
    const service = new LanguagePackApplicationService(languagePackRepository, builtInLanguageIds);
    await service.import(selected.pack, Boolean(existing));
    await onReload();
    setNotice(copy(locale, `已导入语言定义 ${selected.pack.id}`, `Imported Language Pack ${selected.pack.id}`));
  });

  const importCourse = () => void run(async () => {
    const selected = await chooseCoursePackFile(locale);
    if (!selected) return;
    if (bundledCourseIds.has(selected.course.manifest.id)) {
      throw new Error(copy(locale, "导入课程不能覆盖应用内置课程", "Imported courses cannot replace bundled courses"));
    }
    const trust = assessCourseTrust(selected.course);
    if (!trust.canInstall) throw new Error(copy(locale, "课程来源或发布信息未通过安装门禁", "The course source or publication metadata did not pass the install gate"));
    if (trust.requiresConfirmation && !(await confirmCourseTrust(selected.course))) return;
    const language = languagePacks.find((pack) => pack.id === selected.course.manifest.languageId);
    const runtime = assessCourseLanguageCompatibility(selected.course, language);
    if (runtime.status === "blocked") {
      throw new Error(copy(locale, "缺少兼容的 Language Pack 或语言适配器；请先导入语言定义", "A compatible Language Pack or adapter is missing; import the language definition first"));
    }
    const existing = await courseRepository.get(selected.course.manifest.id);
    if (existing) {
      const update = assessCourseUpdate(existing, selected.course, records[selected.course.manifest.id]);
      if (!update.newer) throw new Error(copy(locale, "只能用更高版本更新已导入课程", "An installed course can only be updated with a newer version"));
      if (!update.compatible) throw new Error(copy(locale, "新版本会破坏已有学习进度，已保留原课程", "The new version would break existing progress; the installed course was kept"));
    }
    const service = new CourseLibraryApplicationService(courseRepository, { assess: (course) => assessCourseLanguageCompatibility(course, languagePacks.find((pack) => pack.id === course.manifest.languageId)) });
    await service.install(selected.course);
    const currentRecord = records[selected.course.manifest.id];
    if (existing && currentRecord) await profileRepository.putMany([upgradeCourseLearningRecord(currentRecord, selected.course)]);
    await onReload();
    const suffix = runtime.status === "degraded" ? copy(locale, "（部分练习将使用降级方式）", " (some exercises use fallbacks)") : "";
    setNotice(copy(locale, `已导入课程「${mobileText(selected.course.manifest.title, locale)}」`, `Imported “${mobileText(selected.course.manifest.title, locale)}”`) + suffix);
  });

  const removeCourse = (course: CoursePack) => Alert.alert(
    copy(locale, "移除导入课程？", "Remove imported course?"),
    copy(locale, "课程文件将从本机移除；学习进度会保留，重新导入兼容版本后可继续。", "The course file will be removed. Progress stays on the device and can resume after a compatible re-import."),
    [
      { text: copy(locale, "取消", "Cancel"), style: "cancel" },
      { text: copy(locale, "移除", "Remove"), style: "destructive", onPress: () => void run(async () => { await courseRepository.remove(course.manifest.id); await onReload(); setNotice(copy(locale, "课程已移除，学习进度已保留", "Course removed; progress retained")); }) },
    ],
  );

  const removeLanguagePack = (pack: LanguageDefinition) => Alert.alert(
    copy(locale, "移除语言定义？", "Remove Language Pack?"),
    copy(locale, `将从本机移除 ${pack.id}；仍被课程使用时操作会被阻止。`, `Remove ${pack.id} from this device. The action is blocked while a course still uses it.`),
    [
      { text: copy(locale, "取消", "Cancel"), style: "cancel" },
      { text: copy(locale, "移除", "Remove"), style: "destructive", onPress: () => void run(async () => {
        const usage = languagePackReferenceUsage(pack.id, undefined, [], customCourses.map((course) => course.manifest.languageId));
        if (!usage.canDelete) throw new Error(copy(locale, "该语言定义仍被已安装课程使用，请先移除课程", "This Language Pack is still used by an installed course; remove the course first"));
        const service = new LanguagePackApplicationService(languagePackRepository, builtInLanguageIds);
        await service.remove(pack.id, usage);
        await onReload();
        setNotice(copy(locale, `已移除语言定义 ${pack.id}`, `Removed Language Pack ${pack.id}`));
      }) },
    ],
  );

  const reset = () => Alert.alert(
    copy(locale, "删除本机学习数据？", "Delete local learning data?"),
    copy(locale, "课程进度、复习与个人计划将从本机永久删除。建议先导出备份。", "Progress, reviews, and personal plans will be permanently deleted from this device. Export a backup first."),
    [
      { text: copy(locale, "取消", "Cancel"), style: "cancel" },
      { text: copy(locale, "删除", "Delete"), style: "destructive", onPress: () => void run(async () => { await Promise.all([profileRepository.clear(), planRepository.clear()]); await onReload(); setNotice(copy(locale, "本机学习数据已删除", "Local learning data deleted")); }) },
    ],
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <AppHeader locale={locale} title={copy(locale, "设置与数据", "Settings and data")} subtitle={copy(locale, "不登录也能完整使用核心学习功能", "Core learning works without an account")} />
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>{copy(locale, "界面与讲解语言", "Interface and teaching language")}</Text>
        <View style={styles.actionRow}>
          <Button label="中文" onPress={() => void run(async () => { await onLocale("zh-CN"); setNotice(copy(locale, "界面语言已更新", "Interface language updated")); })} tone={locale === "zh-CN" ? "primary" : "secondary"} />
          <Button label="English" onPress={() => void run(async () => { await onLocale("en"); setNotice(copy(locale, "界面语言已更新", "Interface language updated")); })} tone={locale === "en" ? "primary" : "secondary"} />
        </View>
        <Button label={copy(locale, "重新查看使用引导", "View getting-started guide")} onPress={onShowOnboarding} tone="secondary" />
      </View>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>{copy(locale, "导入课程与语言", "Import courses and languages")}</Text>
        <Text style={styles.settingsText}>{copy(locale, "从 Web Studio 导出的已发布 Course Pack 可直接导入。新语种课程请先导入对应 Language Pack。导入后可完全离线学习。", "Import published Course Packs exported by Web Studio. For a new language, import its Language Pack first. Imported content works fully offline.")}</Text>
        <View style={styles.stackActions}>
          <Button label={copy(locale, "导入 Language Pack", "Import Language Pack")} onPress={importLanguagePack} tone="secondary" />
          <Button label={copy(locale, "导入 Course Pack", "Import Course Pack")} onPress={importCourse} />
        </View>
        {customLanguagePacks.map((pack) => (
          <View key={pack.id} style={styles.installedRow}>
            <View style={styles.installedCopy}><Text style={styles.installedName}>{mobileText(pack.name, locale)}</Text><Text style={styles.installedMeta}>Language Pack · {pack.id}</Text></View>
            <Button label={copy(locale, "移除", "Remove")} onPress={() => removeLanguagePack(pack)} tone="danger" />
          </View>
        ))}
        {customCourses.map((course) => (
          <View key={course.manifest.id} style={styles.installedRow}>
            <View style={styles.installedCopy}><Text style={styles.installedName}>{mobileText(course.manifest.title, locale)}</Text><Text style={styles.installedMeta}>Course Pack · v{course.manifest.version}</Text></View>
            <Button label={copy(locale, "移除", "Remove")} onPress={() => removeCourse(course)} tone="danger" />
          </View>
        ))}
      </View>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>{copy(locale, "本地备份", "Local backup")}</Text>
        <Text style={styles.settingsText}>{copy(locale, "导出和恢复学习进度、复习与个人计划。较旧数据不会覆盖较新本机数据。", "Export and restore progress, reviews, and personal plans. Older data never overwrites newer local data.")}</Text>
        <View style={styles.stackActions}>
          <Button label={copy(locale, "导出学习备份", "Export learning backup")} onPress={() => void run(async () => { await exportMobileBackup(Object.values(records), Object.values(plans)); setNotice(copy(locale, "已交给系统分享", "Backup opened in system share")); })} tone="secondary" />
          <Button label={copy(locale, "选择备份恢复", "Choose backup to restore")} onPress={() => void run(async () => { const result = await importMobileBackup(profileRepository, planRepository); if (result) { await onReload(); const added = result.records.added + result.plans.added; const replaced = result.records.replaced + result.plans.replaced; const skipped = result.records.skipped + result.plans.skipped; setNotice(copy(locale, `恢复完成：新增 ${added}，更新 ${replaced}，跳过 ${skipped}`, `Restore complete: ${added} added, ${replaced} updated, ${skipped} skipped`)); } })} tone="secondary" />
        </View>
      </View>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>{copy(locale, "本地存储", "Local storage")}</Text>
        <Text style={styles.settingsText}>{copy(locale, `SQLite 保存 ${courses.length} 门可用课程的学习进度。AI 密钥、登录凭据和临时请求不会进入备份。`, `SQLite stores progress for ${courses.length} available courses. AI keys, sign-in credentials, and temporary requests are excluded from backup.`)}</Text>
        <Button label={copy(locale, "删除本机学习数据", "Delete local learning data")} onPress={reset} tone="danger" />
      </View>
      {notice ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
    </ScrollView>
  );
}

function MobileApp() {
  const db = useSQLiteContext();
  const profileRepository = useMemo(() => new SQLiteLearningProfileRepository(db), [db]);
  const planRepository = useMemo(() => new SQLiteLearningPlanRepository(db), [db]);
  const planService = useMemo(() => new LearningPlanApplicationService(planRepository), [planRepository]);
  const courseRepository = useMemo(() => new SQLiteInstalledCourseRepository(db), [db]);
  const languagePackRepository = useMemo(() => new SQLiteLanguagePackRepository(db), [db]);
  const preferences = useMemo(() => new SQLitePreferenceRepository(db), [db]);
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [locale, setLocale] = useState<MobileLocale>("zh-CN");
  const [records, setRecords] = useState<Record<string, CourseLearningRecord>>({});
  const [plans, setPlans] = useState<Record<string, LearningPlan>>({});
  const [installedCourses, setInstalledCourses] = useState<readonly CoursePack[]>([]);
  const [customLanguagePacks, setCustomLanguagePacks] = useState<readonly LanguageDefinition[]>([]);
  const [progress, setProgress] = useState<LearningProgress>();
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState("");
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [, setForegroundRevision] = useState(0);
  const courses = useMemo(() => mergeMobileCourses(bundledCourses, installedCourses), [installedCourses]);
  const languagePacks = useMemo(() => mergeMobileLanguagePacks(builtInLanguagePacks, customLanguagePacks), [customLanguagePacks]);

  const reload = useCallback(async () => {
    const [loadedRecords, loadedPlans, loadedCourses, loadedPacks] = await Promise.all([
      profileRepository.list(),
      planService.list(),
      courseRepository.list(),
      languagePackRepository.list(),
    ]);
    setRecords(Object.fromEntries(loadedRecords.map((record) => [record.courseId, record])));
    setPlans(Object.fromEntries(loadedPlans.map((plan) => [plan.courseId, plan])));
    setInstalledCourses(loadedCourses);
    setCustomLanguagePacks(loadedPacks);
  }, [courseRepository, languagePackRepository, planService, profileRepository]);

  const initialize = useCallback(async () => {
    setReady(false);
    setStartupError("");
    try {
      const [loadedRecords, loadedPlans, loadedCourses, loadedPacks, storedLocale, completed] = await Promise.all([
        profileRepository.list(),
        planService.list(),
        courseRepository.list(),
        languagePackRepository.list(),
        preferences.locale(),
        preferences.onboardingComplete(),
      ]);
      setRecords(Object.fromEntries(loadedRecords.map((record) => [record.courseId, record])));
      setPlans(Object.fromEntries(loadedPlans.map((plan) => [plan.courseId, plan])));
      setInstalledCourses(loadedCourses);
      setCustomLanguagePacks(loadedPacks);
      setLocale(storedLocale);
      setOnboardingComplete(completed);
    } catch (error) {
      setStartupError(error instanceof Error ? error.message : String(error));
    } finally {
      setReady(true);
    }
  }, [courseRepository, languagePackRepository, planService, preferences, profileRepository]);

  useEffect(() => { void initialize(); }, [initialize]);

  const saveRecord = async (record: CourseLearningRecord) => {
    await profileRepository.putMany([record]);
    setRecords((current) => ({ ...current, [record.courseId]: record }));
  };

  const openLesson = async (course: CoursePack, lessonId: string) => {
    try {
      const record = records[course.manifest.id] ?? createCourseLearningRecord(course, new Date().toISOString());
      const existing = record.lessonProgress[lessonId];
      const lessonProgress = existing?.status === "active" ? existing : startLearning(course, lessonId, new Date().toISOString());
      const nextRecord = updateCourseLearningRecord(record, lessonProgress);
      await saveRecord(nextRecord);
      setProgress(lessonProgress);
      setScreen({ kind: "lesson", courseId: course.manifest.id, lessonId });
    } catch (error) {
      Alert.alert(copy(locale, "无法开始课节", "Could not start lesson"), copy(locale, "本地进度未改变，请重试。", "Local progress was not changed. Try again.") + (error instanceof Error ? `\n\n${error.message}` : ""));
    }
  };
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setForegroundRevision((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!ready || startupError || !onboardingComplete) return;
    const label = screen.kind === "home"
      ? copy(locale, "学习首页", "Learning home")
      : screen.kind === "reviews"
        ? copy(locale, "复习", "Reviews")
        : screen.kind === "settings"
          ? copy(locale, "设置与数据", "Settings and data")
          : screen.kind === "plan"
            ? copy(locale, "设置学习计划", "Set learning plan")
            : screen.kind === "lesson"
              ? copy(locale, "课节学习", "Lesson")
              : copy(locale, "课程详情", "Course details");
    AccessibilityInfo.announceForAccessibility(label);
  }, [locale, onboardingComplete, ready, screen, startupError]);
  useEffect(() => {
    if (Platform.OS !== "android" || !ready || startupError || !onboardingComplete) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen.kind === "lesson" || screen.kind === "plan") {
        setScreen({ kind: "course", courseId: screen.courseId });
        return true;
      }
      if (screen.kind === "course" || screen.kind === "reviews" || screen.kind === "settings") {
        setScreen({ kind: "home" });
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [onboardingComplete, ready, screen, startupError]);
  if (!ready) return <View style={styles.loading}><ActivityIndicator accessibilityLabel={copy(locale, "正在加载", "Loading")} accessibilityRole="progressbar" color="#5a48d6" /><Text style={styles.loadingText}>{copy(locale, "正在打开本地学习档案…", "Opening local learning profile…")}</Text></View>;
  if (startupError) return <StartupFailure locale={locale} message={startupError} onRetry={() => void initialize()} />;
  if (!onboardingComplete) return <Onboarding locale={locale} onLocale={async (nextLocale) => { await preferences.setLocale(nextLocale); setLocale(nextLocale); }} onComplete={async () => { await preferences.setOnboardingComplete(); setOnboardingComplete(true); }} />;

  const activeCourse = screen.kind === "course" || screen.kind === "plan" || screen.kind === "lesson" ? courses.find((course) => course.manifest.id === screen.courseId) : undefined;
  const activeTab = screen.kind === "reviews" ? "reviews" : screen.kind === "settings" ? "settings" : "learn";

  let content;
  if (screen.kind === "lesson" && activeCourse && progress) {
    content = <LessonPlayer locale={locale} course={activeCourse} progress={progress} onClose={() => setScreen({ kind: "course", courseId: activeCourse.manifest.id })} onSave={async (next) => { const record = records[activeCourse.manifest.id] ?? createCourseLearningRecord(activeCourse, next.updatedAt); const nextRecord = updateCourseLearningRecord(record, next); await saveRecord(nextRecord); setProgress(next); }} />;
  } else if (screen.kind === "course" && activeCourse) {
    content = <CourseDetail locale={locale} course={activeCourse} record={records[activeCourse.manifest.id]} plan={plans[activeCourse.manifest.id]} onBack={() => setScreen({ kind: "home" })} onPlan={() => setScreen({ kind: "plan", courseId: activeCourse.manifest.id })} onReviews={() => setScreen({ kind: "reviews" })} onLesson={(lessonId) => void openLesson(activeCourse, lessonId)} />;
  } else if (screen.kind === "plan" && activeCourse) {
    content = <PlanSetup locale={locale} course={activeCourse} record={records[activeCourse.manifest.id]} plan={plans[activeCourse.manifest.id]} onBack={() => setScreen({ kind: "course", courseId: activeCourse.manifest.id })} onSave={async (command) => { const plan = await planService.create(activeCourse, command); setPlans((current) => ({ ...current, [plan.courseId]: plan })); setScreen({ kind: "course", courseId: activeCourse.manifest.id }); }} />;
  } else if (screen.kind === "reviews") {
    content = <Reviews locale={locale} records={records} courses={courses} onUpdate={saveRecord} />;
  } else if (screen.kind === "settings") {
    content = <Settings locale={locale} records={records} plans={plans} courses={courses} languagePacks={languagePacks} customCourses={installedCourses} customLanguagePacks={customLanguagePacks} profileRepository={profileRepository} planRepository={planRepository} courseRepository={courseRepository} languagePackRepository={languagePackRepository} onReload={reload} onShowOnboarding={() => setOnboardingComplete(false)} onLocale={async (nextLocale) => { await preferences.setLocale(nextLocale); setLocale(nextLocale); }} />;
  } else {
    content = <Home locale={locale} records={records} plans={plans} courses={courses} languagePacks={languagePacks} onCourse={(courseId) => setScreen({ kind: "course", courseId })} />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, Platform.OS === "android" && { paddingTop: StatusBar.currentHeight ?? 0 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f1ea" />
      <KeyboardAvoidingView style={styles.app} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
        {content}
      </KeyboardAvoidingView>
      {screen.kind !== "lesson" ? <BottomNav locale={locale} active={activeTab} onChange={(tab) => setScreen(tab === "learn" ? { kind: "home" } : tab === "reviews" ? { kind: "reviews" } : { kind: "settings" })} /> : null}
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SQLiteProvider databaseName="learnlanguage-mobile.db" onInit={migrateMobileDatabase}>
      <MobileApp />
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f1ea" },
  app: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#f4f1ea" },
  loadingText: { color: "#66616f", fontSize: 14 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 36, gap: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 6 },
  brandMark: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#26334d" },
  brandMarkText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  headerCopy: { flex: 1 },
  eyebrow: { color: "#5a48d6", fontSize: 10, fontWeight: "800", letterSpacing: 0.9 },
  headerTitle: { marginTop: 4, color: "#1f2533", fontSize: 28, lineHeight: 34, fontWeight: "800" },
  headerSubtitle: { marginTop: 5, color: "#686471", fontSize: 13, lineHeight: 19 },
  sectionHeading: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 6 },
  sectionTitle: { color: "#252938", fontSize: 19, fontWeight: "800" },
  sectionNote: { color: "#77727e", fontSize: 11 },
  courseCard: { flexDirection: "row", gap: 13, padding: 15, borderWidth: 1, borderColor: "#ded9e8", borderRadius: 18, backgroundColor: "#fff" },
  languageBadge: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  languageBadgeText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  courseBody: { flex: 1 },
  courseTitle: { color: "#222635", fontSize: 18, fontWeight: "800" },
  courseDescription: { marginTop: 4, color: "#6f6a76", fontSize: 12, lineHeight: 17 },
  nextLesson: { marginTop: 10, color: "#454052", fontSize: 12, fontWeight: "700" },
  progressTrack: { height: 6, marginTop: 10, overflow: "hidden", borderRadius: 99, backgroundColor: "#ebe8f1" },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: "#5a48d6" },
  progressText: { marginTop: 5, color: "#77727e", fontSize: 10 },
  privacyCard: { padding: 16, borderRadius: 16, backgroundColor: "#e9f1ec" },
  privacyTitle: { color: "#245e4c", fontSize: 15, fontWeight: "800" },
  privacyText: { marginTop: 5, color: "#4f6c62", fontSize: 12, lineHeight: 18 },
  agendaCard: { gap: 10, padding: 17, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d9d3e4" },
  agendaTitle: { color: "#252938", fontSize: 18, lineHeight: 24, fontWeight: "800" },
  agendaMeta: { color: "#6f6a76", fontSize: 12, lineHeight: 18 },
  choiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minWidth: "46%", flexGrow: 1, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: "#d4cedd", backgroundColor: "#faf9fb" },
  choiceSelected: { borderColor: "#5a48d6", backgroundColor: "#eeeafd" },
  choiceText: { textAlign: "center", color: "#4d4855", fontSize: 12, fontWeight: "700" },
  choiceTextSelected: { color: "#493bb2" },
  summaryCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 17, borderRadius: 18, backgroundColor: "#26334d" },
  summaryValue: { color: "#fff", fontSize: 30, fontWeight: "900" },
  summaryCopy: { flex: 1 },
  summaryTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  summaryText: { marginTop: 3, color: "#ced6e4", fontSize: 12 },
  lessonCard: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 11, padding: 13, borderWidth: 1, borderColor: "#dfdbe5", borderRadius: 16, backgroundColor: "#fff" },
  lockedCard: { opacity: 0.48 },
  lessonIndex: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#ece9f8" },
  lessonIndexDone: { backgroundColor: "#dcefe6" },
  lessonIndexText: { color: "#4b3ec0", fontSize: 13, fontWeight: "800" },
  lessonBody: { flex: 1 },
  lessonTitle: { color: "#282c39", fontSize: 14, fontWeight: "800" },
  lessonMeta: { marginTop: 3, color: "#77727e", fontSize: 10 },
  button: { minHeight: 44, paddingHorizontal: 15, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  buttonPrimary: { borderColor: "#5a48d6", backgroundColor: "#5a48d6" },
  buttonSecondary: { borderColor: "#c9c2df", backgroundColor: "#fff" },
  buttonDanger: { borderColor: "#e6bcb4", backgroundColor: "#fff5f3" },
  buttonPrimaryText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  buttonSecondaryText: { color: "#4f43ae", fontSize: 12, fontWeight: "800" },
  buttonDangerText: { color: "#a64336", fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  onboardingContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 28, gap: 14, backgroundColor: "#f4f1ea" },
  onboardingCard: { flexDirection: "row", alignItems: "flex-start", gap: 13, padding: 16, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ded9e8" },
  onboardingNumber: { width: 34, height: 34, textAlign: "center", lineHeight: 34, borderRadius: 12, overflow: "hidden", color: "#fff", backgroundColor: "#5a48d6", fontSize: 14, fontWeight: "900" },
  onboardingCopy: { flex: 1, gap: 4 },
  failureScreen: { flex: 1, justifyContent: "center", gap: 13, padding: 24, backgroundColor: "#f4f1ea" },
  failureTitle: { color: "#252938", fontSize: 24, lineHeight: 30, fontWeight: "800" },
  failureText: { color: "#6f6a76", fontSize: 13, lineHeight: 20 },
  failureDetail: { padding: 12, borderRadius: 12, color: "#8a4c2c", backgroundColor: "#fff0e5", fontSize: 11, lineHeight: 17 },
  bottomNav: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#ddd8e3", backgroundColor: "#fff", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  navItem: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  navItemActive: { backgroundColor: "#eeeafd" },
  navLabel: { color: "#797482", fontSize: 12, fontWeight: "700" },
  navLabelActive: { color: "#4e3fbd" },
  playerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  playerCounter: { color: "#686471", fontSize: 12, fontWeight: "700" },
  playerProgress: { height: 7, overflow: "hidden", borderRadius: 99, backgroundColor: "#e5e0eb" },
  playerProgressFill: { height: "100%", borderRadius: 99, backgroundColor: "#5a48d6" },
  playerLesson: { color: "#6d6875", fontSize: 12, fontWeight: "700" },
  playerTitle: { color: "#202432", fontSize: 27, lineHeight: 34, fontWeight: "800" },
  contentCard: { gap: 9, padding: 16, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0dce6" },
  cardLabel: { color: "#5a48d6", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  knowledgeRow: { paddingTop: 7, borderTopWidth: 1, borderTopColor: "#f0edf3" },
  knowledgeForm: { color: "#232735", fontSize: 21, fontWeight: "800" },
  knowledgeMeaning: { marginTop: 2, color: "#736e79", fontSize: 12 },
  utteranceCard: { padding: 17, borderRadius: 18, backgroundColor: "#26334d" },
  utteranceText: { color: "#fff", fontSize: 22, lineHeight: 30, fontWeight: "800" },
  utteranceReading: { marginTop: 5, color: "#cbd4e2", fontSize: 12 },
  utteranceTranslation: { marginTop: 7, color: "#e4e9f0", fontSize: 13 },
  exerciseCard: { gap: 12, padding: 16, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ded9e8" },
  exercisePrompt: { color: "#272b39", fontSize: 18, lineHeight: 25, fontWeight: "800" },
  guidance: { padding: 12, borderRadius: 12, color: "#4f5e57", backgroundColor: "#eaf2ed", fontSize: 12, lineHeight: 18 },
  optionList: { gap: 9 },
  option: { minHeight: 48, justifyContent: "center", padding: 13, borderWidth: 1, borderColor: "#d8d3df", borderRadius: 13, backgroundColor: "#faf9fb" },
  optionSelected: { borderColor: "#5a48d6", backgroundColor: "#eeeafd" },
  optionText: { color: "#363946", fontSize: 14, fontWeight: "600" },
  optionTextSelected: { color: "#493bb2" },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderWidth: 1, borderColor: "#ddd8e3", borderRadius: 12 },
  orderNumber: { width: 22, color: "#5a48d6", fontWeight: "900" },
  orderText: { flex: 1, color: "#303441", fontSize: 13 },
  orderControl: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#efecf5" },
  textInput: { minHeight: 100, padding: 13, borderWidth: 1, borderColor: "#d4cedd", borderRadius: 13, color: "#272b39", backgroundColor: "#faf9fb", textAlignVertical: "top" },
  notice: { padding: 12, borderRadius: 12, color: "#8a4c2c", backgroundColor: "#fff0e5", fontSize: 12, lineHeight: 18 },
  completionCard: { alignItems: "center", gap: 10, marginTop: 60, padding: 28, borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ded9e8" },
  completionMark: { width: 58, height: 58, textAlign: "center", lineHeight: 58, borderRadius: 29, overflow: "hidden", color: "#fff", backgroundColor: "#278d69", fontSize: 30, fontWeight: "900" },
  completionTitle: { color: "#202432", fontSize: 25, fontWeight: "800" },
  completionText: { marginBottom: 8, color: "#6c6773", fontSize: 14 },
  emptyCard: { padding: 22, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ded9e8" },
  emptyTitle: { color: "#272b39", fontSize: 18, fontWeight: "800" },
  emptyText: { marginTop: 6, color: "#716c78", fontSize: 13, lineHeight: 19 },
  reviewCard: { gap: 9, padding: 17, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ded9e8" },
  reviewForm: { color: "#222635", fontSize: 25, fontWeight: "800" },
  reviewMeaning: { color: "#716c78", fontSize: 13 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  stackActions: { gap: 9 },
  settingsCard: { gap: 11, padding: 17, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ded9e8" },
  settingsTitle: { color: "#272b39", fontSize: 17, fontWeight: "800" },
  settingsText: { color: "#716c78", fontSize: 12, lineHeight: 18 },
  installedRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#eeeaf1" },
  installedCopy: { flex: 1 },
  installedName: { color: "#282c39", fontSize: 13, fontWeight: "800" },
  installedMeta: { marginTop: 3, color: "#77727e", fontSize: 10 },
});
