import type { LearnerKnowledgeState, MasteryLevel } from "./types.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ReviewMode =
  | "recognition"
  | "active-recall"
  | "scenario"
  | "transfer"
  | "fluency";

export interface ReviewRule {
  readonly delayMs: number;
  readonly mode: ReviewMode;
}

export type ReviewPolicy = Readonly<Record<MasteryLevel, ReviewRule>>;

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
  encountered: { delayMs: 4 * HOUR_MS, mode: "recognition" },
  comprehended: { delayMs: DAY_MS, mode: "active-recall" },
  "prompted-output": { delayMs: DAY_MS, mode: "scenario" },
  "independent-output": { delayMs: 3 * DAY_MS, mode: "transfer" },
  "delayed-transfer": { delayMs: 14 * DAY_MS, mode: "fluency" },
};

export interface ScheduledReview {
  readonly id: string;
  readonly learnerId: string;
  readonly languageId: string;
  readonly knowledgeItemId: string;
  readonly mode: ReviewMode;
  readonly dueAt: string;
  readonly basedOnLevel: MasteryLevel;
}

export function scheduleReviews(
  states: readonly LearnerKnowledgeState[],
  policy: ReviewPolicy = DEFAULT_REVIEW_POLICY,
): readonly ScheduledReview[] {
  return states
    .map((state) => {
      const lastAttempt = Date.parse(state.lastAttemptAt);
      if (!Number.isFinite(lastAttempt)) {
        throw new Error(
          `Invalid last attempt date for ${state.knowledgeItemId}: ${state.lastAttemptAt}`,
        );
      }

      const rule = policy[state.level];
      const dueAt = new Date(lastAttempt + rule.delayMs).toISOString();
      return {
        id: [
          state.learnerId,
          state.languageId,
          state.knowledgeItemId,
          rule.mode,
          dueAt,
        ].join(":"),
        learnerId: state.learnerId,
        languageId: state.languageId,
        knowledgeItemId: state.knowledgeItemId,
        mode: rule.mode,
        dueAt,
        basedOnLevel: state.level,
      };
    })
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}
