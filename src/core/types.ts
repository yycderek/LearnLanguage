export * from "@learn-language/protocol";
export type { LearnerKnowledgeState, MasteryLevel } from "@learn-language/engine";

import type { LanguageDefinition } from "@learn-language/protocol";

export interface LanguageAdapter {
  readonly definition: LanguageDefinition;
  normalize(input: string): string;
  segment(input: string): readonly string[];
}
