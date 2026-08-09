export * from "@learn-language/protocol";

import type { LanguageDefinition } from "@learn-language/protocol";

export interface LanguageAdapter {
  readonly definition: LanguageDefinition;
  normalize(input: string): string;
  segment(input: string): readonly string[];
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
