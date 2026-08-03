export const LANGUAGE_PACK_SCHEMA_VERSION = 1 as const;
export const COURSE_PACK_SCHEMA_VERSION = 1 as const;

export type LocalizedText = Readonly<Record<string, string>>;

export interface ScriptDefinition {
  readonly code: string;
  readonly name: LocalizedText;
  readonly direction: "ltr" | "rtl" | "ttb";
  readonly primary: boolean;
}

export interface ReadingSystemDefinition {
  readonly id: string;
  readonly name: LocalizedText;
  readonly kind: "native" | "romanization" | "phonetic";
}

export interface PronunciationFeatureDefinition {
  readonly id: string;
  readonly name: LocalizedText;
  readonly category: "segment" | "tone" | "stress" | "rhythm" | "intonation";
  readonly contrastive: boolean;
}

export interface LanguageDefinition {
  readonly schemaVersion: typeof LANGUAGE_PACK_SCHEMA_VERSION;
  readonly id: string;
  readonly name: LocalizedText;
  readonly scripts: readonly ScriptDefinition[];
  readonly readingSystems: readonly ReadingSystemDefinition[];
  readonly pronunciationFeatures: readonly PronunciationFeatureDefinition[];
  readonly segmentation: {
    readonly strategy: "whitespace" | "character" | "script-run" | "adapter";
  };
  readonly speech: {
    readonly recognitionLocales: readonly string[];
    readonly synthesisLocales: readonly string[];
  };
}

export interface LanguageAdapter {
  readonly definition: LanguageDefinition;
  normalize(input: string): string;
  segment(input: string): readonly string[];
}

export type ContentVisibility = "official" | "community" | "private";
export type ContentStatus = "draft" | "review" | "published" | "archived";

export interface ContentSource {
  readonly kind: "original" | "imported" | "ai-assisted";
  readonly title?: string;
  readonly url?: string;
  readonly license?: string;
}

export interface CourseManifest {
  readonly id: string;
  readonly version: string;
  readonly languageId: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly author: {
    readonly id: string;
    readonly displayName: string;
  };
  readonly visibility: ContentVisibility;
  readonly status: ContentStatus;
  readonly source: ContentSource;
}

export interface CanDoGoal {
  readonly id: string;
  readonly description: LocalizedText;
  readonly framework?: {
    readonly name: string;
    readonly level?: string;
    readonly reference?: string;
  };
}

export type KnowledgeKind =
  | "lexeme"
  | "grammar"
  | "pronunciation"
  | "script"
  | "pragmatics";

export interface KnowledgeItem {
  readonly id: string;
  readonly kind: KnowledgeKind;
  readonly form: string;
  readonly reading?: Readonly<Record<string, string>>;
  readonly meaning: LocalizedText;
  readonly usage?: LocalizedText;
  readonly tags?: readonly string[];
}

export interface Utterance {
  readonly id: string;
  readonly text: string;
  readonly translation?: LocalizedText;
  readonly reading?: Readonly<Record<string, string>>;
  readonly knowledgeRefs: readonly string[];
  readonly audio?: {
    readonly assetId: string;
    readonly speaker?: string;
    readonly speed?: "slow" | "natural";
  };
}

export type ExerciseKind =
  | "single-choice"
  | "ordering"
  | "dictation"
  | "repeat"
  | "substitution"
  | "reconstruction"
  | "role-play";

export interface Exercise {
  readonly id: string;
  readonly kind: ExerciseKind;
  readonly prompt: LocalizedText;
  readonly knowledgeRefs: readonly string[];
  readonly utteranceRefs: readonly string[];
  readonly rubricRef?: string;
}

export interface FeedbackRubric {
  readonly id: string;
  readonly dimensions: readonly (
    | "task-completion"
    | "comprehensibility"
    | "target-language"
    | "prompt-dependence"
    | "fluency"
  )[];
  readonly retryRequired: boolean;
}

export type LessonPhase =
  | "diagnostic"
  | "preteach"
  | "supported-input"
  | "comprehension"
  | "noticing"
  | "guided-output"
  | "independent-task"
  | "feedback-retry"
  | "delayed-transfer";

export interface LessonStep {
  readonly id: string;
  readonly phase: LessonPhase;
  readonly title: LocalizedText;
  readonly supportLevel?: "full" | "target-language-only" | "none";
  readonly knowledgeRefs: readonly string[];
  readonly utteranceRefs: readonly string[];
  readonly exerciseRefs: readonly string[];
  readonly next: readonly string[];
}

export interface LessonFlow {
  readonly id: string;
  readonly title: LocalizedText;
  readonly canDoGoalRefs: readonly string[];
  readonly entryStepId: string;
  readonly steps: readonly LessonStep[];
}

export interface CoursePack {
  readonly schemaVersion: typeof COURSE_PACK_SCHEMA_VERSION;
  readonly manifest: CourseManifest;
  readonly goals: readonly CanDoGoal[];
  readonly knowledge: readonly KnowledgeItem[];
  readonly utterances: readonly Utterance[];
  readonly exercises: readonly Exercise[];
  readonly rubrics: readonly FeedbackRubric[];
  readonly lessons: readonly LessonFlow[];
}

export type MasteryLevel =
  | "encountered"
  | "comprehended"
  | "prompted-output"
  | "independent-output"
  | "delayed-transfer";

export interface LearnerKnowledgeState {
  readonly learnerId: string;
  readonly languageId: string;
  readonly knowledgeItemId: string;
  readonly level: MasteryLevel;
  readonly evidenceCount: number;
  readonly lastAttemptAt: string;
}
