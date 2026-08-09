export const LANGUAGE_PACK_SCHEMA_VERSION = 1 as const;
export const COURSE_PACK_SCHEMA_VERSION = 2 as const;

export type LocalizedText = Record<string, string>;
export type LanguageDirection = "ltr" | "rtl" | "ttb";

export interface ScriptDefinition {
  code: string;
  name: LocalizedText;
  direction: LanguageDirection;
  primary: boolean;
}

export interface ReadingSystemDefinition {
  id: string;
  name: LocalizedText;
  kind: "native" | "romanization" | "phonetic";
}

export type LanguageCapability =
  | "normalization"
  | "segmentation"
  | "token-comparison"
  | "script-detection"
  | "reading-transform";

export interface LanguageDefinition {
  schemaVersion: typeof LANGUAGE_PACK_SCHEMA_VERSION;
  id: string;
  name: LocalizedText;
  accent?: string;
  scripts: ScriptDefinition[];
  readingSystems: ReadingSystemDefinition[];
  segmentation: {
    strategy: "whitespace" | "grapheme" | "character" | "script-run" | "adapter";
  };
  adapter?: {
    id: string;
    version: string;
    capabilities: LanguageCapability[];
  };
}

export type ContentVisibility = "official" | "community" | "private";
export type ContentStatus = "draft" | "validated" | "published" | "archived";

export interface ContentSource {
  kind: "original" | "imported" | "ai-assisted" | "forked";
  title?: string;
  url?: string;
  license?: string;
  derivedFromCourseId?: string;
  provider?: string;
  model?: string;
  generatedAt?: string;
}

export interface CourseManifest {
  id: string;
  version: string;
  languageId: string;
  title: LocalizedText;
  description: LocalizedText;
  author: {
    id: string;
    displayName: string;
  };
  visibility: ContentVisibility;
  status: ContentStatus;
  source: ContentSource;
  contentHash?: string;
  languageAdapter?: {
    id: string;
    version: string;
  };
}

export interface CanDoGoal {
  id: string;
  description: LocalizedText;
  framework?: {
    name: string;
    level?: string;
    reference?: string;
  };
}

export type KnowledgeKind = "lexeme" | "grammar" | "script" | "pragmatics";

export interface KnowledgeItem {
  id: string;
  conceptId?: string;
  kind: KnowledgeKind;
  form: string;
  reading?: Record<string, string>;
  meaning: LocalizedText;
  usage?: LocalizedText;
  tags?: string[];
}

export interface Utterance {
  id: string;
  text: string;
  translation?: LocalizedText;
  reading?: Record<string, string>;
  knowledgeRefs: string[];
}

export type ExerciseKind =
  | "single-choice"
  | "multiple-choice"
  | "matching"
  | "ordering"
  | "fill-blank"
  | "short-input"
  | "cloze"
  | "substitution"
  | "reconstruction"
  | "role-play"
  | "free-response";

export type EvaluationSource = "deterministic" | "self" | "ai-assisted";

export interface Exercise {
  id: string;
  kind: ExerciseKind;
  protocolVersion?: 1;
  prompt: LocalizedText;
  guidance?: LocalizedText;
  options?: LocalizedText[];
  correctOptionIndex?: number;
  acceptedAnswers?: string[];
  evaluationSources?: EvaluationSource[];
  knowledgeRefs: string[];
  utteranceRefs: string[];
  rubricRef?: string;
}

export type RubricDimension =
  | "task-completion"
  | "comprehensibility"
  | "target-language"
  | "prompt-dependence"
  | "fluency";

export interface FeedbackRubric {
  id: string;
  dimensions: RubricDimension[];
  retryRequired: boolean;
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

export type SupportLevel = "full" | "target-language-only" | "none";

export interface LessonStep {
  id: string;
  phase: LessonPhase;
  title: LocalizedText;
  supportLevel?: SupportLevel;
  knowledgeRefs: string[];
  utteranceRefs: string[];
  exerciseRefs: string[];
  next: string[];
}

export type CourseStep = LessonStep;

export interface LessonFlow {
  id: string;
  title: LocalizedText;
  canDoGoalRefs: string[];
  entryStepId: string;
  steps: LessonStep[];
}

export interface CoursePack {
  schemaVersion: typeof COURSE_PACK_SCHEMA_VERSION;
  manifest: CourseManifest;
  goals: CanDoGoal[];
  knowledge: KnowledgeItem[];
  utterances: Utterance[];
  exercises: Exercise[];
  rubrics: FeedbackRubric[];
  lessons: LessonFlow[];
}

export interface PublishedCoursePack extends CoursePack {
  manifest: CourseManifest & {
    status: "published";
    contentHash: string;
    languageAdapter: {
      id: string;
      version: string;
    };
  };
}

export interface ImportIssue {
  stage: "json" | "schema" | "domain";
  path: string;
  message: string;
}
